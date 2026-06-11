import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreatePreferenceDto } from '../dto/create-preference.dto';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { GetFeedQueryDto } from '../dto/get-feed-query.dto';
import { PreferenceRepository } from '../repositories/preference.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProfileRepository } from '../../profile/repositories/profile.repository';
import { LocationRepository } from '../../profile/repositories/location.repository';
import { PhotoRepository } from '../../profile/repositories/photo.repository';
import { SwipeRepository } from '../../swipe/repositories/swipe.repository';
import { UserPrivacySettingsRepository } from '../../profile/repositories/user-privacy-settings.repository';
import { calculateHaversineDistance } from '../utils/geo.util';
import { NotImplementedException } from '@nestjs/common';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly preferenceRepo: PreferenceRepository,
    private readonly userRepo: UserRepository,
    private readonly profileRepo: ProfileRepository,
    private readonly locationRepo: LocationRepository,
    private readonly photoRepo: PhotoRepository,
    private readonly swipeRepo: SwipeRepository,
    private readonly privacyRepo: UserPrivacySettingsRepository,
  ) {}

  async createPreferences(userId: string, dto: CreatePreferenceDto) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    if (!user.isOnboarded)
      throw new BadRequestException('User is not onboarded');

    const existing = await this.preferenceRepo.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Preferences already exist');
    }

    if (dto.minAge > dto.maxAge) {
      throw new BadRequestException('minAge cannot be greater than maxAge');
    }

    if (!user.isPremium && dto.maxDistance > 200) {
      throw new BadRequestException(
        'Khoảng cách tối đa cho gói miễn phí là 200km',
      );
    }
    if (user.isPremium && dto.maxDistance > 500) {
      throw new BadRequestException('Khoảng cách tối đa là 500km');
    }

    return this.preferenceRepo.create({
      userId,
      ...dto,
    });
  }

  async getPreferences(userId: string) {
    const prefs = await this.preferenceRepo.findByUserId(userId);
    if (!prefs) {
      throw new BadRequestException('Preferences not found');
    }
    return prefs;
  }

  async updatePreferences(userId: string, dto: UpdatePreferenceDto) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const existing = await this.preferenceRepo.findByUserId(userId);
    if (!existing) {
      throw new BadRequestException('Preferences not found');
    }

    const merged = { ...existing, ...dto };

    if (merged.minAge > merged.maxAge) {
      throw new BadRequestException('minAge cannot be greater than maxAge');
    }

    if (!user.isPremium && merged.maxDistance > 200) {
      throw new BadRequestException(
        'Khoảng cách tối đa cho gói miễn phí là 200km',
      );
    }
    if (user.isPremium && merged.maxDistance > 500) {
      throw new BadRequestException('Khoảng cách tối đa là 500km');
    }

    return this.preferenceRepo.update(existing.id, dto);
  }

  async toggleVisibility(userId: string, isHidden: boolean) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    // Premium entitlement enforcement is deferred.
    // if (!user.isPremium) {
    //   throw new ForbiddenException('Tính năng này yêu cầu gói Premium');
    // }

    const settings = await this.privacyRepo.upsert(userId, { isHidden });
    return { isHidden: settings.isHidden };
  }

  async getVisibility(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const settings = await this.privacyRepo.findByUserId(userId);
    return { isHidden: settings ? settings.isHidden : false };
  }

  async getFeed(userId: string, query: GetFeedQueryDto) {
    throw new NotImplementedException('Discovery feed not implemented in Phase 1');
  }
}
