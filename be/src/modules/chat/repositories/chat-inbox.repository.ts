import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { InboxCursor } from '../utils/chat-cursor.util';
import { MessageType } from '../dto/send-message.dto';

export type InboxRow = {
  matchId: string;
  partnerUserId: string;
  partnerDisplayName: string;
  partnerAvatarUrl: string | null;
  unreadCount: number;
  latestMessageId: string | null;
  latestMessageSenderId: string | null;
  latestMessageType: string | null;
  latestMessageBody: string | null;
  latestMessageCreatedAt: Date | null;
  lastMessageAt: Date | null;
};

@Injectable()
export class ChatInboxRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findInboxPage(
    userId: string,
    params: { cursor?: InboxCursor; limit: number },
  ): Promise<InboxRow[]> {
    const { cursor, limit } = params;
    const limitPlusOne = limit + 1;

    let cursorCondition = Prisma.sql``;

    if (cursor) {
      if (cursor.lastMessageAt !== null) {
        // match has a message
        const ts = cursor.lastMessageAt;
        cursorCondition = Prisma.sql`
          AND (
            (m.last_message_at < ${ts}::timestamptz)
            OR (m.last_message_at = ${ts}::timestamptz AND m.id < ${cursor.matchId}::uuid)
            OR (m.last_message_at IS NULL)
          )
        `;
      } else {
        // match doesn't have a message
        cursorCondition = Prisma.sql`
          AND (m.last_message_at IS NULL AND m.id < ${cursor.matchId}::uuid)
        `;
      }
    }

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        m.id AS "matchId",
        p.user_id AS "partnerUserId",
        p.display_name AS "partnerDisplayName",
        pp.public_url AS "partnerAvatarUrl",
        CASE WHEN m.user_a_id = ${userId}::uuid THEN m.unread_count_a ELSE m.unread_count_b END AS "unreadCount",
        msg.id AS "latestMessageId",
        msg.sender_id AS "latestMessageSenderId",
        msg.message_type AS "latestMessageType",
        msg.body AS "latestMessageBody",
        msg.created_at AS "latestMessageCreatedAt",
        m.last_message_at AS "lastMessageAt"
      FROM matches m
      JOIN profiles p ON p.user_id = CASE WHEN m.user_a_id = ${userId}::uuid THEN m.user_b_id ELSE m.user_a_id END
      LEFT JOIN profile_photos pp ON pp.user_id = p.user_id AND pp.is_avatar = true AND pp.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT id, sender_id, message_type, body, created_at
        FROM messages
        WHERE match_id = m.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) msg ON true
      WHERE (m.user_a_id = ${userId}::uuid OR m.user_b_id = ${userId}::uuid)
        AND m.status = 'active'::match_status
        ${cursorCondition}
      ORDER BY m.last_message_at DESC NULLS LAST, m.id DESC
      LIMIT ${limitPlusOne}
    `;

    return rows.map((r: any) => ({
      matchId: r.matchId,
      partnerUserId: r.partnerUserId,
      partnerDisplayName: r.partnerDisplayName,
      partnerAvatarUrl: r.partnerAvatarUrl,
      unreadCount: Number(r.unreadCount),
      latestMessageId: r.latestMessageId,
      latestMessageSenderId: r.latestMessageSenderId,
      latestMessageType: r.latestMessageType,
      latestMessageBody: r.latestMessageBody,
      latestMessageCreatedAt: r.latestMessageCreatedAt,
      lastMessageAt: r.lastMessageAt,
    }));
  }
}
