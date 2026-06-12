import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface SwipeEntity {
  id: string;
  swiperId: string;
  targetId: string;
  action: 'LIKE' | 'PASS' | 'SUPER_LIKE';
  message: string | null;
  createdAt: Date;
}

@Injectable()
export class SwipeRepository {
  private readonly logger = new Logger(SwipeRepository.name);
  private readonly swipes: Map<string, SwipeEntity> = new Map();

  async findSwipedTargetIds(userId: string): Promise<string[]> {
    const swipedIds = new Set<string>();
    for (const swipe of this.swipes.values()) {
      if (swipe.swiperId === userId) {
        swipedIds.add(swipe.targetId);
      }
    }
    return Array.from(swipedIds);
  }

  async create(
    swiperId: string,
    targetId: string,
    action: 'LIKE' | 'PASS' | 'SUPER_LIKE',
    message: string | null = null,
  ): Promise<SwipeEntity> {
    const swipe: SwipeEntity = {
      id: randomUUID(),
      swiperId,
      targetId,
      action,
      message,
      createdAt: new Date(),
    };
    // Upsert behavior: if user swiped this target before, override it
    for (const existing of this.swipes.values()) {
      if (existing.swiperId === swiperId && existing.targetId === targetId) {
        this.swipes.delete(existing.id);
      }
    }
    this.swipes.set(swipe.id, swipe);
    this.logger.debug(
      `[MOCK] Swipe ${action} created: ${swiperId} -> ${targetId}`,
    );
    return { ...swipe };
  }

  async countActionInLast24h(
    userId: string,
    action: 'LIKE' | 'SUPER_LIKE',
  ): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let count = 0;
    for (const swipe of this.swipes.values()) {
      if (
        swipe.swiperId === userId &&
        swipe.action === action &&
        swipe.createdAt >= twentyFourHoursAgo
      ) {
        count++;
      }
    }
    return count;
  }

  async findTargetAction(
    swiperId: string,
    targetId: string,
  ): Promise<'LIKE' | 'PASS' | 'SUPER_LIKE' | null> {
    for (const swipe of this.swipes.values()) {
      if (swipe.swiperId === swiperId && swipe.targetId === targetId) {
        return swipe.action;
      }
    }
    return null;
  }

  async findLastSwipe(userId: string): Promise<SwipeEntity | null> {
    let lastSwipe: SwipeEntity | null = null;
    for (const swipe of this.swipes.values()) {
      if (swipe.swiperId === userId) {
        if (!lastSwipe || swipe.createdAt > lastSwipe.createdAt) {
          lastSwipe = swipe;
        }
      }
    }
    return lastSwipe ? { ...lastSwipe } : null;
  }

  async delete(id: string): Promise<void> {
    this.swipes.delete(id);
  }

  async findWhoLikedMe(userId: string): Promise<SwipeEntity[]> {
    const result = [];
    for (const swipe of this.swipes.values()) {
      if (
        swipe.targetId === userId &&
        (swipe.action === 'LIKE' || swipe.action === 'SUPER_LIKE')
      ) {
        result.push({ ...swipe });
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findPassHistory(userId: string): Promise<SwipeEntity[]> {
    const result = [];
    for (const swipe of this.swipes.values()) {
      if (swipe.swiperId === userId && swipe.action === 'PASS') {
        result.push({ ...swipe });
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findAllMutualLikesWithoutMatch(): Promise<
    { userA: string; userB: string }[]
  > {
    // This is a slow mock implementation just for the cronjob
    const likes = Array.from(this.swipes.values()).filter(
      (s) => s.action === 'LIKE' || s.action === 'SUPER_LIKE',
    );
    const pairs = new Set<string>();

    for (const likeA of likes) {
      for (const likeB of likes) {
        if (
          likeA.swiperId === likeB.targetId &&
          likeA.targetId === likeB.swiperId
        ) {
          // It's a mutual like
          const userA =
            likeA.swiperId < likeB.swiperId ? likeA.swiperId : likeB.swiperId;
          const userB =
            likeA.swiperId < likeB.swiperId ? likeB.swiperId : likeA.swiperId;
          pairs.add(`${userA}:${userB}`);
        }
      }
    }

    return Array.from(pairs).map((pair) => {
      const [userA, userB] = pair.split(':');
      return { userA, userB };
    });
  }
}
