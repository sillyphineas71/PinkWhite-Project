import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MatchWriteRepository } from '../repositories/match-write.repository';
import { MatchException, MatchErrorCode } from '../match.types';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class MatchCreationService {
  constructor(private readonly matchWriteRepo: MatchWriteRepository) {}

  async createMatchPair(tx: TxClient, params: { requesterId: string; targetUserId: string; occurredAt: Date }) {
    const match = await this.matchWriteRepo.createActiveMatchSafe(tx, params.requesterId, params.targetUserId, params.occurredAt);
    
    if (!match) {
      throw new Error('Internal consistency error: Match not found after createMany');
    }

    if (match.status === 'ACTIVE') {
      return match;
    } else {
      throw new MatchException(MatchErrorCode.TARGET_NOT_AVAILABLE);
    }
  }
}
