import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { UserRepository } from './../src/modules/auth/repositories/user.repository';
import cookieParser from 'cookie-parser';
import { PrismaService } from '../src/database/prisma.service';

describe('SwipeModule (e2e)', () => {
  let app: INestApplication;
  let accessTokenA: string;
  let accessTokenB: string;
  let userIdA: string;
  let userIdB: string;
  let userRepo: UserRepository;
  let prisma: PrismaService;

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

    userRepo = app.get(UserRepository);
    prisma = app.get(PrismaService);

    // Setup User A
    const emailA = `testa-${Date.now()}@example.com`;
    const password = 'StrongPassword123!@#';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: emailA, password });
    await userRepo.setEmailVerified(emailA);
    const loginResA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailA, password });
    const cookieA =
      (loginResA.headers['set-cookie'] as unknown as string[]) || [];
    accessTokenA =
      cookieA
        .find((c) => c.startsWith('access_token='))
        ?.split(';')[0]
        .split('=')[1] || '';
    const userA = await userRepo.findByEmail(emailA);
    userIdA = userA!.id;

    // Setup User B
    const emailB = `testb-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: emailB, password });
    await userRepo.setEmailVerified(emailB);
    const loginResB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailB, password });
    const cookieB =
      (loginResB.headers['set-cookie'] as unknown as string[]) || [];
    accessTokenB =
      cookieB
        .find((c) => c.startsWith('access_token='))
        ?.split(';')[0]
        .split('=')[1] || '';
    const userB = await userRepo.findByEmail(emailB);
    userIdB = userB!.id;

    // Add dummy photo to B to pass photo check
    await request(app.getHttpServer())
      .post('/profile/photos/confirm')
      .set('Cookie', [`access_token=${accessTokenB}`])
      .send({ url: 'https://test.com/photo.jpg', isAvatar: true });
  });

  afterAll(async () => {
    await app.close();
  });

  const getAuthReqA = (method: 'get' | 'post', url: string) => {
    return request(app.getHttpServer())
      [method](url)
      .set('Cookie', [`access_token=${accessTokenA}`]);
  };
  const getAuthReqB = (method: 'get' | 'post', url: string) => {
    return request(app.getHttpServer())
      [method](url)
      .set('Cookie', [`access_token=${accessTokenB}`]);
  };

  it('/swipe/like (POST) - A likes B', async () => {
    const res = await getAuthReqA('post', '/swipe/like').send({
      targetId: userIdB,
    });
    expect(res.status).toBe(201);
    expect(res.body.isMatch).toBe(false);
  });

  it('/swipe/like (POST) - B likes A (Mutual Like)', async () => {
    // Add dummy photo to A first
    await request(app.getHttpServer())
      .post('/profile/photos/confirm')
      .set('Cookie', [`access_token=${accessTokenA}`])
      .send({ url: 'https://test.com/photo.jpg', isAvatar: true });

    const res = await getAuthReqB('post', '/swipe/like').send({
      targetId: userIdA,
    });
    expect(res.status).toBe(201);
    expect(res.body.isMatch).toBe(true);
    expect(res.body.matchId).toBeDefined();

    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { userAId: userIdA, userBId: userIdB },
          { userAId: userIdB, userBId: userIdA },
        ],
      },
    });
    expect(match).toBeDefined();
  });

  it('/swipe/rewind (POST) - should block non-premium', async () => {
    const res = await getAuthReqA('post', '/swipe/rewind');
    expect(res.status).toBe(403);
  });

  it('/swipe/superlike (POST) - A superlikes B again (already matched)', async () => {
    const res = await getAuthReqA('post', '/swipe/superlike').send({
      targetId: userIdB,
      message: 'Hello',
    });
    expect(res.status).toBe(201);
    expect(res.body.isMatch).toBe(true); // Because they are already matched
  });

  it('/swipe/remaining (GET) - get counts', async () => {
    const res = await getAuthReqA('get', '/swipe/remaining');
    expect(res.status).toBe(200);
    expect(res.body.likesRemaining).toBe(100); // The LIKE was replaced by SUPER_LIKE
    expect(res.body.superLikesRemaining).toBe(0); // super liked once (free limit 1)
  });
});
