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
import { calculateHaversineDistance } from '../utils/geo.util';

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

    if (!user.isPremium) {
      throw new ForbiddenException('Tính năng này yêu cầu gói Premium');
    }

    await this.userRepo.setIsHidden(userId, isHidden);
    return { isHidden };
  }

  async getVisibility(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    return { isHidden: user.isHidden };
  }

  async getFeed(userId: string, query: GetFeedQueryDto) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const prefs = await this.preferenceRepo.findByUserId(userId);
    if (!prefs) {
      throw new BadRequestException(
        'Vui lòng thiết lập Preferences trước khi xem Feed',
      );
    }

    const userLocation = await this.locationRepo.findByUserId(userId);
    if (!userLocation) {
      throw new BadRequestException('Vui lòng bật GPS để tìm người xung quanh');
    }

    // We need a method to get all profiles. I will assume we can get them all for the mock.
    // In production, this would be a complex PostGIS or Bounding Box query.
    const allUsers = await this.userRepo.findAll();
    const allProfiles = await this.profileRepo.findAll();
    const allLocations = await this.locationRepo.findAll();
    const allPhotos = await this.photoRepo.findAll();
    const swipedTargetIds = await this.swipeRepo.findSwipedTargetIds(userId);

    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let candidates = [];

    for (const targetUser of allUsers) {
      if (targetUser.id === userId) continue;
      if (!targetUser.isOnboarded || targetUser.isBanned || targetUser.deletedAt || targetUser.isHidden) continue;
      if (swipedTargetIds.includes(targetUser.id)) continue;

      const targetProfile = allProfiles.find(p => p.userId === targetUser.id);
      if (!targetProfile) continue;

      const targetPhotos = allPhotos.filter(p => p.userId === targetUser.id);
      if (targetPhotos.length === 0) continue;

      // Gender filter
      if (prefs.genderFilter !== 'ALL') {
        if (targetProfile.gender !== prefs.genderFilter) continue;
      }

      // Age filter
      const targetAge = new Date().getFullYear() - targetProfile.dob.getFullYear();
      if (targetAge < prefs.minAge || targetAge > prefs.maxAge) continue;

      // Distance filter
      const targetLocation = allLocations.find(l => l.userId === targetUser.id);
      if (!targetLocation) continue;

      const distance = calculateHaversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude,
      );

      if (distance > prefs.maxDistance) continue;

      // Calculate Boost
      // Note (Spam Prevention): In a real app, we'd check if email/deviceId is truly new.
      // For this mock, we assume all users created in last 48h are boosted.
      const isBoosted = targetUser.createdAt > fortyEightHoursAgo;

      candidates.push({
        userId: targetUser.id,
        profile: targetProfile,
        distance,
        isBoosted,
        photos: targetPhotos,
      });
    }

    // Sort by Boost Priority, then Distance
    candidates.sort((a, b) => {
      if (a.isBoosted && !b.isBoosted) return -1;
      if (!a.isBoosted && b.isBoosted) return 1;
      return a.distance - b.distance;
    });

    // Pagination (mocking cursor with simple offset for now since it's an array)
    const limit = query.limit || 20;
    const startIndex = query.cursor ? candidates.findIndex(c => c.userId === query.cursor) + 1 : 0;
    const paginated = candidates.slice(startIndex, startIndex + limit);

    const hasMore = startIndex + limit < candidates.length;
    const nextCursor = paginated.length > 0 ? paginated[paginated.length - 1].userId : null;

    return {
      data: paginated.map(c => ({
        userId: c.userId,
        fullName: c.profile.fullName,
        age: new Date().getFullYear() - c.profile.dob.getFullYear(),
        bio: c.profile.bio,
        distance: Math.round(c.distance),
        photos: c.photos.map(p => p.url),
      })),
      nextCursor,
      hasMore,
    };
  }
}
