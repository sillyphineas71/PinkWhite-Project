import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { hashToken } from '../utils/hash.util';

export interface SessionEntity {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipHash: string | null;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    data: {
      id?: string;
      userId: string;
      refreshTokenHash: string;
      userAgent?: string;
      ipAddress?: string;
      expiresAt: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<SessionEntity> {
    const client = this.client(tx);
    const session = await client.userSession.create({
      data: {
        id: data.id ?? crypto.randomUUID(),
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        refreshTokenFamilyId: crypto.randomUUID(),
        sessionStatus: 'ACTIVE',
        userAgent: data.userAgent ?? null,
        ipHash: data.ipAddress ? hashToken(data.ipAddress) : null,
        expiresAt: data.expiresAt,
      },
    });
    this.logger.debug(`Session created: ${session.id}`);
    return this.toEntity(session);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
    });
    return session ? this.toEntity(session) : null;
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { id },
    });
    return session ? this.toEntity(session) : null;
  }

  async findActiveById(id: string): Promise<SessionEntity | null> {
    const session = await this.prisma.userSession.findFirst({
      where: { id, sessionStatus: 'ACTIVE' },
    });
    return session ? this.toEntity(session) : null;
  }

  async deleteById(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    await client.userSession.update({
      where: { id },
      data: {
        sessionStatus: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: 'legacy_delete_by_id',
      },
    });
  }

  async revokeAllByUserId(userId: string, reason: string = 'logout_all', tx?: Prisma.TransactionClient): Promise<number> {
    const client = this.client(tx);
    const result = await client.userSession.updateMany({
      where: { userId, sessionStatus: 'ACTIVE' },
      data: {
        sessionStatus: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
    this.logger.debug(`Revoked ${result.count} sessions for user: ${userId} with reason: ${reason}`);
    return result.count;
  }
  async updateTokenHash(
    id: string,
    newTokenHash: string,
    newExpiresAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    await client.userSession.update({
      where: { id },
      data: {
        refreshTokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async rotateRefreshTokenHash(
    params: {
      sessionId: string;
      userId: string;
      oldRefreshTokenHash: string;
      newRefreshTokenHash: string;
      now?: Date;
      tx?: Prisma.TransactionClient;
    }
  ): Promise<boolean> {
    const client = this.client(params.tx);
    const now = params.now ?? new Date();

    const result = await client.userSession.updateMany({
      where: {
        id: params.sessionId,
        userId: params.userId,
        refreshTokenHash: params.oldRefreshTokenHash,
        sessionStatus: 'ACTIVE',
        expiresAt: {
          gt: now,
        },
      },
      data: {
        refreshTokenHash: params.newRefreshTokenHash,
        lastUsedAt: now,
      },
    });

    return result.count === 1;
  }

  async revokeById(id: string, reason: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    await client.userSession.update({
      where: { id },
      data: {
        sessionStatus: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }


  async markCompromised(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    await client.userSession.update({
      where: { id },
      data: { sessionStatus: 'COMPROMISED' },
    });
  }

  async wasTokenHashEverUsed(tokenHash: string): Promise<boolean> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
    });
    return session !== null;
  }

  private toEntity(session: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipHash: string | null;
    expiresAt: Date;
    createdAt: Date;
  }): SessionEntity {
    return {
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      userAgent: session.userAgent,
      ipHash: session.ipHash,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}