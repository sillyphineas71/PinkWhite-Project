import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { MatchReadRepository } from '../repositories/match-read.repository';
import { MatchEntity } from '../match.types';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProfileRepository } from '../../profile/repositories/profile.repository';
import { PhotoRepository } from '../../profile/repositories/photo.repository';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly matchRepo: MatchReadRepository,
    private readonly userRepo: UserRepository,
    private readonly profileRepo: ProfileRepository,
    private readonly photoRepo: PhotoRepository,
  ) {}

  /**
   * Xác định User hiện tại là phía A hay phía B trong Match.
   * Trả về 'A' | 'B' | null (nếu không thuộc Match).
   */
  private getUserSide(match: MatchEntity, userId: string): 'A' | 'B' | null {
    if (match.userAId === userId) return 'A';
    if (match.userBId === userId) return 'B';
    return null;
  }

  /** Lấy ID đối phương dựa trên phía */
  private getPartnerId(match: MatchEntity, side: 'A' | 'B'): string {
    return side === 'A' ? match.userBId : match.userAId;
  }

  /**
   * UC057: Đọc danh sách Match hiện có
   * - Chỉ trả ACTIVE matches.
   * - Lọc Ghost Data (đối phương bị Banned/Deleted).
   * - Trả kèm unreadCount riêng cho User đang gọi.
   */
  async getMatchList(userId: string, cursor?: string, limit: number = 20) {
    // Clamp limit
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const allActiveMatches =
      await this.matchRepo.findActiveMatchesByUserId(userId);

    // Ghost Data filtering: loại bỏ Match có đối phương bị Banned hoặc đã xóa tài khoản
    const filteredMatches: MatchEntity[] = [];
    for (const match of allActiveMatches) {
      const side = this.getUserSide(match, userId)!;
      const partnerId = this.getPartnerId(match, side);
      const partner = await this.userRepo.findById(partnerId);

      if (partner && !partner.isBanned && partner.deletedAt === null) {
        filteredMatches.push(match);
      }
    }

    // Cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = filteredMatches.findIndex((m) => m.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedMatches = filteredMatches.slice(
      startIndex,
      startIndex + safeLimit,
    );

    // Build response
    const data = [];
    for (const match of paginatedMatches) {
      const side = this.getUserSide(match, userId)!;
      const partnerId = this.getPartnerId(match, side);
      const profile = await this.profileRepo.findByUserId(partnerId);
      const photos = await this.photoRepo.findByUserId(partnerId);
      const avatar = photos.find((p) => p.isAvatar);

      data.push({
        matchId: match.id,
        partner: {
          userId: partnerId,
          fullName: profile?.fullName || 'Unknown',
          avatar: avatar?.url || null,
          age: profile?.dob
            ? new Date().getFullYear() - profile.dob.getFullYear()
            : null,
        },
        unreadCount: side === 'A' ? match.unreadCountA : match.unreadCountB,
        lastInteractionAt: match.lastInteractionAt,
      });
    }

    const hasMore = startIndex + safeLimit < filteredMatches.length;
    const nextCursor =
      paginatedMatches.length > 0
        ? paginatedMatches[paginatedMatches.length - 1].id
        : null;

    this.logger.debug(
      `[GET_MATCH_LIST] userId=${userId}, resultCount=${data.length}`,
    );

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  /**
   * UC058: Xem chi tiết Profile của một Match
   * - Kiểm tra quyền sở hữu.
   * - Kiểm tra Ghost Data.
   */
  async getMatchProfile(userId: string, matchId: string) {
    const match = await this.matchRepo.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match không tồn tại');
    }

    const side = this.getUserSide(match, userId);
    if (!side) {
      this.logger.warn(
        `[GET_MATCH_PROFILE] IDOR attempt: userId=${userId}, matchId=${matchId}`,
      );
      throw new ForbiddenException('Bạn không thuộc về lượt Match này');
    }

    if (match.status !== 'ACTIVE') {
      throw new ForbiddenException('Lượt Match này đã bị hủy');
    }

    // Ghost Data check
    const partnerId = this.getPartnerId(match, side);
    const partnerUser = await this.userRepo.findById(partnerId);
    if (
      !partnerUser ||
      partnerUser.isBanned ||
      partnerUser.deletedAt !== null
    ) {
      throw new GoneException('Tài khoản đối phương không còn khả dụng');
    }

    const profile = await this.profileRepo.findByUserId(partnerId);
    const photos = await this.photoRepo.findByUserId(partnerId);

    this.logger.debug(
      `[GET_MATCH_PROFILE] userId=${userId}, targetId=${partnerId}, matchId=${matchId}`,
    );

    return {
      userId: partnerId,
      fullName: profile?.fullName || 'Unknown',
      age: profile?.dob
        ? new Date().getFullYear() - profile.dob.getFullYear()
        : null,
      gender: profile?.gender || null,
      bio: profile?.bio || null,
      interests: profile?.interests || [],
      company: profile?.company || null,
      jobTitle: profile?.jobTitle || null,
      school: profile?.school || null,
      photos: photos.map((p) => ({
        id: p.id,
        url: p.url,
        order: p.order,
        isAvatar: p.isAvatar,
      })),
    };
  }

  /**
   * UC059: Tìm kiếm Match theo Tên
   * - Case-insensitive.
   * - Chỉ tìm trong các Match ACTIVE.
   */
  async searchMatches(userId: string, keyword: string) {
    // Trực tiếp query SQL từ Repo để lấy active matches có đối phương ILIKE keyword
    const activeMatches = await this.matchRepo.searchActiveMatchesByPartnerName(
      userId,
      keyword,
      50,
    );

    const results = [];
    for (const match of activeMatches) {
      const side = this.getUserSide(match, userId)!;
      const partnerId = this.getPartnerId(match, side);

      // Ghost Data filter
      const partnerUser = await this.userRepo.findById(partnerId);
      if (
        !partnerUser ||
        partnerUser.isBanned ||
        partnerUser.deletedAt !== null
      ) {
        continue;
      }

      const profile = await this.profileRepo.findByUserId(partnerId);
      if (profile) {
        const photos = await this.photoRepo.findByUserId(partnerId);
        const avatar = photos.find((p) => p.isAvatar);

        results.push({
          matchId: match.id,
          partner: {
            userId: partnerId,
            fullName: profile.fullName,
            avatar: avatar?.url || null,
            age: profile.dob
              ? new Date().getFullYear() - profile.dob.getFullYear()
              : null,
          },
          unreadCount: side === 'A' ? match.unreadCountA : match.unreadCountB,
          lastInteractionAt: match.lastInteractionAt,
        });
      }
    }

    this.logger.debug(
      `[SEARCH_MATCH] userId=${userId}, keyword="${keyword}", resultCount=${results.length}`,
    );

    return { data: results };
  }

  /**
   * UC060: Hủy Tương hợp (Unmatch)
   * - Đổi status thành UNMATCHED_BY_A hoặc UNMATCHED_BY_B.
   * - Không gửi thông báo cho đối phương.
   */
  async unmatch(userId: string, matchId: string) {
    const match = await this.matchRepo.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match không tồn tại');
    }

    const side = this.getUserSide(match, userId);
    if (!side) {
      throw new ForbiddenException('Bạn không thuộc về lượt Match này');
    }

    if (match.status !== 'ACTIVE') {
      throw new BadRequestException('Lượt Match đã bị hủy trước đó');
    }

    const newStatus = 'UNMATCHED';
    await this.matchRepo.updateStatus(matchId, newStatus, userId);

    this.logger.debug(
      `[UNMATCH] userId=${userId}, matchId=${matchId}, newStatus=${newStatus}, unmatchedByUserId=${userId}`,
    );

    return { success: true };
  }

  /**
   * UC061: Khôi phục Hủy Tương hợp (Rematch)
   * DISABLED in Phase 4 Chat Persistence refactor.
   */
  async rematch(userId: string, matchId: string) {
    throw new NotImplementedException(
      'Tính năng Rematch đang bị vô hiệu hóa trong Phase hiện tại',
    );
  }
}
