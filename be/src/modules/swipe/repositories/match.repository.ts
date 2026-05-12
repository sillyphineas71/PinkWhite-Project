import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface MatchEntity {
  id: string;
  userAId: string; // userAId < userBId lexicographically
  userBId: string;
  createdAt: Date;
}

@Injectable()
export class MatchRepository {
  private readonly logger = new Logger(MatchRepository.name);
  private readonly matches: Map<string, MatchEntity> = new Map();

  // Helper to ensure consistent ordering
  private getPair(userId1: string, userId2: string): { userA: string; userB: string } {
    return userId1 < userId2
      ? { userA: userId1, userB: userId2 }
      : { userA: userId2, userB: userId1 };
  }

  async create(userId1: string, userId2: string): Promise<MatchEntity> {
    const { userA, userB } = this.getPair(userId1, userId2);
    
    // Simulate UNIQUE CONSTRAINT on (userA, userB)
    for (const match of this.matches.values()) {
      if (match.userAId === userA && match.userBId === userB) {
        this.logger.warn(`[MOCK] Unique Violation: Match already exists between ${userA} and ${userB}`);
        throw new Error('UNIQUE_VIOLATION');
      }
    }

    const match: MatchEntity = {
      id: randomUUID(),
      userAId: userA,
      userBId: userB,
      createdAt: new Date(),
    };

    this.matches.set(match.id, match);
    this.logger.debug(`[MOCK] Match created: ${userA} <-> ${userB}`);
    return { ...match };
  }

  async isMatch(userId1: string, userId2: string): Promise<boolean> {
    const { userA, userB } = this.getPair(userId1, userId2);
    for (const match of this.matches.values()) {
      if (match.userAId === userA && match.userBId === userB) {
        return true;
      }
    }
    return false;
  }
}
