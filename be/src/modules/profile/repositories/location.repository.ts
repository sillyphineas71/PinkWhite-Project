import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

  async upsertGPS(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<LocationEntity> {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO user_locations (
        id, user_id, real_location, active_location_mode, is_mocked, updated_at, created_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography(Point,4326),
        'real',
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        real_location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography(Point,4326),
        updated_at = NOW();
    `;

    this.logger.debug(`Location UPSERT for userId: ${userId}`);
    const result = await this.findByUserId(userId);
    return result!;
  }

  async upsertPassport(
    userId: string,
    passportLat: number,
    passportLng: number,
  ): Promise<LocationEntity> {
    throw new NotImplementedException(
      'Passport location not implemented in Phase 1',
    );
  }

  async findByUserId(userId: string): Promise<LocationEntity | null> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id, 
        user_id as "userId",
        ST_X(real_location::geometry) as "lng",
        ST_Y(real_location::geometry) as "lat",
        ST_X(passport_location::geometry) as "passportLng",
        ST_Y(passport_location::geometry) as "passportLat",
        active_location_mode as "activeLocationMode",
        updated_at as "updatedAt"
      FROM user_locations
      WHERE user_id = ${userId}::uuid
    `;

    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      userId: row.userId,
      latitude: row.lat ?? 0,
      longitude: row.lng ?? 0,
      isPassport: row.activeLocationMode === 'passport',
      passportLat: row.passportLat ?? null,
      passportLng: row.passportLng ?? null,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(): Promise<LocationEntity[]> {
    throw new NotImplementedException('FindAll not supported for locations');
  }
}
