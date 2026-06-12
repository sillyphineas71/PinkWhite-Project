import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class MatchWriteRepository {
  normalizePair(userId1: string, userId2: string) {
    return {
      userAId: userId1 < userId2 ? userId1 : userId2,
      userBId: userId1 > userId2 ? userId1 : userId2,
    };
  }

  async acquirePairTransactionLock(tx: TxClient, userId1: string, userId2: string) {
    const { userAId, userBId } = this.normalizePair(userId1, userId2);
    const pairKey = `${userAId}:${userBId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`;
  }

  async findMatchByPair(tx: TxClient, userId1: string, userId2: string) {
    const { userAId, userBId } = this.normalizePair(userId1, userId2);
    return tx.match.findUnique({
      where: {
        userAId_userBId: {
          userAId,
          userBId
        }
      }
    });
  }

  async createActiveMatchSafe(tx: TxClient, userId1: string, userId2: string, now: Date) {
    const { userAId, userBId } = this.normalizePair(userId1, userId2);
    
    await tx.match.createMany({
      data: [{
        userAId,
        userBId,
        status: 'ACTIVE',
        matchedAt: now,
        createdAt: now,
        updatedAt: now
      }],
      skipDuplicates: true
    });

    return tx.match.findUnique({
      where: {
        userAId_userBId: {
          userAId,
          userBId
        }
      }
    });
  }
}
