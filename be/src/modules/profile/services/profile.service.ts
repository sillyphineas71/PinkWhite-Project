import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ProfileRepository,
  ProfileEntity,
} from '../repositories/profile.repository';
import {
  OnboardingDto,
  UpdateBasicInfoDto,
  UpdateBioInterestsDto,
  UpdateEducationJobDto,
} from '../dto/profile.dto';

import { UserRepository } from '../../auth/repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly profileRepo: ProfileRepository,
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  private hasProfanityOrUrl(text: string): boolean {
    const urlRegex =
      /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g;
    const bannedWords = ['fuck', 'bitch', 'onlyfans']; // Mock list

    if (urlRegex.test(text)) return true;
    for (const word of bannedWords) {
      if (text.toLowerCase().includes(word)) return true;
    }
    return false;
  }

  async createProfile(
    userId: string,
    dto: OnboardingDto,
  ): Promise<ProfileEntity> {
    const existing = await this.profileRepo.findByUserId(userId);
    if (existing) {
      throw new BadRequestException('Profile already exists');
    }

    const dobDate = new Date(dto.dob);
    if (isNaN(dobDate.getTime())) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }

    const age = this.calculateAge(dobDate);
    if (age < 18) {
      throw new BadRequestException('Bạn phải đủ 18 tuổi để tham gia');
    }

    const profile = await this.profileRepo.create({
      userId,
      fullName: dto.fullName,
      dob: dobDate,
      gender: dto.gender,
      searchGender: dto.searchGender,
    });

    await this.evaluateOnboarding(userId);

    return profile;
  }

  async getProfile(userId: string, isSelf: boolean): Promise<any> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return null;

    const age = this.calculateAge(profile.dob);

    const result: any = {
      ...profile,
      age,
    };

    if (!isSelf) {
      delete result.dob;
    }

    return result;
  }

  async updateBasicInfo(
    userId: string,
    dto: UpdateBasicInfoDto,
  ): Promise<ProfileEntity> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) throw new BadRequestException('Profile not found');

    const now = new Date();
    const createdMsAgo = now.getTime() - profile.createdAt.getTime();
    const isGracePeriod = createdMsAgo < 24 * 60 * 60 * 1000; // < 24 hours

    const dataToUpdate: Partial<ProfileEntity> = {};

    if (dto.fullName) dataToUpdate.fullName = dto.fullName;
    if (dto.searchGender) dataToUpdate.searchGender = dto.searchGender;

    if (dto.dob) {
      const dobDate = new Date(dto.dob);
      if (this.calculateAge(dobDate) < 18) {
        throw new BadRequestException('Ngày sinh mới phải đủ 18 tuổi');
      }

      if (!isGracePeriod && profile.dobUpdatedAt) {
        const diffDays =
          (now.getTime() - profile.dobUpdatedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays < 60) {
          throw new HttpException(
            'Chỉ được đổi ngày sinh 60 ngày một lần',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      dataToUpdate.dob = dobDate;
      dataToUpdate.dobUpdatedAt = now;
    }

    if (dto.gender) {
      if (!isGracePeriod && profile.genderUpdatedAt) {
        const diffDays =
          (now.getTime() - profile.genderUpdatedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays < 60) {
          throw new HttpException(
            'Chỉ được đổi giới tính 60 ngày một lần',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      dataToUpdate.gender = dto.gender;
      dataToUpdate.genderUpdatedAt = now;
    }

    const updated = await this.profileRepo.update(
      userId,
      dataToUpdate,
    );
    if (!updated) {
      throw new BadRequestException('Profile not found');
    }
    await this.evaluateOnboarding(userId);
    return updated;
  }

  async updateBioInterests(
    userId: string,
    dto: UpdateBioInterestsDto,
  ): Promise<ProfileEntity> {
    if (dto.bio && this.hasProfanityOrUrl(dto.bio)) {
      throw new BadRequestException(
        'Nội dung vi phạm tiêu chuẩn cộng đồng (chứa từ cấm hoặc đường link)',
      );
    }

    const dataToUpdate: Partial<ProfileEntity> = {};
    if (dto.bio !== undefined) dataToUpdate.bio = dto.bio;
    if (dto.interestIds !== undefined) dataToUpdate.interests = dto.interestIds; // MOCK ONLY - normally M:M relational insert

    const updated = await this.profileRepo.update(
      userId,
      dataToUpdate,
    );
    if (!updated) {
      throw new BadRequestException('Profile not found');
    }
    await this.evaluateOnboarding(userId);
    return updated;
  }

  async updateEducationJob(
    userId: string,
    dto: UpdateEducationJobDto,
  ): Promise<ProfileEntity> {
    if (dto.company && this.hasProfanityOrUrl(dto.company))
      throw new BadRequestException('Nội dung vi phạm');
    if (dto.jobTitle && this.hasProfanityOrUrl(dto.jobTitle))
      throw new BadRequestException('Nội dung vi phạm');
    if (dto.school && this.hasProfanityOrUrl(dto.school))
      throw new BadRequestException('Nội dung vi phạm');

    const dataToUpdate: Partial<ProfileEntity> = {};
    if (dto.company !== undefined) dataToUpdate.company = dto.company.trim();
    if (dto.jobTitle !== undefined) dataToUpdate.jobTitle = dto.jobTitle.trim();
    if (dto.school !== undefined) dataToUpdate.school = dto.school.trim();

    const updated = await this.profileRepo.update(
      userId,
      dataToUpdate,
    );
    if (!updated) {
      throw new BadRequestException('Profile not found');
    }
    await this.evaluateOnboarding(userId);
    return updated;
  }

  async evaluateOnboarding(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        location: true,
        discoveryPreference: true,
        privacySettings: true,
        photos: {
          where: {
            deletedAt: null,
            uploadStatus: 'CONFIRMED',
            moderationStatus: 'APPROVED',
          },
        },
      },
    });

    if (!user) return;

    // Do not downgrade an already COMPLETED user
    if (user.onboardingStatus === 'COMPLETED') return;

    // 1. profile row exists for the user
    if (!user.profile) return;
    const profile = user.profile;

    // 2. profile.display_name exists and is not blank
    if (!profile.displayName || profile.displayName.trim() === '') return;

    // 3. profile.dob exists
    if (!profile.dob) return;

    // 4. calculated age from profile.dob is >= 18
    const age = this.calculateAge(profile.dob);
    if (age < 18) return;

    // 5. profile.gender exists
    if (!profile.gender) return;

    // 6. profile.relationship_goal exists
    if (!profile.relationshipGoal) return;

    // 7. active real location exists in user_locations
    if (!user.location) return;
    const location = user.location;

    // 8. active_location_mode = REAL
    if (location.activeLocationMode !== 'REAL') return;

    // 9. real_location is not null (we can't easily fetch PostGIS geography via include without raw query, so we check if it exists via raw query)
    const locRows = await this.prisma.$queryRaw<any[]>`SELECT real_location FROM user_locations WHERE user_id = ${userId}::uuid AND real_location IS NOT NULL`;
    if (!locRows || locRows.length === 0) return;

    // 10. at least one profile photo exists that is: not deleted, CONFIRMED, APPROVED
    if (user.photos.length === 0) return;

    // 11. discovery_preferences row exists
    if (!user.discoveryPreference) return;

    // 12. user_privacy_settings row exists
    if (!user.privacySettings) return;

    // All requirements satisfied, update status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
      },
    });
  }
}
