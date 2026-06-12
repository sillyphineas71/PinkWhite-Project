import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ChatInboxRepository } from '../src/modules/chat/repositories/chat-inbox.repository';
import { MessageRepository } from '../src/modules/chat/repositories/message.repository';
import { MessageType } from '../src/modules/chat/dto/send-message.dto';
import { MessageType as PrismaMessageType } from '@prisma/client';
import * as crypto from 'crypto';

describe('Chat DAL (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inboxRepo: ChatInboxRepository;
  let msgRepo: MessageRepository;

  let userAId: string;
  let userBId: string;
  let userCId: string; // for the match with no messages
  let matchIdAB: string;
  let matchIdAC: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    inboxRepo = app.get<ChatInboxRepository>(ChatInboxRepository);
    msgRepo = app.get<MessageRepository>(MessageRepository);

    // Setup Test Data
    const emailA = `chattestA_${crypto.randomBytes(4).toString('hex')}@test.com`;
    const emailB = `chattestB_${crypto.randomBytes(4).toString('hex')}@test.com`;
    const emailC = `chattestC_${crypto.randomBytes(4).toString('hex')}@test.com`;

    const createDummyUser = async (email: string, name: string) => {
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
      return user.id;
    };

    userAId = await createDummyUser(emailA, 'Chat User A');
    userBId = await createDummyUser(emailB, 'Chat User B');
    userCId = await createDummyUser(emailC, 'Chat User C');

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

    // Create Match AC (No messages)
    const mAC = await prisma.match.create({
      data: {
        userAId: userAId < userCId ? userAId : userCId,
        userBId: userAId < userCId ? userCId : userAId,
        status: 'ACTIVE',
        lastInteractionAt: new Date(),
        unreadCountA: 0,
        unreadCountB: 0,
      },
    });
    matchIdAC = mAC.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.message.deleteMany({
      where: { matchId: { in: [matchIdAB, matchIdAC] } },
    });
    await prisma.match.deleteMany({
      where: { id: { in: [matchIdAB, matchIdAC] } },
    });
    const userIds = [userAId, userBId, userCId].filter(Boolean);
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

  it('MessageRepository - createMessage & findMessagesPage', async () => {
    const ts1 = new Date();
    const ts2 = new Date(ts1.getTime() + 1000);
    const ts3 = new Date(ts1.getTime() + 2000);

    await prisma.$transaction(async (tx) => {
      console.log('PrismaMessageType:', PrismaMessageType);
      // msg 1
      await msgRepo.createMessage(tx, {
        matchId: matchIdAB,
        senderId: userAId,
        messageType: MessageType.TEXT,
        body: 'msg1',
      });
      // simulate delay
      await new Promise((r) => setTimeout(r, 10));
      // msg 2
      await msgRepo.createMessage(tx, {
        matchId: matchIdAB,
        senderId: userBId,
        messageType: MessageType.TEXT,
        body: 'msg2',
      });
      await new Promise((r) => setTimeout(r, 10));
      // msg 3
      await msgRepo.createMessage(tx, {
        matchId: matchIdAB,
        senderId: userAId,
        messageType: MessageType.TEXT,
        body: 'msg3',
      });
    });

    const page1 = await msgRepo.findMessagesPage(matchIdAB, { limit: 2 });
    expect(page1.length).toBe(3); // 2 + 1 for hasMore
    expect(page1[0].body).toBe('msg3');
    expect(page1[1].body).toBe('msg2');

    const nextCursor = {
      createdAt: page1[1].createdAt.toISOString(),
      id: page1[1].id,
    };

    const page2 = await msgRepo.findMessagesPage(matchIdAB, {
      cursor: nextCursor,
      limit: 2,
    });
    expect(page2.length).toBe(1); // Only msg1 left
    expect(page2[0].body).toBe('msg1');

    // Manually set lastMessageAt to the latest
    await prisma.match.update({
      where: { id: matchIdAB },
      data: { lastMessageAt: page1[0].createdAt },
    });
  });

  it('MessageRepository - lockMatchRowForUpdate & counts', async () => {
    await prisma.$transaction(async (tx) => {
      const match = await msgRepo.lockMatchRowForUpdate(tx, matchIdAB);
      expect(match).toBeDefined();
      expect(match!.id).toBe(matchIdAB);

      const maxB = await msgRepo.getMaxPartnerMessageId(tx, matchIdAB, userBId);
      expect(maxB).toBeDefined();

      const unreadCount = await msgRepo.countUnreadAfter(
        tx,
        matchIdAB,
        userBId,
        null,
      );
      expect(unreadCount).toBeGreaterThanOrEqual(1); // since userB sent msg2
    });
  });

  it('ChatInboxRepository - findInboxPage sweeps through NULL boundary', async () => {
    // We have 2 matches for userA:
    // AB has messages (lastMessageAt != null)
    // AC has NO messages (lastMessageAt == null)

    const page1 = await inboxRepo.findInboxPage(userAId, { limit: 2 });
    // Should return both matches because limit+1 = 3
    expect(page1.length).toBe(2);

    // match AB should be first (has lastMessageAt)
    expect(page1[0].matchId).toBe(matchIdAB);
    expect(page1[0].latestMessageBody).toBe('msg3');
    expect(page1[0].partnerUserId).toBe(userBId);

    // match AC should be second (lastMessageAt == null)
    expect(page1[1].matchId).toBe(matchIdAC);
    expect(page1[1].latestMessageBody).toBeNull();
    expect(page1[1].partnerUserId).toBe(userCId);

    // Let's test cursor sweeping across the NULL boundary
    // Say we limit to 1, we get AB.
    const limitedPage1 = await inboxRepo.findInboxPage(userAId, { limit: 1 });
    expect(limitedPage1.length).toBe(2); // 1 + 1 (hasMore)
    expect(limitedPage1[0].matchId).toBe(matchIdAB);

    const nextCursor = {
      lastMessageAt: limitedPage1[0].latestMessageCreatedAt
        ? limitedPage1[0].latestMessageCreatedAt.toISOString()
        : null,
      matchId: limitedPage1[0].matchId,
    };

    const limitedPage2 = await inboxRepo.findInboxPage(userAId, {
      cursor: nextCursor,
      limit: 1,
    });
    // Should get AC
    expect(limitedPage2.length).toBe(1);
    expect(limitedPage2[0].matchId).toBe(matchIdAC);
    expect(limitedPage2[0].latestMessageBody).toBeNull();
  });
});
