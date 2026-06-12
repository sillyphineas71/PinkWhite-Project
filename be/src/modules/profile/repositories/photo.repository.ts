import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface PhotoEntity {
  id: string;
  userId: string;
  url: string;
  order: number;
  isAvatar: boolean;
  createdAt: Date;
}

@Injectable()
export class PhotoRepository {
  private readonly logger = new Logger(PhotoRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    userId: string,
    url: string,
    isAvatar: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<PhotoEntity> {
    const client = this.client(tx);

    const userPhotos = await this.findByUserId(userId);
    const maxOrder =
      userPhotos.length > 0 ? Math.max(...userPhotos.map((p) => p.order)) : -1;

    if (isAvatar) {
      await client.profilePhoto.updateMany({
        where: { userId },
        data: { isAvatar: false, sortOrder: { increment: 1 } },
      });
    }

    const photo = await client.profilePhoto.create({
      data: {
        userId,
        publicUrl: url,
        storageProvider: 'LEGACY',
        storageKey: url,
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        sortOrder: isAvatar ? 0 : maxOrder + 1,
        isAvatar,
        uploadStatus: 'CONFIRMED',
        moderationStatus: 'APPROVED',
      },
    });

    this.logger.debug(`Photo created: ${photo.id}`);
    return this.toEntity(photo);
  }

  async findByUserId(userId: string): Promise<PhotoEntity[]> {
    const photos = await this.prisma.profilePhoto.findMany({
      where: { userId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return photos.map((p: any) => this.toEntity(p));
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.profilePhoto.count({
      where: { userId, deletedAt: null },
    });
  }

  async findById(id: string): Promise<PhotoEntity | null> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id },
    });
    if (!photo || photo.deletedAt) return null;
    return this.toEntity(photo);
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = this.client(tx);
    await client.profilePhoto.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateOrder(
    userId: string,
    photoIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);

    // Process one by one to set correct order and avatar status
    for (let index = 0; index < photoIds.length; index++) {
      const id = photoIds[index];
      await client.profilePhoto.updateMany({
        where: { id, userId, deletedAt: null },
        data: {
          sortOrder: index,
          isAvatar: index === 0,
        },
      });
    }
  }

  async normalizeOrder(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    const userPhotos = await this.findByUserId(userId);

    for (let index = 0; index < userPhotos.length; index++) {
      const photo = userPhotos[index];
      await client.profilePhoto.update({
        where: { id: photo.id },
        data: {
          sortOrder: index,
          isAvatar: index === 0,
        },
      });
    }
  }

  async findAll(): Promise<PhotoEntity[]> {
    throw new NotImplementedException('FindAll not supported for photos');
  }

  private toEntity(photo: any): PhotoEntity {
    return {
      id: photo.id,
      userId: photo.userId,
      url: photo.publicUrl || photo.storageKey,
      order: photo.sortOrder,
      isAvatar: photo.isAvatar,
      createdAt: photo.createdAt,
    };
  }
}
