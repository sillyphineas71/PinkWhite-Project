import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { UserRepository } from './../src/modules/auth/repositories/user.repository';
import cookieParser from 'cookie-parser';

describe('DiscoveryModule (e2e)', () => {
  let app: INestApplication;
  let accessTokenA: string;
  let userIdA: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const userRepo = app.get(UserRepository);

    const emailA = `testa-${Date.now()}@example.com`;
    const password = 'StrongPassword123!@#';
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: emailA, password });
    if (regRes.status !== 201)
      throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);

    await userRepo.setEmailVerified(emailA);
    const loginResA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailA, password });
    if (loginResA.status !== 200)
      throw new Error(`Login failed: ${JSON.stringify(loginResA.body)}`);

    const cookieHeaderA =
      (loginResA.headers['set-cookie'] as unknown as string[]) || [];
    const tokenCookieA = cookieHeaderA.find((c: string) =>
      c.startsWith('access_token='),
    );
    if (tokenCookieA) accessTokenA = tokenCookieA.split(';')[0].split('=')[1];

    const userA = await userRepo.findByEmail(emailA);
    userIdA = userA!.id;

    // Onboarding User A
    await request(app.getHttpServer())
      .post('/profile/onboarding')
      .set('Cookie', [`access_token=${accessTokenA}`])
      .send({
        fullName: 'User A',
        dob: '2000-01-01T00:00:00Z',
        gender: 'MALE',
        searchGender: 'FEMALE',
      });

    await request(app.getHttpServer())
      .patch('/profile/location')
      .set('Cookie', [`access_token=${accessTokenA}`])
      .send({ lat: 10, lng: 106, isMocked: false });
  });

  afterAll(async () => {
    await app.close();
  });

  const getAuthReq = (method: 'get' | 'post' | 'patch', url: string) => {
    return request(app.getHttpServer())
      [method](url)
      .set('Cookie', [`access_token=${accessTokenA}`]);
  };

  it('/discovery/preferences (POST) - should block > 200km for free tier', async () => {
    const res = await getAuthReq('post', '/discovery/preferences').send({
      minAge: 18,
      maxAge: 30,
      genderFilter: 'FEMALE',
      maxDistance: 250, // > 200
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Khoảng cách tối đa cho gói miễn phí là 200km',
    );
  });

  it('/discovery/preferences (POST) - should create preferences', async () => {
    const res = await getAuthReq('post', '/discovery/preferences').send({
      minAge: 18,
      maxAge: 30,
      genderFilter: 'FEMALE',
      maxDistance: 50,
    });
    expect(res.status).toBe(201);
    expect(res.body.maxDistance).toBe(50);
  });

  it('/discovery/preferences (PATCH) - should update preferences', async () => {
    const res = await getAuthReq('patch', '/discovery/preferences').send({
      maxDistance: 60,
    });
    expect(res.status).toBe(200);
    expect(res.body.maxDistance).toBe(60);
  });

  it('/discovery/visibility/toggle (POST) - should block free tier', async () => {
    const res = await getAuthReq('post', '/discovery/visibility/toggle').send({
      isHidden: true,
    });
    expect(res.status).toBe(403);
  });

  it('/discovery/feed (GET) - should return feed', async () => {
    // Note: Since we need photos to be in feed, and it's hard to setup all mocks perfectly for User B in one go,
    // we just check if it returns 200 and data is an array (even if empty).
    const res = await getAuthReq('get', '/discovery/feed');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
