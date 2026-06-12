import { Test, TestingModule } from '@nestjs/testing';
import { SwipeService } from './swipe.service';
import { PrismaService } from '../../../database/prisma.service';
import { SwipeReadRepository } from '../repositories/swipe-read.repository';
import { SwipeWriteRepository } from '../repositories/swipe-write.repository';
import { MatchWriteRepository } from '../../match/repositories/match-write.repository';
import { MatchCreationService } from '../../match/services/match-creation.service';
import { SwipeException, SwipeErrorCode } from '../swipe.types';

describe('SwipeService', () => {
  let service: SwipeService;
  let prisma: jest.Mocked<PrismaService>;
  let swipeReadRepo: jest.Mocked<SwipeReadRepository>;
  let swipeWriteRepo: jest.Mocked<SwipeWriteRepository>;
  let matchWriteRepo: jest.Mocked<MatchWriteRepository>;
  let matchCreationService: jest.Mocked<MatchCreationService>;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb({})),
    } as any;

    swipeReadRepo = {
      findRequesterEligibility: jest.fn(),
      findTargetEligibility: jest.fn(),
      findBlockEitherDirection: jest.fn(),
      findCurrentSwipeState: jest.fn(),
      findReciprocalPositiveState: jest.fn(),
      hasActiveRealLocation: jest.fn(),
    };

    swipeWriteRepo = {
      createSwipeEvent: jest.fn(),
      upsertSwipeState: jest.fn(),
    };

    matchWriteRepo = {
      findMatchByPair: jest.fn(),
      acquirePairTransactionLock: jest.fn(),
    } as any;

    matchCreationService = {
      createMatchPair: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwipeService,
        { provide: PrismaService, useValue: prisma },
        { provide: SwipeReadRepository, useValue: swipeReadRepo },
        { provide: SwipeWriteRepository, useValue: swipeWriteRepo },
        { provide: MatchWriteRepository, useValue: matchWriteRepo },
        { provide: MatchCreationService, useValue: matchCreationService },
      ],
    }).compile();

    service = module.get<SwipeService>(SwipeService);
  });

  const validRequester = {
    accountStatus: 'ACTIVE',
    deletedAt: null,
    emailVerifiedAt: new Date(),
    onboardingStatus: 'COMPLETED',
    privacySettings: { isHidden: false },
    location: { activeLocationMode: 'REAL' },
    discoveryPreference: {},
  };

  const validTarget = {
    accountStatus: 'ACTIVE',
    deletedAt: null,
    emailVerifiedAt: new Date(),
    onboardingStatus: 'COMPLETED',
    privacySettings: { isHidden: false },
    profile: {
      displayName: 'Target',
      dob: new Date(),
      gender: 'MALE',
      relationshipGoal: 'LONG_TERM',
    },
    photos: [{ publicUrl: 'url' }],
  };

  const setupValidMocks = () => {
    swipeReadRepo.findRequesterEligibility.mockResolvedValue(
      validRequester as any,
    );
    swipeReadRepo.hasActiveRealLocation.mockResolvedValue(true);
    swipeReadRepo.findTargetEligibility.mockResolvedValue(validTarget as any);
    swipeReadRepo.findBlockEitherDirection.mockResolvedValue(null);
    matchWriteRepo.acquirePairTransactionLock.mockResolvedValue(undefined);
    matchWriteRepo.findMatchByPair.mockResolvedValue(null);
    swipeReadRepo.findCurrentSwipeState.mockResolvedValue(null);
  };

  it('should reject self swipe', async () => {
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-1',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(
      new SwipeException(SwipeErrorCode.SELF_SWIPE_NOT_ALLOWED),
    );
  });

  it('should reject ineligible requester', async () => {
    swipeReadRepo.findRequesterEligibility.mockResolvedValue({
      ...validRequester,
      accountStatus: 'BANNED',
    } as any);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.SWIPE_NOT_ALLOWED));
  });

  it('should reject ineligible target', async () => {
    swipeReadRepo.findRequesterEligibility.mockResolvedValue(
      validRequester as any,
    );
    swipeReadRepo.findTargetEligibility.mockResolvedValue({
      ...validTarget,
      accountStatus: 'BANNED',
    } as any);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE));
  });

  it('should reject if blocked', async () => {
    swipeReadRepo.findRequesterEligibility.mockResolvedValue(
      validRequester as any,
    );
    swipeReadRepo.hasActiveRealLocation.mockResolvedValue(true);
    swipeReadRepo.findTargetEligibility.mockResolvedValue(validTarget as any);
    swipeReadRepo.findBlockEitherDirection.mockResolvedValue({} as any);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE));
  });

  it('should reject if requester activeLocationMode is REAL but real_location is null', async () => {
    swipeReadRepo.findRequesterEligibility.mockResolvedValue(
      validRequester as any,
    );
    swipeReadRepo.hasActiveRealLocation.mockResolvedValue(false);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.SWIPE_NOT_ALLOWED));
  });

  it('should reject if target displayName is missing or empty', async () => {
    swipeReadRepo.findRequesterEligibility.mockResolvedValue(
      validRequester as any,
    );
    swipeReadRepo.hasActiveRealLocation.mockResolvedValue(true);
    const invalidTarget = {
      ...validTarget,
      profile: { ...validTarget.profile, displayName: '   ' },
    };
    swipeReadRepo.findTargetEligibility.mockResolvedValue(invalidTarget as any);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE));
  });

  it('SwipeException should map HTTP statuses correctly', () => {
    const ex1 = new SwipeException(SwipeErrorCode.INVALID_SWIPE_ACTION);
    expect(ex1.getStatus()).toBe(400);

    const ex2 = new SwipeException(SwipeErrorCode.SWIPE_NOT_ALLOWED);
    expect(ex2.getStatus()).toBe(403);

    const ex3 = new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE);
    expect(ex3.getStatus()).toBe(404);

    const ex4 = new SwipeException(SwipeErrorCode.ALREADY_MATCHED);
    expect(ex4.getStatus()).toBe(400);
  });

  it('should reject if existing ACTIVE match', async () => {
    setupValidMocks();
    matchWriteRepo.findMatchByPair.mockResolvedValue({
      status: 'ACTIVE',
    } as any);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.ALREADY_MATCHED));
    expect(matchWriteRepo.acquirePairTransactionLock).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'user-2',
    );
  });

  it('should reject if existing non-active match', async () => {
    setupValidMocks();
    matchWriteRepo.findMatchByPair.mockResolvedValue({
      status: 'UNMATCHED',
    } as any);
    await expect(
      service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any),
    ).rejects.toThrow(new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE));
  });

  it('should return no-op for identical swipe state', async () => {
    setupValidMocks();
    swipeReadRepo.findCurrentSwipeState.mockResolvedValue({
      currentAction: 'LIKE',
    } as any);

    const result = await service.processSwipe('user-1', {
      targetUserId: 'user-2',
      action: 'LIKE',
    } as any);

    expect(result).toEqual({
      targetUserId: 'user-2',
      action: 'LIKE',
      matched: false,
      matchId: null,
    });
    expect(swipeWriteRepo.createSwipeEvent).not.toHaveBeenCalled();
    expect(swipeWriteRepo.upsertSwipeState).not.toHaveBeenCalled();
  });

  it('should process non-idempotent PASS', async () => {
    setupValidMocks();
    swipeWriteRepo.createSwipeEvent.mockResolvedValue({ id: 'event-1' } as any);

    const result = await service.processSwipe('user-1', {
      targetUserId: 'user-2',
      action: 'PASS',
    } as any);

    expect(swipeWriteRepo.createSwipeEvent).toHaveBeenCalled();
    expect(swipeWriteRepo.upsertSwipeState).toHaveBeenCalled();
    expect(swipeReadRepo.findReciprocalPositiveState).not.toHaveBeenCalled();
    expect(result).toEqual({
      targetUserId: 'user-2',
      action: 'PASS',
      matched: false,
      matchId: null,
    });
  });

  it('should process LIKE without reciprocal positive', async () => {
    setupValidMocks();
    swipeWriteRepo.createSwipeEvent.mockResolvedValue({ id: 'event-1' } as any);
    swipeReadRepo.findReciprocalPositiveState.mockResolvedValue(null);

    const result = await service.processSwipe('user-1', {
      targetUserId: 'user-2',
      action: 'LIKE',
    } as any);

    expect(swipeReadRepo.findReciprocalPositiveState).toHaveBeenCalled();
    expect(matchCreationService.createMatchPair).not.toHaveBeenCalled();
    expect(result).toEqual({
      targetUserId: 'user-2',
      action: 'LIKE',
      matched: false,
      matchId: null,
    });
  });

  it('should process LIKE with reciprocal positive and create match', async () => {
    setupValidMocks();
    swipeWriteRepo.createSwipeEvent.mockResolvedValue({ id: 'event-1' } as any);
    swipeReadRepo.findReciprocalPositiveState.mockResolvedValue({} as any);
    matchCreationService.createMatchPair.mockResolvedValue({
      id: 'match-1',
    } as any);

    const result = await service.processSwipe('user-1', {
      targetUserId: 'user-2',
      action: 'LIKE',
    } as any);

    expect(matchCreationService.createMatchPair).toHaveBeenCalled();
    expect(result).toEqual({
      targetUserId: 'user-2',
      action: 'LIKE',
      matched: true,
      matchId: 'match-1',
    });
  });

  it('should create reciprocal positive match', async () => {
    setupValidMocks();
    swipeReadRepo.findReciprocalPositiveState.mockResolvedValue({
      currentAction: 'LIKE',
    } as any);
    const mockMatch = { id: 'match-xyz' } as any;
    matchCreationService.createMatchPair.mockResolvedValue(mockMatch);
    swipeWriteRepo.createSwipeEvent.mockResolvedValue({ id: 'event-1' } as any);

    const result = await service.processSwipe('user-1', {
      targetUserId: 'user-2',
      action: 'LIKE',
    } as any);
    expect(matchCreationService.createMatchPair).toHaveBeenCalledWith(
      expect.anything(),
      {
        requesterId: 'user-1',
        targetUserId: 'user-2',
        occurredAt: expect.any(Date),
      },
    );
    expect(result.matched).toBe(true);
    expect(result.matchId).toBe('match-xyz');
  });

  describe('concurrency and transaction lock order', () => {
    it('should acquire pair transaction lock before any state checks or mutations', async () => {
      setupValidMocks();
      swipeWriteRepo.createSwipeEvent.mockResolvedValue({
        id: 'event-1',
      } as any);

      const order: string[] = [];
      matchWriteRepo.acquirePairTransactionLock.mockImplementation(async () => {
        order.push('lock');
      });
      matchWriteRepo.findMatchByPair.mockImplementation(async () => {
        order.push('existingMatchCheck');
        return null;
      });
      swipeReadRepo.findCurrentSwipeState.mockImplementation(async () => {
        order.push('swipeStateCheck');
        return null;
      });
      swipeWriteRepo.createSwipeEvent.mockImplementation(async () => {
        order.push('eventInsert');
        return { id: 'evt' };
      });
      swipeWriteRepo.upsertSwipeState.mockImplementation(async () => {
        order.push('stateUpsert');
      });
      swipeReadRepo.findReciprocalPositiveState.mockImplementation(async () => {
        order.push('reciprocalCheck');
        return null;
      });

      await service.processSwipe('user-1', {
        targetUserId: 'user-2',
        action: 'LIKE',
      } as any);

      expect(order).toEqual([
        'lock',
        'existingMatchCheck',
        'swipeStateCheck',
        'eventInsert',
        'stateUpsert',
        'reciprocalCheck',
      ]);
    });
  });

  describe('runtime action guards', () => {
    it('should reject REWIND before transaction', async () => {
      await expect(
        service.processSwipe('user-1', {
          targetUserId: 'user-2',
          action: 'REWIND',
        } as any),
      ).rejects.toThrow(
        new SwipeException(SwipeErrorCode.INVALID_SWIPE_ACTION),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject lowercase action before transaction', async () => {
      await expect(
        service.processSwipe('user-1', {
          targetUserId: 'user-2',
          action: 'like',
        } as any),
      ).rejects.toThrow(
        new SwipeException(SwipeErrorCode.INVALID_SWIPE_ACTION),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject random action before transaction', async () => {
      await expect(
        service.processSwipe('user-1', {
          targetUserId: 'user-2',
          action: 'RANDOM_STUFF',
        } as any),
      ).rejects.toThrow(
        new SwipeException(SwipeErrorCode.INVALID_SWIPE_ACTION),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
