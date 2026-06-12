import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface SecurityTokenEntity {
  id: string;
  userId: string;
  tokenType: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class SecurityTokenRepository {
  private readonly logger = new Logger(SecurityTokenRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    data: {
      userId: string;
      tokenType: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<SecurityTokenEntity> {
    const client = this.client(tx);
    const token = await client.securityToken.create({
      data: {
        userId: data.userId,
        tokenType: data.tokenType as any,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
    this.logger.debug(`SecurityToken created: ${token.id}`);
    return this.toEntity(token);
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<SecurityTokenEntity | null> {
    const token = await this.prisma.securityToken.findUnique({
      where: { tokenHash },
    });
    return token ? this.toEntity(token) : null;
  }

  async findByUserIdAndType(
    userId: string,
    tokenType: string,
  ): Promise<SecurityTokenEntity[]> {
    const tokens = await this.prisma.securityToken.findMany({
      where: { userId, tokenType: tokenType as any },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((t: any) => this.toEntity(t));
  }

  async markUsed(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    await client.securityToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteAllByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    await client.securityToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async invalidateByUserIdAndType(
    userId: string,
    tokenType: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.client(tx);
    const result = await client.securityToken.updateMany({
      where: { userId, tokenType: tokenType as any, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count;
  }

  private toEntity(token: {
    id: string;
    userId: string;
    tokenType: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }): SecurityTokenEntity {
    return {
      id: token.id,
      userId: token.userId,
      tokenType: token.tokenType,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt,
      createdAt: token.createdAt,
    };
  }
}
