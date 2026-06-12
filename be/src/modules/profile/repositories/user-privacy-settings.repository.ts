import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface UserPrivacySettingsEntity {
  id: string;
  userId: string;
  isHidden: boolean;
  showDistance: boolean;
  showOnlineStatus: boolean;
  showLastActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserPrivacySettingsRepository {
  private readonly logger = new Logger(UserPrivacySettingsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserPrivacySettingsEntity> {
    const client = this.client(tx);
    const settings = await client.userPrivacySettings.create({
      data: {
        userId,
        // Conservative defaults per requirement 7
        isHidden: false,
        showDistance: true,
        showOnlineStatus: true,
        showLastActive: true,
      },
    });

    this.logger.debug(`Privacy settings created for user: ${userId}`);
    return this.toEntity(settings);
  }

  async findByUserId(
    userId: string,
  ): Promise<UserPrivacySettingsEntity | null> {
    const settings = await this.prisma.userPrivacySettings.findUnique({
      where: { userId },
    });
    return settings ? this.toEntity(settings) : null;
  }

  async update(
    userId: string,
    data: Partial<
      Omit<
        UserPrivacySettingsEntity,
        'id' | 'userId' | 'createdAt' | 'updatedAt'
      >
    >,
    tx?: Prisma.TransactionClient,
  ): Promise<UserPrivacySettingsEntity | null> {
    const client = this.client(tx);

    try {
      const settings = await client.userPrivacySettings.update({
        where: { userId },
        data,
      });
      this.logger.debug(`Privacy settings updated for user: ${userId}`);
      return this.toEntity(settings);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
        return null;
      }
      throw e;
    }
  }

  async upsert(
    userId: string,
    data: Partial<
      Omit<
        UserPrivacySettingsEntity,
        'id' | 'userId' | 'createdAt' | 'updatedAt'
      >
    >,
    tx?: Prisma.TransactionClient,
  ): Promise<UserPrivacySettingsEntity> {
    const client = this.client(tx);
    const settings = await client.userPrivacySettings.upsert({
      where: { userId },
      create: {
        userId,
        isHidden: data.isHidden ?? false,
        showDistance: data.showDistance ?? true,
        showOnlineStatus: data.showOnlineStatus ?? true,
        showLastActive: data.showLastActive ?? true,
      },
      update: data,
    });
    return this.toEntity(settings);
  }

  private toEntity(settings: any): UserPrivacySettingsEntity {
    return {
      id: settings.id,
      userId: settings.userId,
      isHidden: settings.isHidden,
      showDistance: settings.showDistance,
      showOnlineStatus: settings.showOnlineStatus,
      showLastActive: settings.showLastActive,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}
