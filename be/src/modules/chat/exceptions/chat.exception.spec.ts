import { ChatException } from './chat.exception';
import { ChatErrorCode } from '../enums/chat-error.enum';
import { HttpStatus } from '@nestjs/common';

describe('ChatException', () => {
  it('should map INVALID_CURSOR to BAD_REQUEST (400)', () => {
    const ex = new ChatException(ChatErrorCode.INVALID_CURSOR);
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ex.code).toBe(ChatErrorCode.INVALID_CURSOR);
  });

  it('should map MATCH_NOT_ACTIVE to FORBIDDEN (403)', () => {
    const ex = new ChatException(ChatErrorCode.MATCH_NOT_ACTIVE);
    expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
  });

  it('should map NOT_IMPLEMENTED to NOT_IMPLEMENTED (501)', () => {
    const ex = new ChatException(ChatErrorCode.NOT_IMPLEMENTED);
    expect(ex.getStatus()).toBe(HttpStatus.NOT_IMPLEMENTED);
  });

  it('should map MATCH_NOT_FOUND to NOT_FOUND (404)', () => {
    const ex = new ChatException(ChatErrorCode.MATCH_NOT_FOUND);
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });
});
