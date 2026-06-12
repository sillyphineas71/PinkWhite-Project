import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string | null;
  accountStatus: string; // 'ACTIVE', 'PENDING_EMAIL_VERIFICATION', 'SUSPENDED', 'BANNED', 'DELETED'
  isEmailVerified: boolean;
  isOnboarded: boolean;
  isBanned: boolean;
  isPremium: boolean;
  isHidden: boolean;
  deletedAt: Date | null;
  deletionScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    data: { email: string; passwordHash: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<UserEntity> {
    const client = this.client(tx);

    const execute = async (c: Prisma.TransactionClient) => {
      const user = await c.user.create({
        data: {
          email: data.email,
          emailNormalized: data.email.toLowerCase().trim(),
        },
      });

      // Create auth_identity when passwordHash is provided
      if (data.passwordHash) {
        await c.authIdentity.create({
          data: {
            userId: user.id,
            provider: 'EMAIL',
            providerUserId: data.email.toLowerCase().trim(),
            passwordHash: data.passwordHash,
          },
        });
      }

      return this.toEntity(user, data.passwordHash ?? null);
    };

    // If already in a transaction, reuse it; otherwise wrap in a new transaction
    if (tx) {
      return execute(client);
    }
    return this.prisma.$transaction(execute);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const emailNormalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      include: { authIdentities: { where: { provider: 'EMAIL' } } },
    });
    return user ? this.toEntityFull(user) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { authIdentities: { where: { provider: 'EMAIL' } } },
    });
    return user ? this.toEntityFull(user) : null;
  }

  async updatePasswordHash(
    id: string,
    passwordHash: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    const identity = await client.authIdentity.findFirst({
      where: { userId: id, provider: 'EMAIL' },
    });
    if (identity) {
      await client.authIdentity.update({
        where: { id: identity.id },
        data: { passwordHash },
      });
    }
  }

  async setEmailVerified(
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    const emailNormalized = email.toLowerCase().trim();
    await client.user.update({
      where: { emailNormalized },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async softDelete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    await client.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        accountStatus: 'DELETED',
      },
    });
  }

  async restore(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    const user = await client.user.findUnique({ where: { id } });
    if (!user) return;
    await client.user.update({
      where: { id },
      data: {
        deletedAt: null,
        deletionScheduledAt: null,
        accountStatus: user.emailVerifiedAt
          ? 'ACTIVE'
          : 'PENDING_EMAIL_VERIFICATION',
      },
    });
  }

  async setIsOnboarded(
    id: string,
    value: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    await client.user.update({
      where: { id },
      data: {
        onboardingStatus: value ? 'COMPLETED' : 'IN_PROGRESS',
        onboardingCompletedAt: value ? new Date() : null,
      },
    });
  }

  async setIsHidden(
    id: string,
    value: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    await client.userPrivacySettings.upsert({
      where: { userId: id },
      create: {
        userId: id,
        isHidden: value,
        showDistance: true,
        showOnlineStatus: true,
        showLastActive: true,
      },
      update: { isHidden: value },
    });
  }

  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      include: { authIdentities: { where: { provider: 'EMAIL' } } },
    });
    return users.map((u: any) => this.toEntityFull(u));
  }

  // ---- Mapping helpers ----

  private toEntity(
    user: {
      id: string;
      email: string;
      emailVerifiedAt: Date | null;
      accountStatus: string;
      onboardingStatus: string;
      deletedAt: Date | null;
      deletionScheduledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    passwordHash: string | null,
  ): UserEntity {
    return {
      id: user.id,
      email: user.email,
      passwordHash,
      accountStatus: user.accountStatus,
      isEmailVerified: user.emailVerifiedAt !== null,
      isOnboarded: user.onboardingStatus === 'COMPLETED',
      isBanned: user.accountStatus === 'BANNED',
      isPremium: false,
      isHidden: false,
      deletedAt: user.deletedAt,
      deletionScheduledAt: user.deletionScheduledAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toEntityFull(user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
    accountStatus: string;
    onboardingStatus: string;
    deletedAt: Date | null;
    deletionScheduledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    authIdentities: Array<{ passwordHash: string | null }>;
  }): UserEntity {
    const emailIdentity = user.authIdentities?.[0];
    return {
      id: user.id,
      email: user.email,
      passwordHash: emailIdentity?.passwordHash ?? null,
      accountStatus: user.accountStatus,
      isEmailVerified: user.emailVerifiedAt !== null,
      isOnboarded: user.onboardingStatus === 'COMPLETED',
      isBanned: user.accountStatus === 'BANNED',
      isPremium: false,
      isHidden: false,
      deletedAt: user.deletedAt,
      deletionScheduledAt: user.deletionScheduledAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
