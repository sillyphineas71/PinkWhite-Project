import { Injectable } from '@nestjs/common';
import { CreateSwipeDto } from '../dto/create-swipe.dto';
import { SwipeResponseDto } from '../dto/swipe-response.dto';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;
import { SwipeReadRepository } from '../repositories/swipe-read.repository';
import { SwipeWriteRepository } from '../repositories/swipe-write.repository';
import { MatchWriteRepository } from '../../match/repositories/match-write.repository';
import { MatchCreationService } from '../../match/services/match-creation.service';
import { MatchException, MatchErrorCode } from '../../match/match.types';
import { SwipeException, SwipeErrorCode } from '../swipe.types';

@Injectable()
export class SwipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly swipeReadRepo: SwipeReadRepository,
    private readonly swipeWriteRepo: SwipeWriteRepository,
    private readonly matchWriteRepo: MatchWriteRepository,
    private readonly matchCreationService: MatchCreationService,
  ) {}

  async processSwipe(
    requesterId: string,
    dto: CreateSwipeDto,
  ): Promise<SwipeResponseDto> {
    const { targetUserId, action } = dto;

    const allowedActions = ['PASS', 'LIKE', 'SUPER_LIKE'];
    if (!allowedActions.includes(action)) {
      throw new SwipeException(SwipeErrorCode.INVALID_SWIPE_ACTION);
    }

    // 1. Reject self swipe.
    if (requesterId === targetUserId) {
      throw new SwipeException(SwipeErrorCode.SELF_SWIPE_NOT_ALLOWED);
    }

    return this.prisma.$transaction(async (tx: TxClient) => {
      // 2. Validate requester eligibility.
      const requester = await this.swipeReadRepo.findRequesterEligibility(
        tx,
        requesterId,
      );
      if (
        !requester ||
        requester.accountStatus !== 'ACTIVE' ||
        requester.deletedAt !== null ||
        requester.emailVerifiedAt === null ||
        requester.onboardingStatus !== 'COMPLETED' ||
        !requester.privacySettings ||
        requester.privacySettings.isHidden === true ||
        !requester.location ||
        requester.location.activeLocationMode !== 'REAL' ||
        !requester.discoveryPreference
      ) {
        throw new SwipeException(SwipeErrorCode.SWIPE_NOT_ALLOWED);
      }

      const hasRealLocation = await this.swipeReadRepo.hasActiveRealLocation(
        tx,
        requesterId,
      );
      if (!hasRealLocation) {
        throw new SwipeException(SwipeErrorCode.SWIPE_NOT_ALLOWED);
      }

      // 3. Validate target eligibility.
      const target = await this.swipeReadRepo.findTargetEligibility(
        tx,
        targetUserId,
      );
      if (
        !target ||
        target.accountStatus !== 'ACTIVE' ||
        target.deletedAt !== null ||
        target.emailVerifiedAt === null ||
        target.onboardingStatus !== 'COMPLETED' ||
        !target.privacySettings ||
        target.privacySettings.isHidden === true ||
        !target.profile ||
        !target.profile.displayName ||
        target.profile.displayName.trim() === '' ||
        !target.profile.dob ||
        !target.profile.gender ||
        !target.profile.relationshipGoal ||
        !target.photos ||
        target.photos.length === 0
      ) {
        throw new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE);
      }

      // 4. Check block either direction.
      const isBlocked = await this.swipeReadRepo.findBlockEitherDirection(
        tx,
        requesterId,
        targetUserId,
      );
      if (isBlocked) {
        throw new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE);
      }

      // 4.5 Acquire pair-level lock to prevent concurrent match creation race conditions.
      await this.matchWriteRepo.acquirePairTransactionLock(
        tx,
        requesterId,
        targetUserId,
      );

      // 5. Check any existing match record.
      const existingMatch = await this.matchWriteRepo.findMatchByPair(
        tx,
        requesterId,
        targetUserId,
      );
      if (existingMatch) {
        if (existingMatch.status === 'ACTIVE') {
          throw new SwipeException(SwipeErrorCode.ALREADY_MATCHED);
        } else {
          throw new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE);
        }
      }

      // 7. Check current swipe_state requester -> target.
      const currentState = await this.swipeReadRepo.findCurrentSwipeState(
        tx,
        requesterId,
        targetUserId,
      );

      // 8. If currentAction equals requested action (Idempotent success)
      // Note: cast currentState.currentAction because Prisma defines CurrentSwipeAction for state but SwipeAction for events
      if (currentState && (currentState.currentAction as string) === action) {
        return {
          targetUserId,
          action,
          matched: false,
          matchId: null,
        };
      }

      // 9. If currentAction differs or no state exists
      const now = new Date();
      const actionForPrisma = action as any;
      const event = await this.swipeWriteRepo.createSwipeEvent(
        tx,
        requesterId,
        targetUserId,
        actionForPrisma,
        now,
      );
      await this.swipeWriteRepo.upsertSwipeState(
        tx,
        requesterId,
        targetUserId,
        actionForPrisma,
        event.id,
        now,
      );

      // 10. If action is PASS
      if (action === 'PASS') {
        return {
          targetUserId,
          action,
          matched: false,
          matchId: null,
        };
      }

      // 11. If action is LIKE/SUPER_LIKE: check reciprocal positive state target -> requester
      const reciprocalState =
        await this.swipeReadRepo.findReciprocalPositiveState(
          tx,
          requesterId,
          targetUserId,
        );

      // 12. If no reciprocal positive
      if (!reciprocalState) {
        return {
          targetUserId,
          action,
          matched: false,
          matchId: null,
        };
      }

      // 13. If reciprocal positive exists: call MatchCreationService inside same transaction
      try {
        const match = await this.matchCreationService.createMatchPair(tx, {
          requesterId,
          targetUserId,
          occurredAt: now,
        });

        return {
          targetUserId,
          action,
          matched: true,
          matchId: match.id,
        };
      } catch (error: any) {
        if (
          error instanceof MatchException &&
          error.code === MatchErrorCode.TARGET_NOT_AVAILABLE
        ) {
          throw new SwipeException(SwipeErrorCode.TARGET_NOT_AVAILABLE);
        }
        throw error;
      }
    });
  }
}
