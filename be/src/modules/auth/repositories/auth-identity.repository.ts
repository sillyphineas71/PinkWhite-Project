import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface AuthIdentityEntity {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthIdentityRepository {
  private readonly logger = new Logger(AuthIdentityRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    data: {
      userId: string;
      provider: string;
      providerUserId: string;
      passwordHash: string | null;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<AuthIdentityEntity> {
    const client = this.client(tx);
    const identity = await client.authIdentity.create({
      data: {
        userId: data.userId,
        provider: data.provider as any,
        providerUserId: data.providerUserId,
        passwordHash: data.passwordHash,
      },
    });
    return this.toEntity(identity);
  }

  async findByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<AuthIdentityEntity | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: provider as any,
          providerUserId,
        },
      },
    });
    return identity ? this.toEntity(identity) : null;
  }

  async findByUserId(userId: string): Promise<AuthIdentityEntity[]> {
    const identities = await this.prisma.authIdentity.findMany({
      where: { userId },
    });
    return identities.map((i: any) => this.toEntity(i));
  }

  async updatePasswordHash(
    userId: string,
    provider: string,
    passwordHash: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    const result = await client.authIdentity.updateMany({
      where: { userId, provider: provider as any },
      data: { passwordHash },
    });
    if (result.count === 0) {
      this.logger.warn(
        `No identity found for user ${userId} / provider ${provider}`,
      );
    }
  }

  async deleteByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    await client.authIdentity.deleteMany({
      where: { userId },
    });
  }

  private toEntity(identity: {
    id: string;
    userId: string;
    provider: string;
    providerUserId: string;
    passwordHash: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AuthIdentityEntity {
    return {
      id: identity.id,
      userId: identity.userId,
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      passwordHash: identity.passwordHash,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    };
  }
}
