import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface ResetPasswordTokenEntity {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class ResetPasswordTokenRepository {
  private readonly logger = new Logger(ResetPasswordTokenRepository.name);
  private readonly tokens: Map<string, ResetPasswordTokenEntity> = new Map();

  async create(data: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ResetPasswordTokenEntity> {
    const token: ResetPasswordTokenEntity = {
      id: randomUUID(),
      email: data.email,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    this.tokens.set(token.id, token);
    this.logger.debug(`[MOCK] ResetPasswordToken created for: ${data.email}`);
    return { ...token };
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<ResetPasswordTokenEntity | null> {
    for (const token of this.tokens.values()) {
      if (token.tokenHash === tokenHash) {
        return { ...token };
      }
    }
    return null;
  }

  async deleteAllByEmail(email: string): Promise<void> {
    for (const [id, token] of this.tokens.entries()) {
      if (token.email === email) {
        this.tokens.delete(id);
      }
    }
  }

  async deleteById(id: string): Promise<void> {
    this.tokens.delete(id);
  }
}
