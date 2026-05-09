import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Gender } from '../dto/profile.dto';

export interface ProfileEntity {
  id: string;
  userId: string;
  fullName: string;
  dob: Date;
  gender: Gender;
  searchGender: Gender | null;
  dobUpdatedAt: Date | null;
  genderUpdatedAt: Date | null;
  bio: string | null;
  company: string | null;
  jobTitle: string | null;
  school: string | null;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProfileRepository {
  private readonly logger = new Logger(ProfileRepository.name);
  private readonly profiles: Map<string, ProfileEntity> = new Map();

  async create(data: Partial<ProfileEntity>): Promise<ProfileEntity> {
    const now = new Date();
    const profile: ProfileEntity = {
      id: randomUUID(),
      userId: data.userId!,
      fullName: data.fullName!,
      dob: data.dob!,
      gender: data.gender!,
      searchGender: data.searchGender || null,
      dobUpdatedAt: now,
      genderUpdatedAt: now,
      bio: null,
      company: null,
      jobTitle: null,
      school: null,
      interests: [],
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.set(profile.userId, profile);
    this.logger.debug(`[MOCK] Profile created for userId: ${profile.userId}`);
    return { ...profile };
  }

  async findByUserId(userId: string): Promise<ProfileEntity | null> {
    const profile = this.profiles.get(userId);
    return profile ? { ...profile } : null;
  }

  async update(
    userId: string,
    data: Partial<ProfileEntity>,
  ): Promise<ProfileEntity | null> {
    const profile = this.profiles.get(userId);
    if (!profile) return null;

    Object.assign(profile, data);
    profile.updatedAt = new Date();

    this.logger.debug(`[MOCK] Profile updated for userId: ${userId}`);
    return { ...profile };
  }
}
