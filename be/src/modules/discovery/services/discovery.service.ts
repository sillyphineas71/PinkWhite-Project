import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreatePreferenceDto } from '../dto/create-preference.dto';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { GetDiscoveryFeedQueryDto } from '../dto/get-discovery-feed.dto';
import { PreferenceRepository } from '../repositories/preference.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProfileRepository } from '../../profile/repositories/profile.repository';
import { LocationRepository } from '../../profile/repositories/location.repository';
import { PhotoRepository } from '../../profile/repositories/photo.repository';
import { SwipeRepository } from '../../swipe/repositories/swipe.repository';
import { UserPrivacySettingsRepository } from '../../profile/repositories/user-privacy-settings.repository';
import { DiscoveryFeedRepository } from '../repositories/discovery-feed.repository';
import { PrismaService } from '../../../database/prisma.service';
import { decodeDiscoveryCursor, encodeDiscoveryCursor } from '../utils/discovery-cursor.util';
import { DiscoveryFeedResponseDto, DiscoveryCandidateDto, DiscoveryCandidatePhotoDto } from '../dto/discovery-feed-response.dto';
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
    private readonly discoveryFeedRepo: DiscoveryFeedRepository,
    private readonly prisma: PrismaService,
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

  async validateRequesterDiscoveryReadiness(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user || user.accountStatus !== 'ACTIVE' || user.deletedAt) {
      throw new BadRequestException('ACCOUNT_NOT_ACTIVE');
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException('EMAIL_NOT_VERIFIED');
    }

    if (!user.isOnboarded) {
      throw new BadRequestException('ONBOARDING_INCOMPLETE');
    }

    const settings = await this.privacyRepo.findByUserId(userId);
    if (!settings || settings.isHidden) {
      throw new BadRequestException('HIDDEN_FROM_DISCOVERY');
    }

    const prefs = await this.prisma.discoveryPreference.findUnique({
      where: { userId },
    });
    if (!prefs) {
      throw new BadRequestException('PREFERENCES_REQUIRED');
    }

    const locationRows = await this.prisma.$queryRaw<any[]>`
      SELECT active_location_mode, 
             ST_X(real_location::geometry) as lng, 
             ST_Y(real_location::geometry) as lat
      FROM user_locations 
      WHERE user_id = ${userId}::uuid
    `;
    const location = locationRows[0];
    if (!location || location.active_location_mode !== 'real' || location.lng === null || location.lat === null) {
      throw new BadRequestException('LOCATION_REQUIRED');
    }

    return { user, settings, prefs, location: { latitude: location.lat, longitude: location.lng } };
  }

  async getFeed(userId: string, query: GetDiscoveryFeedQueryDto): Promise<DiscoveryFeedResponseDto> {
    const limit = query.limit || 20;
    const decodedCursor = decodeDiscoveryCursor(query.cursor);

    const readiness = await this.validateRequesterDiscoveryReadiness(userId);
    const { location, prefs } = readiness;

    const rawGenders = (prefs.preferredGenders as string[]) || [];
    let preferredGenders = rawGenders.map(g => g.toLowerCase());
    
    if (preferredGenders.includes('all')) {
      preferredGenders = ['male', 'female', 'non_binary', 'other'];
    }

    const candidatesRows = await this.discoveryFeedRepo.findCandidates({
      requesterUserId: userId,
      requesterLat: location.latitude,
      requesterLng: location.longitude,
      preferredGenders,
      minAge: prefs.minAge,
      maxAge: prefs.maxAge,
      maxDistanceKm: prefs.maxDistanceKm,
      limit,
      cursor: decodedCursor,
    });

    const hasMore = candidatesRows.length > limit;
    const visibleRows = candidatesRows.slice(0, limit);

    if (visibleRows.length === 0) {
      return {
        candidates: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const candidateUserIds = visibleRows.map(r => r.candidateUserId);

    const profiles = await this.prisma.profile.findMany({
      where: { userId: { in: candidateUserIds } },
      select: {
        userId: true,
        displayName: true,
        dob: true,
        gender: true,
        relationshipGoal: true,
        bio: true,
      },
    });

    const photos = await this.prisma.profilePhoto.findMany({
      where: {
        userId: { in: candidateUserIds },
        deletedAt: null,
        uploadStatus: 'CONFIRMED',
        moderationStatus: 'APPROVED',
        publicUrl: { not: null },
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        userId: true,
        publicUrl: true,
        sortOrder: true,
      },
    });

    const profileMap = new Map<string, any>(profiles.map((p: any) => [p.userId, p]));
    const photoMap = new Map<string, DiscoveryCandidatePhotoDto[]>();
    
    for (const photo of photos) {
      if (!photo.publicUrl || photo.publicUrl.trim() === '') continue;
      const p = photoMap.get(photo.userId) || [];
      p.push({
        photoId: photo.id,
        url: photo.publicUrl,
        displayOrder: photo.sortOrder,
      });
      photoMap.set(photo.userId, p);
    }

    const candidates: DiscoveryCandidateDto[] = [];

    for (const row of visibleRows) {
      const profile = profileMap.get(row.candidateUserId);
      if (!profile) continue;

      let age = new Date().getFullYear() - profile.dob.getFullYear();
      const hasHadBirthdayThisYear =
        new Date().getMonth() > profile.dob.getMonth() ||
        (new Date().getMonth() === profile.dob.getMonth() && new Date().getDate() >= profile.dob.getDate());
      if (!hasHadBirthdayThisYear) {
        age -= 1;
      }

      let distanceKm = Math.round(row.distanceMeters / 1000);
      if (row.distanceMeters > 0 && distanceKm === 0) {
        distanceKm = 1;
      }

      const candidatePhotos = photoMap.get(profile.userId) || [];
      if (candidatePhotos.length === 0) continue;

      candidates.push({
        userId: profile.userId,
        displayName: profile.displayName,
        age,
        gender: profile.gender,
        relationshipGoal: profile.relationshipGoal,
        bio: profile.bio,
        photos: candidatePhotos,
        distanceKm,
      });
    }

    let nextCursor: string | null = null;
    if (hasMore && visibleRows.length > 0) {
      const lastRow = visibleRows[visibleRows.length - 1];
      nextCursor = encodeDiscoveryCursor(lastRow.distanceMeters, lastRow.candidateUserId);
    }

    return {
      candidates,
      nextCursor,
      hasMore,
    };
  }
}
