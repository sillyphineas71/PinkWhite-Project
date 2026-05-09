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

@Injectable()
export class ProfileService {
  constructor(private readonly profileRepo: ProfileRepository) {}

  private calculateAge(dob: Date): number {
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
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

    return this.profileRepo.create({
      userId,
      fullName: dto.fullName,
      dob: dobDate,
      gender: dto.gender,
      searchGender: dto.searchGender,
    });
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

    return this.profileRepo.update(
      userId,
      dataToUpdate,
    ) as Promise<ProfileEntity>;
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

    return this.profileRepo.update(
      userId,
      dataToUpdate,
    ) as Promise<ProfileEntity>;
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

    return this.profileRepo.update(
      userId,
      dataToUpdate,
    ) as Promise<ProfileEntity>;
  }
}
