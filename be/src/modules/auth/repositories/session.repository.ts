import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface SessionEntity {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name);
  private readonly sessions: Map<string, SessionEntity> = new Map();

  async create(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<SessionEntity> {
    const session: SessionEntity = {
      id: randomUUID(),
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      userAgent: data.userAgent ?? null,
      ipAddress: data.ipAddress ?? null,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    this.logger.debug(`[MOCK] Session created: ${session.id}`);
    return { ...session };
  }

  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    for (const session of this.sessions.values()) {
      if (session.refreshTokenHash === tokenHash) {
        return { ...session };
      }
    }
    return null;
  }

  async deleteById(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteAllByUserId(userId: string): Promise<number> {
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        count++;
      }
    }
    this.logger.debug(
      `[MOCK] Deleted ${count} sessions for user: ${userId}`,
    );
    return count;
  }

  async updateTokenHash(
    id: string,
    newTokenHash: string,
    newExpiresAt: Date,
  ): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.refreshTokenHash = newTokenHash;
      session.expiresAt = newExpiresAt;
    }
  }

  /**
   * Check if an old (rotated) token hash was reused — UC014 Reuse Detection
   */
  async wasTokenHashEverUsed(tokenHash: string): Promise<boolean> {
    // In mock mode, rotated tokens are deleted, so if not found it was either
    // never valid or was rotated away. Real DB would keep an audit log.
    return false;
  }
}
