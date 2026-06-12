import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ChatErrorCode } from '../src/modules/chat/enums/chat-error.enum';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
const cookieParser = require('cookie-parser');

describe('Chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAId: string;
  let userBId: string;
  let userCId: string; // Non-participant
  let matchIdAB: string;

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup Test Data
    const emailA = `chattest_service_A_${crypto.randomBytes(4).toString('hex')}@test.com`;
    const emailB = `chattest_service_B_${crypto.randomBytes(4).toString('hex')}@test.com`;
    const emailC = `chattest_service_C_${crypto.randomBytes(4).toString('hex')}@test.com`;

    const createDummyUserAndToken = async (email: string, name: string) => {
      const user = await prisma.user.create({
        data: {
          email: email,
          emailNormalized: email.toUpperCase(),
          accountStatus: 'ACTIVE',
          onboardingStatus: 'COMPLETED',
          authIdentities: {
            create: {
              provider: 'EMAIL',
              providerUserId: email,
              passwordHash: 'dummy',
            },
          },
          profile: {
            create: {
              displayName: name,
              dob: new Date('1990-01-01'),
              gender: 'MALE',
              relationshipGoal: 'STILL_FIGURING_OUT',
              bio: '',
            },
          },
        },
      });

      // Generate a valid JWT token via a mock or internal mechanism if needed,
      // but since this is an e2e test, we will create a session directly and use the standard auth flow if needed.
      // Wait, we need real JWTs. We can use the Auth service or JwtService directly.
      const jwtService = app.get(JwtService); // Access standard JwtService
      const configService = app.get(ConfigService);
      const secret = configService.get<string>('JWT_ACCESS_SECRET');
      const accessToken = jwtService.sign(
        { sub: user.id, token_type: 'ACCESS' },
        { secret, expiresIn: '1h' },
      );

      return { userId: user.id, token: accessToken };
    };

    const resA = await createDummyUserAndToken(emailA, 'Chat Service User A');
    userAId = resA.userId;
    tokenA = resA.token;

    const resB = await createDummyUserAndToken(emailB, 'Chat Service User B');
    userBId = resB.userId;
    tokenB = resB.token;

    const resC = await createDummyUserAndToken(emailC, 'Chat Service User C');
    userCId = resC.userId;
    tokenC = resC.token;

    // Create Match AB
    const mAB = await prisma.match.create({
      data: {
        userAId: userAId < userBId ? userAId : userBId,
        userBId: userAId < userBId ? userBId : userAId,
        status: 'ACTIVE',
        lastInteractionAt: new Date(),
        unreadCountA: 0,
        unreadCountB: 0,
      },
    });
    matchIdAB = mAB.id;
  });

  afterAll(async () => {
    const userIds = [userAId, userBId, userCId].filter(Boolean);

    await prisma.message.deleteMany({
      where: { match: { userAId: { in: userIds } } },
    });
    await prisma.match.deleteMany({
      where: {
        OR: [{ userAId: { in: userIds } }, { userBId: { in: userIds } }],
      },
    });

    if (userIds.length > 0) {
      await prisma.authIdentity.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await app.close();
  });

  describe('POST /api/chat/:matchId/messages', () => {
    it('should fail if body is empty', async () => {
      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ body: '   ' });

      expect(res.status).toBe(400); // Bad Request (Domain logic empty)
      expect(res.body.code).toBe(ChatErrorCode.MESSAGE_EMPTY);
    });

    it('should fail if body is too long', async () => {
      const longBody = 'A'.repeat(1001);
      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ body: longBody });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ChatErrorCode.MESSAGE_TOO_LONG);
    });

    it('should fail if messageType is IMAGE', async () => {
      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ body: 'test', messageType: 'IMAGE' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ChatErrorCode.IMAGE_NOT_SUPPORTED);
    });

    it('should fail if non-participant tries to send', async () => {
      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenC}`])
        .send({ body: 'hello' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ChatErrorCode.NOT_PARTICIPANT);
    });

    it('should send successfully (happy path) and increment unread', async () => {
      // Get initial match state
      const initialMatch = await prisma.match.findUnique({
        where: { id: matchIdAB },
      });
      const initialUnreadB =
        initialMatch?.userAId === userAId
          ? initialMatch.unreadCountB
          : initialMatch?.unreadCountA;

      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ body: 'Hello Match!' });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Hello Match!');
      expect(res.body.senderId).toBe(userAId);
      expect(res.body.messageType).toBe('TEXT');

      // Verify unread increment and timestamps
      const updatedMatch = await prisma.match.findUnique({
        where: { id: matchIdAB },
      });
      const updatedUnreadB =
        updatedMatch?.userAId === userAId
          ? updatedMatch.unreadCountB
          : updatedMatch?.unreadCountA;

      expect(updatedUnreadB).toBe(initialUnreadB! + 1);
      expect(updatedMatch?.lastMessageAt).not.toBeNull();
      expect(updatedMatch?.lastInteractionAt?.getTime()).toBeGreaterThanOrEqual(
        initialMatch!.lastInteractionAt!.getTime(),
      );
    });

    it('should fail if match is NOT_ACTIVE (TOCTOU test)', async () => {
      // Unmatch the match
      await prisma.match.update({
        where: { id: matchIdAB },
        data: {
          status: 'UNMATCHED',
          unmatchedAt: new Date(),
          unmatchedByUserId: userAId,
        },
      });

      const initialCount = await prisma.message.count({
        where: { matchId: matchIdAB },
      });

      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ body: 'Ghost message' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ChatErrorCode.MATCH_NOT_ACTIVE);

      const finalCount = await prisma.message.count({
        where: { matchId: matchIdAB },
      });
      expect(finalCount).toBe(initialCount); // Message should not be created
    });
  });

  describe('GET /api/chat/:matchId/messages', () => {
    beforeAll(async () => {
      // Restore match to ACTIVE for getting messages
      await prisma.match.update({
        where: { id: matchIdAB },
        data: { status: 'ACTIVE', unmatchedAt: null, unmatchedByUserId: null },
      });

      // Send 3 more messages using userB
      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ body: 'Msg 2' });
      await new Promise((r) => setTimeout(r, 10));

      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ body: 'Msg 3' });
      await new Promise((r) => setTimeout(r, 10));

      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ body: 'Msg 4' });
    });

    it('should return messages properly with pagination', async () => {
      const res1 = await request(app.getHttpServer())
        .get(`/chat/${matchIdAB}/messages?limit=2`)
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res1.status).toBe(200);
      expect(res1.body.data.length).toBe(2);
      expect(res1.body.data[0].body).toBe('Msg 4');
      expect(res1.body.data[1].body).toBe('Msg 3');
      expect(res1.body.nextCursor).toBeDefined();

      const nextCursor = res1.body.nextCursor;

      const res2 = await request(app.getHttpServer())
        .get(
          `/chat/${matchIdAB}/messages?cursor=${encodeURIComponent(nextCursor)}&limit=2`,
        )
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res2.status).toBe(200);
      expect(res2.body.data.length).toBe(2);
      expect(res2.body.data[0].body).toBe('Msg 2');
      expect(res2.body.data[1].body).toBe('Hello Match!');
      expect(res2.body.nextCursor).toBeUndefined(); // Should have no more messages
    });

    it('should fail if non-participant tries to get messages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenC}`]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ChatErrorCode.NOT_PARTICIPANT);
    });

    it('should fail if match is NOT_ACTIVE', async () => {
      await prisma.match.update({
        where: { id: matchIdAB },
        data: {
          status: 'UNMATCHED',
          unmatchedAt: new Date(),
          unmatchedByUserId: userAId,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ChatErrorCode.MATCH_NOT_ACTIVE);
    });
  });

  describe('POST /api/chat/:matchId/read', () => {
    beforeAll(async () => {
      // Restore match to ACTIVE for getting messages
      await prisma.match.update({
        where: { id: matchIdAB },
        data: { status: 'ACTIVE', unmatchedAt: null, unmatchedByUserId: null },
      });
    });

    it('should mark messages as read and return success', async () => {
      // Send a new message from User B
      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ body: 'Read this!' });

      let match = await prisma.match.findUnique({ where: { id: matchIdAB } });
      expect(match!.unreadCountA).toBeGreaterThan(0);

      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/read`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      match = await prisma.match.findUnique({ where: { id: matchIdAB } });
      expect(match!.unreadCountA).toBe(0);
      expect(match!.lastReadAtA).toBeDefined();
      expect(match!.lastReadMessageIdA).toBeDefined();
    });

    it('should be deterministic: read then send leaves unreadCountA=1', async () => {
      // 1. B sends a message for A to read
      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ body: 'Before race' });

      let match = await prisma.match.findUnique({ where: { id: matchIdAB } });
      expect(match!.unreadCountA).toBeGreaterThan(0);

      // 2. A marks as read (await to completion)
      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/read`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send();

      match = await prisma.match.findUnique({ where: { id: matchIdAB } });
      expect(match!.unreadCountA).toBe(0);

      // 3. B sends ANOTHER message AFTER read completed
      const sendRes = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/messages`)
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ body: 'During race' });
      expect(sendRes.status).toBe(201);

      // (a) Message MUST exist in DB
      const msgInDb = await prisma.message.findFirst({
        where: { matchId: matchIdAB, body: 'During race' },
      });
      expect(msgInDb).not.toBeNull();

      // (b) unreadCountA MUST be exactly 1 (would fail if code blindly set 0)
      match = await prisma.match.findUnique({ where: { id: matchIdAB } });
      expect(match!.unreadCountA).toBe(1);

      // 4. A marks as read again -> should drop to 0
      await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/read`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send();

      match = await prisma.match.findUnique({ where: { id: matchIdAB } });
      expect(match!.unreadCountA).toBe(0);
    });

    it('should fail if non-participant tries to mark read', async () => {
      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/read`)
        .set('Cookie', [`access_token=${tokenC}`])
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ChatErrorCode.NOT_PARTICIPANT);
    });

    it('should fail if match is NOT_ACTIVE', async () => {
      await prisma.match.update({
        where: { id: matchIdAB },
        data: {
          status: 'UNMATCHED',
          unmatchedAt: new Date(),
          unmatchedByUserId: userAId,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/chat/${matchIdAB}/read`)
        .set('Cookie', [`access_token=${tokenA}`])
        .send();

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ChatErrorCode.MATCH_NOT_ACTIVE);
    });
  });

  describe('GET /api/chat/inbox', () => {
    beforeAll(async () => {
      // Restore match to ACTIVE for inbox testing
      await prisma.match.update({
        where: { id: matchIdAB },
        data: { status: 'ACTIVE', unmatchedAt: null, unmatchedByUserId: null },
      });
    });

    it('should return inbox for user correctly', async () => {
      const res = await request(app.getHttpServer())
        .get(`/chat/inbox?limit=5`)
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((i: any) => i.matchId === matchIdAB);
      expect(item).toBeDefined();
      expect(item.partner.userId).toBe(userBId);
      expect(item.partner.displayName).toBe('Chat Service User B');
      expect(item.latestMessage).toBeDefined();
      expect(item.latestMessage.body).toBe('During race'); // Sent in previous test
    });

    it('should properly sort an empty match at the end if lastMessageAt is null', async () => {
      // Create a new Match with NO messages
      const mAC = await prisma.match.create({
        data: {
          userAId: userAId < userCId ? userAId : userCId,
          userBId: userAId < userCId ? userCId : userAId,
          status: 'ACTIVE',
          matchedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/chat/inbox?limit=5`)
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res.status).toBe(200);
      const data = res.body.data;
      const indexAB = data.findIndex((i: any) => i.matchId === matchIdAB);
      const indexAC = data.findIndex((i: any) => i.matchId === mAC.id);

      expect(indexAB).toBeGreaterThan(-1);
      expect(indexAC).toBeGreaterThan(-1);
      expect(indexAB).toBeLessThan(indexAC); // Match with message comes before empty match
    });

    it('should paginate correctly across the boundary where last_message_at differs from message.created_at', async () => {
      // Page 1: limit=1, should get matchAB (has messages)
      const res1 = await request(app.getHttpServer())
        .get(`/chat/inbox?limit=1`)
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res1.status).toBe(200);
      expect(res1.body.data.length).toBe(1);
      expect(res1.body.data[0].matchId).toBe(matchIdAB);
      expect(res1.body.hasMore).toBe(true);
      expect(res1.body.nextCursor).toBeDefined();

      // Page 2: use cursor from page 1, should get mAC (no messages, null last_message_at)
      const res2 = await request(app.getHttpServer())
        .get(`/chat/inbox?limit=1&cursor=${encodeURIComponent(res1.body.nextCursor)}`)
        .set('Cookie', [`access_token=${tokenA}`]);

      expect(res2.status).toBe(200);
      expect(res2.body.data.length).toBe(1);
      // The second page item should be the match with no messages
      expect(res2.body.data[0].latestMessage).toBeNull();
      expect(res2.body.data[0].unreadCount).toBe(0);
    });
  });
});
