import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { UserRepository } from './../src/modules/auth/repositories/user.repository';
import { MatchRepository } from '../src/modules/match/repositories/match.repository';
import cookieParser from 'cookie-parser';

describe('MatchModule (e2e)', () => {
  let app: INestApplication;
  let accessTokenA: string;
  let accessTokenB: string;
  let userIdA: string;
  let userIdB: string;
  let userRepo: UserRepository;
  let matchRepo: MatchRepository;
  let matchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    userRepo = app.get(UserRepository);
    matchRepo = app.get(MatchRepository);

    const password = 'StrongPassword123!@#';

    // === Setup User A ===
    const emailA = `match-testa-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: emailA, password });
    await userRepo.setEmailVerified(emailA);
    const loginResA = await request(app.getHttpServer()).post('/api/auth/login').send({ email: emailA, password });
    const cookieA = ((loginResA.headers['set-cookie'] as unknown) as string[]) || [];
    accessTokenA = cookieA.find(c => c.startsWith('access_token='))?.split(';')[0].split('=')[1] || '';
    const userA = await userRepo.findByEmail(emailA);
    userIdA = userA!.id;

    // Onboard User A
    await request(app.getHttpServer())
      .post('/api/profile/onboarding')
      .set('Cookie', [`access_token=${accessTokenA}`])
      .send({ fullName: 'Alice Test', dob: '1998-01-15', gender: 'FEMALE' });
    await request(app.getHttpServer())
      .post('/api/profile/photos/confirm')
      .set('Cookie', [`access_token=${accessTokenA}`])
      .send({ url: 'https://test.com/alice.jpg', isAvatar: true });

    // === Setup User B ===
    const emailB = `match-testb-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: emailB, password });
    await userRepo.setEmailVerified(emailB);
    const loginResB = await request(app.getHttpServer()).post('/api/auth/login').send({ email: emailB, password });
    const cookieB = ((loginResB.headers['set-cookie'] as unknown) as string[]) || [];
    accessTokenB = cookieB.find(c => c.startsWith('access_token='))?.split(';')[0].split('=')[1] || '';
    const userB = await userRepo.findByEmail(emailB);
    userIdB = userB!.id;

    // Onboard User B
    await request(app.getHttpServer())
      .post('/api/profile/onboarding')
      .set('Cookie', [`access_token=${accessTokenB}`])
      .send({ fullName: 'Bob Test', dob: '1997-06-20', gender: 'MALE' });
    await request(app.getHttpServer())
      .post('/api/profile/photos/confirm')
      .set('Cookie', [`access_token=${accessTokenB}`])
      .send({ url: 'https://test.com/bob.jpg', isAvatar: true });

    // === Create Mutual Like -> Match ===
    await request(app.getHttpServer())
      .post('/api/swipe/like')
      .set('Cookie', [`access_token=${accessTokenA}`])
      .send({ targetId: userIdB });

    const mutualRes = await request(app.getHttpServer())
      .post('/api/swipe/like')
      .set('Cookie', [`access_token=${accessTokenB}`])
      .send({ targetId: userIdA });

    matchId = mutualRes.body.matchId;
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper functions
  const authReq = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', [`access_token=${token}`]),
    post: (url: string) => request(app.getHttpServer()).post(url).set('Cookie', [`access_token=${token}`]),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set('Cookie', [`access_token=${token}`]),
  });

  // ==================== UC057: GET /matches ====================
  describe('UC057: GET /api/matches', () => {
    it('should return match list with partner info and unreadCount', async () => {
      const res = await authReq(accessTokenA).get('/api/matches');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const firstMatch = res.body.data.find((m: any) => m.matchId === matchId);
      expect(firstMatch).toBeDefined();
      expect(firstMatch.partner.fullName).toBe('Bob Test');
      expect(firstMatch.unreadCount).toBe(0);
      expect(firstMatch.lastInteractionAt).toBeDefined();
    });

    it('should filter out Ghost Data (banned user)', async () => {
      // Ban User B
      const userB = await userRepo.findById(userIdB);
      if (userB) {
        (userB as any).isBanned = true;
        // Direct mutation on the mock Map for testing
        (userRepo as any).users.set(userIdB, userB);
      }

      const res = await authReq(accessTokenA).get('/api/matches');
      const ghostMatch = res.body.data.find((m: any) => m.matchId === matchId);
      expect(ghostMatch).toBeUndefined(); // B is banned, should NOT appear

      // Unban User B for subsequent tests
      const userBRestored = await userRepo.findById(userIdB);
      if (userBRestored) {
        (userBRestored as any).isBanned = false;
        (userRepo as any).users.set(userIdB, userBRestored);
      }
    });
  });

  // ==================== UC058: GET /matches/:matchId/profile ====================
  describe('UC058: GET /api/matches/:matchId/profile', () => {
    it('should return full profile of match partner', async () => {
      const res = await authReq(accessTokenA).get(`/api/matches/${matchId}/profile`);
      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('Bob Test');
      expect(res.body.photos).toBeInstanceOf(Array);
      expect(res.body.photos.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 403 for non-member', async () => {
      // Create a third user that is NOT part of this match
      const emailC = `match-testc-${Date.now()}@example.com`;
      const password = 'StrongPassword123!@#';
      await request(app.getHttpServer()).post('/api/auth/register').send({ email: emailC, password });
      await userRepo.setEmailVerified(emailC);
      const loginResC = await request(app.getHttpServer()).post('/api/auth/login').send({ email: emailC, password });
      const cookieC = ((loginResC.headers['set-cookie'] as unknown) as string[]) || [];
      const accessTokenC = cookieC.find(c => c.startsWith('access_token='))?.split(';')[0].split('=')[1] || '';

      const res = await authReq(accessTokenC).get(`/api/matches/${matchId}/profile`);
      expect(res.status).toBe(403);
    });
  });

  // ==================== UC059: GET /matches/search ====================
  describe('UC059: GET /api/matches/search', () => {
    it('should find match by partner name', async () => {
      const res = await authReq(accessTokenA).get('/api/matches/search?q=Bob');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].partner.fullName).toContain('Bob');
    });

    it('should return empty array for non-matching keyword', async () => {
      const res = await authReq(accessTokenA).get('/api/matches/search?q=ZzzNonExistent');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ==================== UC060: POST /matches/:matchId/unmatch ====================
  describe('UC060: POST /api/matches/:matchId/unmatch', () => {
    it('should unmatch successfully', async () => {
      const res = await authReq(accessTokenA).post(`/api/matches/${matchId}/unmatch`);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify match disappeared from list
      const listRes = await authReq(accessTokenA).get('/api/matches');
      const gone = listRes.body.data.find((m: any) => m.matchId === matchId);
      expect(gone).toBeUndefined();
    });

    it('should return 400 when unmatching already unmatched', async () => {
      const res = await authReq(accessTokenA).post(`/api/matches/${matchId}/unmatch`);
      expect(res.status).toBe(400);
    });
  });

  // ==================== UC061: POST /matches/:matchId/rematch ====================
  describe('UC061: POST /api/matches/:matchId/rematch', () => {
    it('should reject Free User', async () => {
      const res = await authReq(accessTokenA).post(`/api/matches/${matchId}/rematch`);
      expect(res.status).toBe(403);
    });

    it('should allow Premium User who initiated unmatch', async () => {
      // Upgrade User A to Premium
      const userA = await userRepo.findById(userIdA);
      if (userA) {
        (userA as any).isPremium = true;
        (userRepo as any).users.set(userIdA, userA);
      }

      const res = await authReq(accessTokenA).post(`/api/matches/${matchId}/rematch`);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify match reappears in list
      const listRes = await authReq(accessTokenA).get('/api/matches');
      const restored = listRes.body.data.find((m: any) => m.matchId === matchId);
      expect(restored).toBeDefined();

      // Reset Premium
      const userAReset = await userRepo.findById(userIdA);
      if (userAReset) {
        (userAReset as any).isPremium = false;
        (userRepo as any).users.set(userIdA, userAReset);
      }
    });
  });

  // ==================== UC062: PATCH /matches/:matchId/read ====================
  describe('UC062: PATCH /api/matches/:matchId/read', () => {
    it('should mark as read for current user only', async () => {
      // Determine which side userA and userB actually are in the match record
      const matchData = await matchRepo.findById(matchId);
      const sideForUserA = matchData!.userAId === userIdA ? 'A' : 'B';
      const sideForUserB = sideForUserA === 'A' ? 'B' : 'A';

      // Manually increment unread for User A's side (2 times) and User B's side (1 time)
      await matchRepo.incrementUnreadCount(matchId, sideForUserA as 'A' | 'B');
      await matchRepo.incrementUnreadCount(matchId, sideForUserA as 'A' | 'B');
      await matchRepo.incrementUnreadCount(matchId, sideForUserB as 'A' | 'B');

      // User A marks as read via API
      const res = await authReq(accessTokenA).patch(`/api/matches/${matchId}/read`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify: User A's unread count = 0, User B's unread count = 1 (untouched)
      const updatedMatch = await matchRepo.findById(matchId);
      if (sideForUserA === 'A') {
        expect(updatedMatch!.unreadCountA).toBe(0);
        expect(updatedMatch!.unreadCountB).toBe(1);
      } else {
        expect(updatedMatch!.unreadCountB).toBe(0);
        expect(updatedMatch!.unreadCountA).toBe(1);
      }
    });
  });
});
