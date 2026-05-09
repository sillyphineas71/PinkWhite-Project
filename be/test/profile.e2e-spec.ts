import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { UserRepository } from './../src/modules/auth/repositories/user.repository';
import cookieParser from 'cookie-parser';

describe('ProfileModule (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Register a user to get the token
    const email = `test-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Password123!' });

    // Mock Email Service verify - directly modify user
    const userRepo = app.get(UserRepository);
    await userRepo.setEmailVerified(email);

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Password123!' });

    const cookieHeader = (loginRes.headers['set-cookie'] as unknown) as string[];
    // Extract access_token from cookie
    const tokenCookie = cookieHeader.find((c: string) => c.startsWith('access_token='));
    if (tokenCookie) {
      accessToken = tokenCookie.split(';')[0].split('=')[1];
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const getAuthReq = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', url: string) => {
    return request(app.getHttpServer())[method](url).set('Cookie', [`access_token=${accessToken}`]);
  };

  it('/profile/onboarding (POST) - should block underage', async () => {
    const res = await getAuthReq('post', '/profile/onboarding')
      .send({
        fullName: 'Test User',
        dob: new Date().toISOString(), // 0 years old
        gender: 'MALE',
        searchGender: 'FEMALE',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bạn phải đủ 18 tuổi để tham gia');
  });

  it('/profile/onboarding (POST) - should succeed', async () => {
    const res = await getAuthReq('post', '/profile/onboarding')
      .send({
        fullName: 'Test User',
        dob: '2000-01-01T00:00:00Z', // 26 years old
        gender: 'MALE',
        searchGender: 'FEMALE',
      });
    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe('Test User');
  });

  it('/profile/photos/presigned (POST) - should return url', async () => {
    const res = await getAuthReq('post', '/profile/photos/presigned');
    expect(res.status).toBe(201);
    expect(res.body.url).toBeDefined();
  });

  it('/profile/photos/confirm (POST) - should add photo', async () => {
    const res = await getAuthReq('post', '/profile/photos/confirm')
      .send({ url: 'https://test.com/photo1.jpg', isAvatar: true });
    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://test.com/photo1.jpg');
    expect(res.body.isAvatar).toBe(true);
  });

  it('/profile/me (GET) - should return aggregated profile', async () => {
    const res = await getAuthReq('get', '/profile/me');
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Test User');
    expect(res.body.age).toBeGreaterThanOrEqual(25);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].url).toBe('https://test.com/photo1.jpg');
  });

  it('/profile/bio-interests (PATCH) - should block profanity url', async () => {
    const res = await getAuthReq('patch', '/profile/bio-interests')
      .send({ bio: 'Hello www.google.com' });
    expect(res.status).toBe(400);
  });

  it('/profile/bio-interests (PATCH) - should succeed', async () => {
    const res = await getAuthReq('patch', '/profile/bio-interests')
      .send({ bio: 'Hello World', interestIds: ['id1', 'id2'] });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Hello World');
  });

  it('/profile/location (PATCH) - should block isMocked', async () => {
    const res = await getAuthReq('patch', '/profile/location')
      .send({ lat: 10, lng: 106, isMocked: true });
    expect(res.status).toBe(403);
  });

  it('/profile/location (PATCH) - should succeed', async () => {
    const res = await getAuthReq('patch', '/profile/location')
      .send({ lat: 10, lng: 106, isMocked: false });
    expect(res.status).toBe(200);
  });

});
