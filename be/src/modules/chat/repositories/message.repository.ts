import { Injectable } from '@nestjs/common';
import { Prisma, MessageType as PrismaMessageType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MessageCursor } from '../utils/chat-cursor.util';
import { MessageType } from '../dto/send-message.dto';

export type CreateMessageData = {
  matchId: string;
  senderId: string;
  messageType: MessageType;
  body: string;
};

export type MatchRowForUpdate = {
  id: string;
  lastReadMessageIdA: string | null;
  lastReadMessageIdB: string | null;
  unreadCountA: number;
  unreadCountB: number;
  userAId: string;
  userBId: string;
  status: string;
};

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMessage(tx: Prisma.TransactionClient, data: CreateMessageData) {
    return tx.message.create({
      data: {
        matchId: data.matchId,
        senderId: data.senderId,
        messageType:
          data.messageType === MessageType.IMAGE
            ? PrismaMessageType.IMAGE
            : PrismaMessageType.TEXT,
        body: data.body,
      },
    });
  }

  async findMessagesPage(
    matchId: string,
    params: { cursor?: MessageCursor; limit: number },
  ) {
    const { cursor, limit } = params;
    const limitPlusOne = limit + 1;

    let where: Prisma.MessageWhereInput = { matchId };

    if (cursor) {
      where = {
        ...where,
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          {
            createdAt: new Date(cursor.createdAt),
            id: { lt: cursor.id },
          },
        ],
      };
    }

    return this.prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limitPlusOne,
    });
  }

  async lockMatchRowForUpdate(
    tx: Prisma.TransactionClient,
    matchId: string,
  ): Promise<MatchRowForUpdate | null> {
    const rows = await tx.$queryRaw<any[]>`
      SELECT 
        id, 
        last_read_message_id_a AS "lastReadMessageIdA",
        last_read_message_id_b AS "lastReadMessageIdB",
        unread_count_a AS "unreadCountA",
        unread_count_b AS "unreadCountB",
        user_a_id AS "userAId",
        user_b_id AS "userBId",
        status
      FROM matches 
      WHERE id = ${matchId}::uuid 
      FOR UPDATE
    `;

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      lastReadMessageIdA: r.lastReadMessageIdA,
      lastReadMessageIdB: r.lastReadMessageIdB,
      unreadCountA: Number(r.unreadCountA),
      unreadCountB: Number(r.unreadCountB),
      userAId: r.userAId,
      userBId: r.userBId,
      status: String(r.status).toUpperCase(),
    };
  }

  async getMaxPartnerMessageId(
    tx: Prisma.TransactionClient,
    matchId: string,
    partnerId: string,
  ): Promise<string | null> {
    const rows = await tx.$queryRaw<any[]>`
      SELECT id AS "maxId"
      FROM messages
      WHERE match_id = ${matchId}::uuid AND sender_id = ${partnerId}::uuid
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows.length > 0 ? rows[0].maxId : null;
  }

  async countUnreadAfter(
    tx: Prisma.TransactionClient,
    matchId: string,
    partnerId: string,
    afterId: string | null,
  ): Promise<number> {
    if (afterId === null) {
      const rows = await tx.$queryRaw<any[]>`
        SELECT COUNT(*) AS "cnt"
        FROM messages
        WHERE match_id = ${matchId}::uuid AND sender_id = ${partnerId}::uuid
      `;
      return rows.length > 0 ? Number(rows[0].cnt) : 0;
    } else {
      const rows = await tx.$queryRaw<any[]>`
        SELECT COUNT(*) AS "cnt"
        FROM messages
        WHERE match_id = ${matchId}::uuid 
          AND sender_id = ${partnerId}::uuid 
          AND id > ${afterId}::uuid
      `;
      return rows.length > 0 ? Number(rows[0].cnt) : 0;
    }
  }
}
