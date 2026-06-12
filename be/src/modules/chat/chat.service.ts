import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessageRepository } from './repositories/message.repository';
import { SendMessageDto, MessageType } from './dto/send-message.dto';
import { ChatException } from './exceptions/chat.exception';
import { ChatErrorCode } from './enums/chat-error.enum';
import { PaginationQueryDto, InboxItemDto } from './dto/inbox.dto';
import { MessageDto } from './dto/message.dto';
import { ChatCursorUtil } from './utils/chat-cursor.util';
import { ChatInboxRepository } from './repositories/chat-inbox.repository';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRepository: MessageRepository,
    private readonly chatInboxRepository: ChatInboxRepository,
  ) { }

  async sendMessage(
    userId: string,
    matchId: string,
    dto: SendMessageDto,
  ): Promise<MessageDto> {
    // 1. Domain validations
    const body = dto.body?.trim();
    if (!body || body.length === 0) {
      throw new ChatException(ChatErrorCode.MESSAGE_EMPTY);
    }
    if (body.length > 1000) {
      throw new ChatException(ChatErrorCode.MESSAGE_TOO_LONG);
    }
    if (dto.messageType === MessageType.IMAGE) {
      throw new ChatException(ChatErrorCode.IMAGE_NOT_SUPPORTED);
    }

    // 2. Transaction
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock match row to prevent TOCTOU and serialize execution
      const match = await this.messageRepository.lockMatchRowForUpdate(
        tx,
        matchId,
      );
      if (!match) {
        throw new ChatException(ChatErrorCode.MATCH_NOT_FOUND);
      }

      if (match.userAId !== userId && match.userBId !== userId) {
        throw new ChatException(ChatErrorCode.NOT_PARTICIPANT);
      }

      if (match.status !== 'ACTIVE') {
        throw new ChatException(ChatErrorCode.MATCH_NOT_ACTIVE);
      }

      const isUserA = match.userAId === userId;
      const now = new Date();

      // Create the message
      const message = await this.messageRepository.createMessage(tx, {
        matchId,
        senderId: userId,
        messageType: dto.messageType ?? MessageType.TEXT,
        body,
      });

      // Update Match denormalized fields
      await tx.match.update({
        where: { id: matchId },
        data: {
          lastMessageAt: now,
          lastInteractionAt: now,
          unreadCountA: isUserA ? undefined : { increment: 1 },
          unreadCountB: isUserA ? { increment: 1 } : undefined,
        },
      });

      return {
        id: message.id,
        matchId: message.matchId,
        senderId: message.senderId,
        messageType: message.messageType as MessageType,
        body: message.body,
        mediaUrl: message.mediaUrl,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      };
    });
  }

  async getConversationMessages(
    userId: string,
    matchId: string,
    query: PaginationQueryDto,
  ) {
    // Check Match
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new ChatException(ChatErrorCode.MATCH_NOT_FOUND);
    }

    if (match.userAId !== userId && match.userBId !== userId) {
      throw new ChatException(ChatErrorCode.NOT_PARTICIPANT);
    }

    if (match.status !== 'ACTIVE') {
      throw new ChatException(ChatErrorCode.MATCH_NOT_ACTIVE);
    }

    let cursorCondition = undefined;
    if (query.cursor) {
      const decodedCursor = ChatCursorUtil.decodeMessageCursor(query.cursor);
      if (!decodedCursor) {
        throw new ChatException(ChatErrorCode.INVALID_CURSOR);
      }
      cursorCondition = decodedCursor;
    }

    const limit = query.limit ?? 20;
    const messages = await this.messageRepository.findMessagesPage(matchId, {
      limit,
      cursor: cursorCondition,
    });

    const hasMore = messages.length > limit;
    const paginatedMessages = hasMore
      ? messages.slice(0, limit)
      : messages;

    let nextCursor: string | undefined = undefined;
    if (hasMore) {
      const lastMessage = paginatedMessages[paginatedMessages.length - 1];
      nextCursor = ChatCursorUtil.encodeMessageCursor({
        id: lastMessage.id,
        createdAt: lastMessage.createdAt.toISOString(),
      });
    }

    const data: MessageDto[] = paginatedMessages.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      messageType: m.messageType as MessageType,
      body: m.body,
      mediaUrl: m.mediaUrl,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }));

    return {
      data,
      nextCursor,
    };
  }

  async markConversationAsRead(
    userId: string,
    matchId: string,
  ): Promise<{ success: boolean }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Lock match
      const match = await this.messageRepository.lockMatchRowForUpdate(
        tx,
        matchId,
      );
      if (!match) {
        throw new ChatException(ChatErrorCode.MATCH_NOT_FOUND);
      }
      if (match.userAId !== userId && match.userBId !== userId) {
        throw new ChatException(ChatErrorCode.NOT_PARTICIPANT);
      }
      if (match.status !== 'ACTIVE') {
        throw new ChatException(ChatErrorCode.MATCH_NOT_ACTIVE);
      }

      // 2. Determine side and partner
      const isUserA = match.userAId === userId;
      const partnerId = isUserA ? match.userBId : match.userAId;
      const currentPointer = isUserA
        ? match.lastReadMessageIdA
        : match.lastReadMessageIdB;

      // 3. Get newest partner message ID
      const newestPartnerId =
        await this.messageRepository.getMaxPartnerMessageId(
          tx,
          matchId,
          partnerId,
        );

      // 4. Calculate new pointer
      let newPointer = currentPointer;
      if (
        currentPointer === null ||
        (newestPartnerId !== null && newestPartnerId > currentPointer)
      ) {
        newPointer = newestPartnerId ?? currentPointer;
      }

      // 5. Count unread after new pointer
      const unread = await this.messageRepository.countUnreadAfter(
        tx,
        matchId,
        partnerId,
        newPointer,
      );

      // 6. Update match
      const updateData: any = {};
      if (isUserA) {
        updateData.lastReadMessageIdA = newPointer;
        updateData.lastReadAtA = new Date();
        updateData.unreadCountA = unread;
      } else {
        updateData.lastReadMessageIdB = newPointer;
        updateData.lastReadAtB = new Date();
        updateData.unreadCountB = unread;
      }

      await tx.match.update({
        where: { id: matchId },
        data: updateData,
      });

      return { success: true };
    });
  }

  async getInbox(userId: string, query: PaginationQueryDto) {
    let cursorCondition = undefined;
    if (query.cursor) {
      const decodedCursor = ChatCursorUtil.decodeInboxCursor(query.cursor);
      if (!decodedCursor) {
        throw new ChatException(ChatErrorCode.INVALID_CURSOR);
      }
      cursorCondition = decodedCursor;
    }

    const rows = await this.chatInboxRepository.findInboxPage(userId, {
      limit: query.limit ?? 20,
      cursor: cursorCondition,
    });

    const hasMore = rows.length > (query.limit ?? 20);
    const paginatedRows = hasMore ? rows.slice(0, query.limit ?? 20) : rows;

    let nextCursor: string | undefined = undefined;
    if (hasMore) {
      const lastRow = paginatedRows[paginatedRows.length - 1];
      nextCursor = ChatCursorUtil.encodeInboxCursor({
        matchId: lastRow.matchId,
        lastMessageAt: lastRow.lastMessageAt
          ? lastRow.lastMessageAt.toISOString()
          : null,
      });
    }

    const data: InboxItemDto[] = paginatedRows.map((row) => {
      let latestMessage: MessageDto | null = null;
      if (row.latestMessageId) {
        latestMessage = {
          id: row.latestMessageId,
          matchId: row.matchId,
          senderId: row.latestMessageSenderId!,
          messageType: row.latestMessageType as MessageType,
          body: row.latestMessageBody!,
          // Phase 4 scope: text-only (D1) so mediaUrl is always null;
          // no per-message soft-delete (D3) so status is always 'SENT'.
          mediaUrl: null,
          status: 'SENT',
          createdAt: row.latestMessageCreatedAt!.toISOString(),
        };
      }

      return {
        matchId: row.matchId,
        partner: {
          userId: row.partnerUserId,
          displayName: row.partnerDisplayName,
          avatar: row.partnerAvatarUrl,
        },
        latestMessage,
        unreadCount: row.unreadCount,
      };
    });

    return {
      data,
      nextCursor,
      hasMore,
    };
  }
}
