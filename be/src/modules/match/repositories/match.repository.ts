import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type MatchStatus = 'ACTIVE' | 'UNMATCHED_BY_A' | 'UNMATCHED_BY_B';

export interface MatchEntity {
  id: string;
  userAId: string; // userAId < userBId lexicographically (UNIQUE CONSTRAINT)
  userBId: string;
  status: MatchStatus;
  unreadCountA: number; // Số tin nhắn chưa đọc của UserA
  unreadCountB: number; // Số tin nhắn chưa đọc của UserB
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MatchRepository {
  private readonly logger = new Logger(MatchRepository.name);
  private readonly matches: Map<string, MatchEntity> = new Map();

  /** Chuẩn hóa thứ tự từ điển (UC056 - Rule 6) */
  private getPair(userId1: string, userId2: string): { userA: string; userB: string } {
    return userId1 < userId2
      ? { userA: userId1, userB: userId2 }
      : { userA: userId2, userB: userId1 };
  }

  /** UC056: Tạo Match mới — ném lỗi UNIQUE_VIOLATION nếu đã tồn tại */
  async create(userId1: string, userId2: string): Promise<MatchEntity> {
    const { userA, userB } = this.getPair(userId1, userId2);

    // Simulate UNIQUE CONSTRAINT on (userAId, userBId)
    for (const match of this.matches.values()) {
      if (match.userAId === userA && match.userBId === userB) {
        this.logger.warn(`[MOCK] Unique Violation: Match already exists between ${userA} and ${userB}`);
        throw new Error('UNIQUE_VIOLATION');
      }
    }

    const now = new Date();
    const match: MatchEntity = {
      id: randomUUID(),
      userAId: userA,
      userBId: userB,
      status: 'ACTIVE',
      unreadCountA: 0,
      unreadCountB: 0,
      lastInteractionAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.matches.set(match.id, match);
    this.logger.debug(`[MOCK] Match created: ${userA} <-> ${userB} (id: ${match.id})`);
    return { ...match };
  }

  /** Tìm Match theo ID */
  async findById(matchId: string): Promise<MatchEntity | null> {
    const match = this.matches.get(matchId);
    return match ? { ...match } : null;
  }

  /** UC057: Lấy danh sách Match ACTIVE mà userId tham gia, sắp xếp DESC theo lastInteractionAt */
  async findActiveMatchesByUserId(userId: string): Promise<MatchEntity[]> {
    const result: MatchEntity[] = [];
    for (const match of this.matches.values()) {
      if (match.status === 'ACTIVE' && (match.userAId === userId || match.userBId === userId)) {
        result.push({ ...match });
      }
    }
    return result.sort((a, b) => b.lastInteractionAt.getTime() - a.lastInteractionAt.getTime());
  }

  /** Lấy tất cả Match (kể cả UNMATCHED) mà userId tham gia — dùng cho Rematch lookup */
  async findAllMatchesByUserId(userId: string): Promise<MatchEntity[]> {
    const result: MatchEntity[] = [];
    for (const match of this.matches.values()) {
      if (match.userAId === userId || match.userBId === userId) {
        result.push({ ...match });
      }
    }
    return result;
  }

  /** Kiểm tra 2 user đã match hay chưa (bất kể status) */
  async isMatch(userId1: string, userId2: string): Promise<boolean> {
    const { userA, userB } = this.getPair(userId1, userId2);
    for (const match of this.matches.values()) {
      if (match.userAId === userA && match.userBId === userB) {
        return true;
      }
    }
    return false;
  }

  /** Kiểm tra 2 user có ACTIVE match không */
  async isActiveMatch(userId1: string, userId2: string): Promise<boolean> {
    const { userA, userB } = this.getPair(userId1, userId2);
    for (const match of this.matches.values()) {
      if (match.userAId === userA && match.userBId === userB && match.status === 'ACTIVE') {
        return true;
      }
    }
    return false;
  }

  /** UC060: Cập nhật status */
  async updateStatus(matchId: string, newStatus: MatchStatus): Promise<MatchEntity | null> {
    const match = this.matches.get(matchId);
    if (!match) return null;

    match.status = newStatus;
    match.updatedAt = new Date();
    this.logger.debug(`[MOCK] Match ${matchId} status updated to ${newStatus}`);
    return { ...match };
  }

  /** UC062: Reset unread count cho 1 phía */
  async resetUnreadCount(matchId: string, side: 'A' | 'B'): Promise<MatchEntity | null> {
    const match = this.matches.get(matchId);
    if (!match) return null;

    if (side === 'A') {
      match.unreadCountA = 0;
    } else {
      match.unreadCountB = 0;
    }
    match.updatedAt = new Date();
    return { ...match };
  }

  /** Tăng unread count cho 1 phía (sẽ dùng khi Chat gửi tin nhắn) */
  async incrementUnreadCount(matchId: string, side: 'A' | 'B'): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match) return;

    if (side === 'A') {
      match.unreadCountA++;
    } else {
      match.unreadCountB++;
    }
    match.updatedAt = new Date();
  }

  /** Cập nhật lastInteractionAt (khi có tin nhắn mới hoặc tạo Match) */
  async updateLastInteractionAt(matchId: string): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match) return;

    match.lastInteractionAt = new Date();
    match.updatedAt = new Date();
  }
}
