import { ChatErrorCode } from '../enums/chat-error.enum';
import { ChatException } from '../exceptions/chat.exception';

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export interface InboxCursor {
  lastMessageAt: string | null;
  matchId: string;
}

export class ChatCursorUtil {
  static encodeMessageCursor(cursor: MessageCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  static decodeMessageCursor(encoded: string): MessageCursor {
    try {
      const json = Buffer.from(encoded, 'base64').toString('utf-8');
      const cursor = JSON.parse(json);

      if (
        typeof cursor !== 'object' ||
        cursor === null ||
        typeof cursor.createdAt !== 'string' ||
        typeof cursor.id !== 'string'
      ) {
        throw new Error('Invalid cursor shape');
      }

      return cursor as MessageCursor;
    } catch {
      throw new ChatException(ChatErrorCode.INVALID_CURSOR);
    }
  }

  static encodeInboxCursor(cursor: InboxCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  static decodeInboxCursor(encoded: string): InboxCursor {
    try {
      const json = Buffer.from(encoded, 'base64').toString('utf-8');
      const cursor = JSON.parse(json);

      if (
        typeof cursor !== 'object' ||
        cursor === null ||
        (cursor.lastMessageAt !== null &&
          typeof cursor.lastMessageAt !== 'string') ||
        typeof cursor.matchId !== 'string'
      ) {
        throw new Error('Invalid cursor shape');
      }

      return cursor as InboxCursor;
    } catch {
      throw new ChatException(ChatErrorCode.INVALID_CURSOR);
    }
  }
}
