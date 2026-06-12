import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class SwipeReadRepository {
  async findRequesterEligibility(tx: TxClient, requesterId: string) {
    return tx.user.findUnique({
      where: { id: requesterId },
      select: {
        id: true,
        accountStatus: true,
        deletedAt: true,
        emailVerifiedAt: true,
        onboardingStatus: true,
        privacySettings: {
          select: { isHidden: true }
        },
        location: {
          select: { activeLocationMode: true }
        },
        discoveryPreference: {
          select: { id: true }
        }
      }
    });
  }

  async hasActiveRealLocation(tx: TxClient, userId: string): Promise<boolean> {
    const result = await tx.$queryRaw<Array<{ '?column?': number }>>`
      SELECT 1
      FROM user_locations
      WHERE user_id = ${userId}::uuid
        AND active_location_mode = 'real'
        AND real_location IS NOT NULL
      LIMIT 1
    `;
    return result.length > 0;
  }

  async findTargetEligibility(tx: TxClient, targetUserId: string) {
    return tx.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        accountStatus: true,
        deletedAt: true,
        emailVerifiedAt: true,
        onboardingStatus: true,
        privacySettings: {
          select: { isHidden: true }
        },
        profile: {
          select: { id: true, displayName: true, dob: true, gender: true, relationshipGoal: true }
        },
        photos: {
          where: {
            deletedAt: null,
            uploadStatus: 'CONFIRMED',
            moderationStatus: 'APPROVED',
            publicUrl: { not: null },
            NOT: { publicUrl: '' }
          },
          select: { id: true },
          take: 1
        }
      }
    });
  }

  async findCurrentSwipeState(tx: TxClient, requesterId: string, targetUserId: string) {
    return tx.swipeState.findUnique({
      where: {
        swiperId_targetUserId: {
          swiperId: requesterId,
          targetUserId: targetUserId
        }
      }
    });
  }

  async findReciprocalPositiveState(tx: TxClient, requesterId: string, targetUserId: string) {
    return tx.swipeState.findFirst({
      where: {
        swiperId: targetUserId,
        targetUserId: requesterId,
        currentAction: {
          in: ['LIKE', 'SUPER_LIKE']
        }
      }
    });
  }

  async findBlockEitherDirection(tx: TxClient, requesterId: string, targetUserId: string) {
    const block = await tx.userBlock.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [
          { blockerId: requesterId, blockedUserId: targetUserId },
          { blockerId: targetUserId, blockedUserId: requesterId }
        ]
      },
      select: { id: true }
    });
    return block !== null;
  }
}
