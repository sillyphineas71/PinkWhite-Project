import { Injectable } from '@nestjs/common';
import { Prisma, SwipeAction } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class SwipeWriteRepository {
  async createSwipeEvent(tx: TxClient, requesterId: string, targetUserId: string, action: SwipeAction, now: Date) {
    return tx.swipeEvent.create({
      data: {
        swiperId: requesterId,
        targetUserId: targetUserId,
        action: action,
        status: 'ACTIVE',
        createdAt: now
      }
    });
  }

  async upsertSwipeState(tx: TxClient, requesterId: string, targetUserId: string, action: SwipeAction, swipeEventId: string, now: Date) {
    // Note: action is safely cast since we only expect LIKE, PASS, SUPER_LIKE at this layer.
    return tx.swipeState.upsert({
      where: {
        swiperId_targetUserId: {
          swiperId: requesterId,
          targetUserId: targetUserId
        }
      },
      update: {
        currentAction: action as any,
        lastSwipeEventId: swipeEventId,
        lastSwipedAt: now,
        updatedAt: now
      },
      create: {
        swiperId: requesterId,
        targetUserId: targetUserId,
        currentAction: action as any,
        lastSwipeEventId: swipeEventId,
        lastSwipedAt: now,
        createdAt: now,
        updatedAt: now
      }
    });
  }
}
