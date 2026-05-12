import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PreferenceEntity {
  id: string;
  userId: string;
  minAge: number;
  maxAge: number;
  genderFilter: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'ALL';
  maxDistance: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PreferenceRepository {
  private readonly logger = new Logger(PreferenceRepository.name);
  private readonly preferences: Map<string, PreferenceEntity> = new Map();

  async create(data: Omit<PreferenceEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<PreferenceEntity> {
    const now = new Date();
    const preference: PreferenceEntity = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.preferences.set(preference.id, preference);
    this.logger.debug(`[MOCK] Preference created for user: ${data.userId}`);
    return { ...preference };
  }

  async findByUserId(userId: string): Promise<PreferenceEntity | null> {
    for (const pref of this.preferences.values()) {
      if (pref.userId === userId) {
        return { ...pref };
      }
    }
    return null;
  }

  async update(id: string, data: Partial<Omit<PreferenceEntity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<PreferenceEntity | null> {
    const preference = this.preferences.get(id);
    if (!preference) return null;

    Object.assign(preference, data);
    preference.updatedAt = new Date();
    this.preferences.set(id, preference);

    this.logger.debug(`[MOCK] Preference updated for user: ${preference.userId}`);
    return { ...preference };
  }
}
