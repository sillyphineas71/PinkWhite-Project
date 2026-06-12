import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type DiscoveryFeedCandidateRow = {
  candidateUserId: string;
  distanceMeters: number;
};

export type DiscoveryFeedCursorInput = {
  distanceMeters: number;
  candidateUserId: string;
} | null;

export type FindDiscoveryCandidatesInput = {
  requesterUserId: string;
  requesterLat: number;
  requesterLng: number;
  preferredGenders: string[];
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  limit: number;
  cursor: DiscoveryFeedCursorInput;
};

@Injectable()
export class DiscoveryFeedRepository {
  private readonly logger = new Logger(DiscoveryFeedRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findCandidates(
    input: FindDiscoveryCandidatesInput,
  ): Promise<DiscoveryFeedCandidateRow[]> {
    const {
      requesterUserId,
      requesterLat,
      requesterLng,
      preferredGenders,
      minAge,
      maxAge,
      maxDistanceKm,
      limit,
      cursor,
    } = input;

    const maxDistanceMeters = maxDistanceKm * 1000;
    const limitPlusOne = limit + 1;

    const cursorCondition = cursor
      ? Prisma.sql`
          AND (
            ROUND(ST_Distance(
              ul.real_location,
              ST_SetSRID(ST_MakePoint(${requesterLng}, ${requesterLat}), 4326)::geography
            )) > ${cursor.distanceMeters}
            OR (
              ROUND(ST_Distance(
                ul.real_location,
                ST_SetSRID(ST_MakePoint(${requesterLng}, ${requesterLat}), 4326)::geography
              )) = ${cursor.distanceMeters}
              AND u.id::text > ${cursor.candidateUserId}
            )
          )
        `
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<any[]>`
      WITH candidates AS (
        SELECT
          u.id AS "candidateUserId",
          ROUND(ST_Distance(
            ul.real_location,
            ST_SetSRID(ST_MakePoint(${requesterLng}, ${requesterLat}), 4326)::geography
          ))::int AS "distanceMeters"
        FROM users u
        INNER JOIN profiles p ON p.user_id = u.id
        INNER JOIN user_locations ul ON ul.user_id = u.id
        INNER JOIN user_privacy_settings ups ON ups.user_id = u.id
        WHERE
          u.id != ${requesterUserId}::uuid
          AND u.account_status = 'active'
          AND u.deleted_at IS NULL
          AND u.email_verified_at IS NOT NULL
          AND u.onboarding_status = 'completed'
          
          AND ups.is_hidden = false
          
          AND ul.active_location_mode = 'real'
          AND ul.real_location IS NOT NULL
          
          AND p.gender::text = ANY(${preferredGenders})
          AND date_part('year', age(CURRENT_DATE, p.dob)) >= ${minAge}
          AND date_part('year', age(CURRENT_DATE, p.dob)) <= ${maxAge}
          
          AND ST_DWithin(
            ul.real_location,
            ST_SetSRID(ST_MakePoint(${requesterLng}, ${requesterLat}), 4326)::geography,
            ${maxDistanceMeters}
          )
          
          AND EXISTS (
            SELECT 1 FROM profile_photos pp 
            WHERE pp.user_id = u.id 
              AND pp.deleted_at IS NULL 
              AND pp.upload_status = 'confirmed' 
              AND pp.moderation_status = 'approved'
              AND pp.public_url IS NOT NULL
              AND pp.public_url != ''
          )
          
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub 
            WHERE ub.status = 'active'
              AND (
                (ub.blocker_id = ${requesterUserId}::uuid AND ub.blocked_user_id = u.id)
                OR 
                (ub.blocker_id = u.id AND ub.blocked_user_id = ${requesterUserId}::uuid)
              )
          )
          
          AND NOT EXISTS (
            SELECT 1 FROM matches m 
            WHERE (m.user_a_id = ${requesterUserId}::uuid AND m.user_b_id = u.id)
               OR (m.user_a_id = u.id AND m.user_b_id = ${requesterUserId}::uuid)
          )
          
          AND NOT EXISTS (
            SELECT 1 FROM swipe_states ss 
            WHERE ss.swiper_id = ${requesterUserId}::uuid AND ss.target_user_id = u.id
              AND (
                ss.current_action IN ('like', 'super_like')
                OR (ss.current_action = 'pass' AND ss.last_swiped_at > NOW() - INTERVAL '30 days')
              )
          )

          ${cursorCondition}
      )
      SELECT 
        "candidateUserId",
        "distanceMeters"
      FROM candidates
      ORDER BY "distanceMeters" ASC, "candidateUserId" ASC
      LIMIT ${limitPlusOne};
    `;

    return rows.map((r: any) => ({
      candidateUserId: r.candidateUserId,
      distanceMeters: Number(r.distanceMeters),
    }));
  }
}
