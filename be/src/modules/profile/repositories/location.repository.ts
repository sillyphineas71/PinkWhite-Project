import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface LocationEntity {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  isPassport: boolean;
  passportLat: number | null;
  passportLng: number | null;
  updatedAt: Date;
}

@Injectable()
export class LocationRepository {
  private readonly logger = new Logger(LocationRepository.name);
  private readonly locations: Map<string, LocationEntity> = new Map();

  async upsertGPS(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<LocationEntity> {
    let location = this.locations.get(userId);

    if (!location) {
      location = {
        id: randomUUID(),
        userId,
        latitude,
        longitude,
        isPassport: false,
        passportLat: null,
        passportLng: null,
        updatedAt: new Date(),
      };
      this.locations.set(userId, location);
      this.logger.debug(`[MOCK] Location created for userId: ${userId}`);
    } else {
      location.latitude = latitude;
      location.longitude = longitude;
      location.updatedAt = new Date();
      this.logger.debug(`[MOCK] Location updated for userId: ${userId}`);
    }

    return { ...location };
  }

  async upsertPassport(
    userId: string,
    passportLat: number,
    passportLng: number,
  ): Promise<LocationEntity> {
    let location = this.locations.get(userId);

    if (!location) {
      // Default fake real GPS if none exists, just to store passport
      location = {
        id: randomUUID(),
        userId,
        latitude: 0,
        longitude: 0,
        isPassport: true,
        passportLat,
        passportLng,
        updatedAt: new Date(),
      };
      this.locations.set(userId, location);
    } else {
      location.isPassport = true;
      location.passportLat = passportLat;
      location.passportLng = passportLng;
      location.updatedAt = new Date();
    }

    return { ...location };
  }

  async findByUserId(userId: string): Promise<LocationEntity | null> {
    const location = this.locations.get(userId);
    return location ? { ...location } : null;
  }
}
