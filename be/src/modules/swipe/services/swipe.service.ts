import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SwipeRepository } from '../repositories/swipe.repository';
import { MatchRepository } from '../repositories/match.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProfileRepository } from '../../profile/repositories/profile.repository';
import { PhotoRepository } from '../../profile/repositories/photo.repository';

@Injectable()
export class SwipeService {
  private readonly logger = new Logger(SwipeService.name);

  constructor(
    private readonly swipeRepo: SwipeRepository,
    private readonly matchRepo: MatchRepository,
    private readonly userRepo: UserRepository,
    private readonly profileRepo: ProfileRepository,
    private readonly photoRepo: PhotoRepository,
  ) {}

  private hasProfanityOrUrl(text: string): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g;
    const bannedWords = ['fuck', 'bitch', 'onlyfans'];

    if (urlRegex.test(text)) return true;
    for (const word of bannedWords) {
      if (text.toLowerCase().includes(word)) return true;
    }
    return false;
  }

  async like(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Cannot swipe yourself');

    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const target = await this.userRepo.findById(targetId);
    if (!target) throw new BadRequestException('Target user not found');
    if (target.isHidden) throw new BadRequestException('Target user is not available');

    const targetPhotos = await this.photoRepo.findByUserId(targetId);
    if (targetPhotos.length === 0) throw new BadRequestException('Target user has no photos');

    // Check limit
    if (!user.isPremium) {
      const likesToday = await this.swipeRepo.countActionInLast24h(userId, 'LIKE');
      if (likesToday >= 100) {
        throw new ForbiddenException('Bạn đã hết 100 lượt Thích hôm nay. Hãy nâng cấp Premium.');
      }
    }

    const currentSwipe = await this.swipeRepo.findTargetAction(userId, targetId);
    if (currentSwipe === 'LIKE') return { isMatch: await this.matchRepo.isMatch(userId, targetId) };

    await this.swipeRepo.create(userId, targetId, 'LIKE');

    // Check Mutual Like
    const targetAction = await this.swipeRepo.findTargetAction(targetId, userId);
    if (targetAction === 'LIKE' || targetAction === 'SUPER_LIKE') {
      try {
        const match = await this.matchRepo.create(userId, targetId);
        return { isMatch: true, matchId: match.id };
      } catch (error) {
        if (error.message === 'UNIQUE_VIOLATION') {
          // Race condition resolved by unique constraint
          return { isMatch: true };
        }
        throw error;
      }
    }

    return { isMatch: false };
  }

  async pass(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Cannot swipe yourself');
    await this.swipeRepo.create(userId, targetId, 'PASS');
    return { success: true };
  }

  async superLike(userId: string, targetId: string, message: string | null = null) {
    if (userId === targetId) throw new BadRequestException('Cannot swipe yourself');

    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const limit = user.isPremium ? 5 : 1;
    const superLikesToday = await this.swipeRepo.countActionInLast24h(userId, 'SUPER_LIKE');

    if (superLikesToday >= limit) {
      throw new ForbiddenException(`Bạn đã hết lượt Super Like hôm nay (${limit} lượt).`);
    }

    if (message && this.hasProfanityOrUrl(message)) {
      throw new BadRequestException('Nội dung vi phạm tiêu chuẩn cộng đồng (chứa từ cấm hoặc đường link)');
    }

    const currentSwipe = await this.swipeRepo.findTargetAction(userId, targetId);
    if (currentSwipe === 'SUPER_LIKE') return { isMatch: await this.matchRepo.isMatch(userId, targetId) };

    await this.swipeRepo.create(userId, targetId, 'SUPER_LIKE', message);

    // Check Mutual Like
    const targetAction = await this.swipeRepo.findTargetAction(targetId, userId);
    if (targetAction === 'LIKE' || targetAction === 'SUPER_LIKE') {
      try {
        const match = await this.matchRepo.create(userId, targetId);
        return { isMatch: true, matchId: match.id };
      } catch (error) {
        if (error.message === 'UNIQUE_VIOLATION') {
          return { isMatch: true };
        }
        throw error;
      }
    }

    return { isMatch: false };
  }

  async rewind(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user?.isPremium) {
      throw new ForbiddenException('Chức năng Rewind chỉ dành cho thành viên Premium');
    }

    const lastSwipe = await this.swipeRepo.findLastSwipe(userId);
    if (!lastSwipe) {
      throw new BadRequestException('Không có lượt quẹt nào để quay lại');
    }

    const isMatch = await this.matchRepo.isMatch(userId, lastSwipe.targetId);
    if (isMatch) {
      throw new BadRequestException('Không thể Rewind người đã Match');
    }

    await this.swipeRepo.delete(lastSwipe.id);
    return { success: true, rewoundTargetId: lastSwipe.targetId };
  }

  async getRemainingLikes(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const likesToday = await this.swipeRepo.countActionInLast24h(userId, 'LIKE');
    const superLikesToday = await this.swipeRepo.countActionInLast24h(userId, 'SUPER_LIKE');

    const superLikeLimit = user.isPremium ? 5 : 1;

    return {
      likesRemaining: user.isPremium ? 'UNLIMITED' : Math.max(0, 100 - likesToday),
      superLikesRemaining: Math.max(0, superLikeLimit - superLikesToday),
      isPremium: user.isPremium,
    };
  }

  async getWhoLikedMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const likes = await this.swipeRepo.findWhoLikedMe(userId);
    const allProfiles = await this.profileRepo.findAll();
    const allPhotos = await this.photoRepo.findAll();

    return {
      count: likes.length,
      data: likes.map(like => {
        const profile = allProfiles.find(p => p.userId === like.swiperId);
        const photos = allPhotos.filter(p => p.userId === like.swiperId);
        
        return {
          userId: user.isPremium ? like.swiperId : 'HIDDEN',
          fullName: user.isPremium ? profile?.fullName : 'Người dùng ẩn danh',
          action: like.action,
          message: user.isPremium ? like.message : null,
          timestamp: like.createdAt,
          // Blurry image mock logic would be handled by frontend usually, but we can send a blurred URL or original
          avatarUrl: user.isPremium ? (photos.find(p => p.isAvatar)?.url || null) : 'BLURRED_URL',
        };
      }),
    };
  }

  async getPassHistory(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const passes = await this.swipeRepo.findPassHistory(userId);
    const allProfiles = await this.profileRepo.findAll();
    const allPhotos = await this.photoRepo.findAll();

    const retentionDays = user.isPremium ? 30 : 7;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const filteredPasses = passes.filter(p => p.createdAt >= cutoffDate);

    return {
      data: filteredPasses.map(pass => {
        const profile = allProfiles.find(p => p.userId === pass.targetId);
        const photos = allPhotos.filter(p => p.userId === pass.targetId);
        return {
          userId: pass.targetId,
          fullName: profile?.fullName,
          age: profile ? new Date().getFullYear() - profile.dob.getFullYear() : null,
          timestamp: pass.createdAt,
          avatarUrl: photos.find(p => p.isAvatar)?.url || null,
        };
      }),
    };
  }

  // Self-Healing Cronjob (UC047 Flaw 2)
  @Cron(CronExpression.EVERY_10_MINUTES)
  async healMutualLikes() {
    this.logger.log('Running Self-Healing Cronjob for Mutual Likes...');
    const mutualLikes = await this.swipeRepo.findAllMutualLikesWithoutMatch();
    let healedCount = 0;

    for (const pair of mutualLikes) {
      const isMatch = await this.matchRepo.isMatch(pair.userA, pair.userB);
      if (!isMatch) {
        try {
          await this.matchRepo.create(pair.userA, pair.userB);
          healedCount++;
        } catch (error) {
          // Ignore unique violations
        }
      }
    }
    this.logger.log(`Self-Healing completed. Healed ${healedCount} missing matches.`);
  }
}
