import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

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
  private readonly photos: Map<string, PhotoEntity> = new Map();

  async create(
    userId: string,
    url: string,
    isAvatar: boolean,
  ): Promise<PhotoEntity> {
    const userPhotos = await this.findByUserId(userId);
    const maxOrder =
      userPhotos.length > 0 ? Math.max(...userPhotos.map((p) => p.order)) : -1;

    const photo: PhotoEntity = {
      id: randomUUID(),
      userId,
      url,
      order: maxOrder + 1,
      isAvatar,
      createdAt: new Date(),
    };

    if (isAvatar) {
      // Set all other photos to false
      userPhotos.forEach((p) => {
        const existing = this.photos.get(p.id);
        if (existing) existing.isAvatar = false;
      });
      // Prepend it (order 0) and shift others
      photo.order = 0;
      userPhotos.forEach((p) => {
        const existing = this.photos.get(p.id);
        if (existing) existing.order += 1;
      });
    }

    this.photos.set(photo.id, photo);
    this.logger.debug(`[MOCK] Photo created: ${photo.id}`);
    return { ...photo };
  }

  async findByUserId(userId: string): Promise<PhotoEntity[]> {
    return Array.from(this.photos.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ ...p }));
  }

  async countByUserId(userId: string): Promise<number> {
    return Array.from(this.photos.values()).filter((p) => p.userId === userId)
      .length;
  }

  async findById(id: string): Promise<PhotoEntity | null> {
    const photo = this.photos.get(id);
    return photo ? { ...photo } : null;
  }

  async delete(id: string): Promise<void> {
    this.photos.delete(id);
  }

  async updateOrder(userId: string, photoIds: string[]): Promise<void> {
    const userPhotos = Array.from(this.photos.values()).filter(
      (p) => p.userId === userId,
    );

    photoIds.forEach((id, index) => {
      const photo = this.photos.get(id);
      if (photo) {
        photo.order = index;
        photo.isAvatar = index === 0;
      }
    });
  }

  async normalizeOrder(userId: string): Promise<void> {
    const userPhotos = Array.from(this.photos.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => a.order - b.order);

    userPhotos.forEach((photo, index) => {
      photo.order = index;
      photo.isAvatar = index === 0;
    });
  }
}
