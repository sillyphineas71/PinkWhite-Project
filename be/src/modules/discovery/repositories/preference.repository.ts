import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface PreferenceEntity {
  id: string;
  userId: string;
  minAge: number;
  maxAge: number;
  genderFilter: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'ALL';
  maxDistance: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PreferenceRepository {
  private readonly logger = new Logger(PreferenceRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private mapGenderFilterToGenders(filter: string): string[] {
    if (filter === 'ALL') return ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'];
    return [filter];
  }

  private mapGendersToGenderFilter(
    genders: string[],
  ): 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'ALL' {
    if (!genders || genders.length === 0) return 'ALL';
    if (genders.length > 1) return 'ALL';
    return genders[0] as any;
  }

  async create(
    data: Omit<PreferenceEntity, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: Prisma.TransactionClient,
  ): Promise<PreferenceEntity> {
    const client = this.client(tx);
    const pref = await client.discoveryPreference.create({
      data: {
        userId: data.userId,
        minAge: data.minAge,
        maxAge: data.maxAge,
        maxDistanceKm: data.maxDistance,
        preferredGenders: this.mapGenderFilterToGenders(data.genderFilter),
      },
    });

    this.logger.debug(`Preference created for user: ${data.userId}`);
    return this.toEntity(pref);
  }

  async findByUserId(userId: string): Promise<PreferenceEntity | null> {
    const pref = await this.prisma.discoveryPreference.findUnique({
      where: { userId },
    });
    return pref ? this.toEntity(pref) : null;
  }

  async update(
    id: string,
    data: Partial<
      Omit<PreferenceEntity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
    >,
    tx?: Prisma.TransactionClient,
  ): Promise<PreferenceEntity | null> {
    const client = this.client(tx);

    const updateData: any = {};
    if (data.minAge !== undefined) updateData.minAge = data.minAge;
    if (data.maxAge !== undefined) updateData.maxAge = data.maxAge;
    if (data.maxDistance !== undefined)
      updateData.maxDistanceKm = data.maxDistance;
    if (data.genderFilter !== undefined)
      updateData.preferredGenders = this.mapGenderFilterToGenders(
        data.genderFilter,
      );

    try {
      const pref = await client.discoveryPreference.update({
        where: { id },
        data: updateData,
      });
      this.logger.debug(`Preference updated for user: ${pref.userId}`);
      return this.toEntity(pref);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
        return null;
      }
      throw e;
    }
  }

  async upsert(
    userId: string,
    data: Omit<PreferenceEntity, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    tx?: Prisma.TransactionClient,
  ): Promise<PreferenceEntity> {
    const client = this.client(tx);
    const pref = await client.discoveryPreference.upsert({
      where: { userId },
      create: {
        userId,
        minAge: data.minAge,
        maxAge: data.maxAge,
        maxDistanceKm: data.maxDistance,
        preferredGenders: this.mapGenderFilterToGenders(data.genderFilter),
      },
      update: {
        minAge: data.minAge,
        maxAge: data.maxAge,
        maxDistanceKm: data.maxDistance,
        preferredGenders: this.mapGenderFilterToGenders(data.genderFilter),
      },
    });
    return this.toEntity(pref);
  }

  private toEntity(pref: any): PreferenceEntity {
    return {
      id: pref.id,
      userId: pref.userId,
      minAge: pref.minAge,
      maxAge: pref.maxAge,
      genderFilter: this.mapGendersToGenderFilter(
        pref.preferredGenders as string[],
      ),
      maxDistance: pref.maxDistanceKm,
      createdAt: pref.createdAt,
      updatedAt: pref.updatedAt,
    };
  }
}
