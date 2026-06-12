import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
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

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(
    data: Partial<ProfileEntity>,
    tx?: Prisma.TransactionClient,
  ): Promise<ProfileEntity> {
    const client = this.client(tx);
    const profile = await client.profile.create({
      data: {
        userId: data.userId!,
        displayName: data.fullName!,
        dob: data.dob!,
        gender: data.gender as any,
        bio: null,
        company: null,
        jobTitle: null,
        school: null,
        // NOTE: STILL_FIGURING_OUT is a valid Phase 1 default that satisfies onboarding.
        // Explicit relationship goal selection can be revisited later if product requires it.
        relationshipGoal: 'STILL_FIGURING_OUT',
        interestsJson: [],
      },
    });

    this.logger.debug(`Profile created for userId: ${profile.userId}`);
    return this.toEntity(profile);
  }

  async findByUserId(userId: string): Promise<ProfileEntity | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    return profile ? this.toEntity(profile) : null;
  }

  async update(
    userId: string,
    data: Partial<ProfileEntity>,
    tx?: Prisma.TransactionClient,
  ): Promise<ProfileEntity | null> {
    const client = this.client(tx);

    // Convert entity data to Prisma data
    const updateData: any = {};
    if (data.fullName !== undefined) updateData.displayName = data.fullName;
    if (data.dob !== undefined) updateData.dob = data.dob;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
    if (data.school !== undefined) updateData.school = data.school;
    if (data.interests !== undefined) updateData.interestsJson = data.interests;

    try {
      const profile = await client.profile.update({
        where: { userId },
        data: updateData,
      });
      this.logger.debug(`Profile updated for userId: ${userId}`);
      return this.toEntity(profile);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async findAll(): Promise<ProfileEntity[]> {
    throw new NotImplementedException('FindAll not supported for profiles');
  }

  private toEntity(profile: any): ProfileEntity {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.displayName,
      dob: profile.dob,
      gender: profile.gender,
      searchGender: null, // Legacy field not in Prisma
      dobUpdatedAt: null, // Legacy field not in Prisma
      genderUpdatedAt: null, // Legacy field not in Prisma
      bio: profile.bio,
      company: profile.company,
      jobTitle: profile.jobTitle,
      school: profile.school,
      interests: (profile.interestsJson as string[]) || [],
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
