import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, Match, MatchStatus } from '@prisma/client';

@Injectable()
export class MatchReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Lấy Match theo ID */
  async findById(matchId: string): Promise<Match | null> {
    return this.prisma.match.findUnique({
      where: { id: matchId },
    });
  }

  /**
   * Lấy danh sách toàn bộ Match ACTIVE cho một user.
   * Để Service tự handle Ghost Data filtering và Memory pagination
   * (Đảm bảo tương thích hoàn toàn với logic mock cũ).
   */
  async findActiveMatchesByUserId(userId: string): Promise<Match[]> {
    return this.prisma.match.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { lastInteractionAt: 'desc' },
    });
  }

  /**
   * UC059: Tìm kiếm Match ACTIVE theo tên đối phương.
   */
  async searchActiveMatchesByPartnerName(
    userId: string,
    keyword: string,
    limit: number = 50,
  ): Promise<Match[]> {
    const likeKeyword = `%${keyword}%`;

    // Chúng ta cần tìm match ACTIVE, mà profile của user đối phương ILIKE keyword.
    // Viết raw query để dễ dàng join với profile.
    // Chú ý: user_a_id và user_b_id lưu UUID
    const matches: Match[] = await this.prisma.$queryRaw`
      SELECT m.*
      FROM matches m
      JOIN profiles p ON p.user_id = CASE WHEN m.user_a_id = ${userId}::uuid THEN m.user_b_id ELSE m.user_a_id END
      WHERE (m.user_a_id = ${userId}::uuid OR m.user_b_id = ${userId}::uuid)
        AND m.status = 'active'::match_status
        AND p.display_name ILIKE ${likeKeyword}
      ORDER BY m.last_interaction_at DESC
      LIMIT ${limit}
    `;

    return matches.map(
      (m: any) =>
        ({
          id: m.id,
          userAId: m.user_a_id,
          userBId: m.user_b_id,
          status:
            m.status === 'active'
              ? 'ACTIVE'
              : m.status === 'unmatched'
                ? 'UNMATCHED'
                : m.status === 'blocked'
                  ? 'BLOCKED'
                  : m.status,
          unreadCountA: m.unread_count_a,
          unreadCountB: m.unread_count_b,
          lastInteractionAt: m.last_interaction_at,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          unmatchedAt: m.unmatched_at,
          unmatchedByUserId: m.unmatched_by_user_id,
        }) as Match,
    );
  }

  /**
   * Đổi status của match (ví dụ sang UNMATCHED_BY_A hoặc UNMATCHED_BY_B)
   */
  async updateStatus(
    matchId: string,
    newStatus: MatchStatus,
    unmatchedByUserId?: string,
  ): Promise<Match> {
    const data: Prisma.MatchUncheckedUpdateInput = {
      status: newStatus,
      updatedAt: new Date(),
    };
    if (newStatus !== 'ACTIVE') {
      data.unmatchedAt = new Date();
      if (unmatchedByUserId) {
        data.unmatchedByUserId = unmatchedByUserId;
      }
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data,
    });
  }
}
