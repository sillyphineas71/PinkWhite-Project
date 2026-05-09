import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  LocationRepository,
  LocationEntity,
} from '../repositories/location.repository';
import { UpdateLocationDto, UpdatePassportDto } from '../dto/profile.dto';

@Injectable()
export class LocationService {
  constructor(private readonly locationRepo: LocationRepository) {}

  // Haversine formula
  private getDistanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  async updateRealGPS(userId: string, dto: UpdateLocationDto): Promise<void> {
    if (dto.isMocked) {
      throw new ForbiddenException(
        'Phát hiện GPS giả. Vui lòng nâng cấp Passport để đổi vị trí',
      );
    }

    const currentLoc = await this.locationRepo.findByUserId(userId);

    if (currentLoc) {
      const distance = this.getDistanceInMeters(
        currentLoc.latitude,
        currentLoc.longitude,
        dto.lat,
        dto.lng,
      );

      if (distance < 1000) {
        // Skip DB write, optimize IOPS
        return;
      }
    }

    await this.locationRepo.upsertGPS(userId, dto.lat, dto.lng);
  }

  async updatePassport(userId: string, dto: UpdatePassportDto): Promise<void> {
    // In real app, check Premium subscription here.
    // Mock assumption: User is Premium.
    // if (!isPremium(userId)) throw new ForbiddenException(...);

    await this.locationRepo.upsertPassport(userId, dto.lat, dto.lng);
  }

  async getActiveLocation(
    userId: string,
  ): Promise<{ lat: number; lng: number; isPassport: boolean } | null> {
    const loc = await this.locationRepo.findByUserId(userId);
    if (!loc) return null;

    // Check premium expiry fallback here
    // const hasPremium = checkPremium(userId);
    const hasPremium = true; // Mock assumption

    if (loc.isPassport && hasPremium && loc.passportLat && loc.passportLng) {
      return { lat: loc.passportLat, lng: loc.passportLng, isPassport: true };
    }

    return { lat: loc.latitude, lng: loc.longitude, isPassport: false };
  }
}
