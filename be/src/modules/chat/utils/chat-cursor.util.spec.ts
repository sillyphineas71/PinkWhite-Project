import { ChatCursorUtil, MessageCursor, InboxCursor } from './chat-cursor.util';
import { ChatException } from '../exceptions/chat.exception';
import { ChatErrorCode } from '../enums/chat-error.enum';

describe('ChatCursorUtil', () => {
  describe('MessageCursor', () => {
    it('should round-trip encode and decode correctly', () => {
      const original: MessageCursor = {
        createdAt: new Date().toISOString(),
        id: 'msg-123',
      };

      const encoded = ChatCursorUtil.encodeMessageCursor(original);
      const decoded = ChatCursorUtil.decodeMessageCursor(encoded);

      expect(decoded).toEqual(original);
    });

    it('should throw INVALID_CURSOR for malformed base64', () => {
      expect(() =>
        ChatCursorUtil.decodeMessageCursor('not-base64-json'),
      ).toThrow(ChatException);
      try {
        ChatCursorUtil.decodeMessageCursor('not-base64-json');
      } catch (e: any) {
        expect(e.code).toBe(ChatErrorCode.INVALID_CURSOR);
      }
    });

    it('should throw INVALID_CURSOR for invalid shape', () => {
      const invalidShape = Buffer.from(
        JSON.stringify({ missingId: true }),
      ).toString('base64');
      expect(() => ChatCursorUtil.decodeMessageCursor(invalidShape)).toThrow(
        ChatException,
      );
    });
  });

  describe('InboxCursor', () => {
    it('should round-trip encode and decode correctly', () => {
      const original: InboxCursor = {
        lastMessageAt: new Date().toISOString(),
        matchId: 'match-123',
      };

      const encoded = ChatCursorUtil.encodeInboxCursor(original);
      const decoded = ChatCursorUtil.decodeInboxCursor(encoded);

      expect(decoded).toEqual(original);
    });

    it('should round-trip correctly with null lastMessageAt', () => {
      const original: InboxCursor = {
        lastMessageAt: null,
        matchId: 'match-123',
      };

      const encoded = ChatCursorUtil.encodeInboxCursor(original);
      const decoded = ChatCursorUtil.decodeInboxCursor(encoded);

      expect(decoded).toEqual(original);
    });

    it('should throw INVALID_CURSOR for invalid shape', () => {
      const invalidShape = Buffer.from(
        JSON.stringify({ matchId: 123 }),
      ).toString('base64');
      expect(() => ChatCursorUtil.decodeInboxCursor(invalidShape)).toThrow(
        ChatException,
      );
    });
  });
});
