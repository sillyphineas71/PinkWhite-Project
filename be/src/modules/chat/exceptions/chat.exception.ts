import { HttpException, HttpStatus } from '@nestjs/common';
import { ChatErrorCode } from '../enums/chat-error.enum';

export class ChatException extends HttpException {
  constructor(public readonly code: ChatErrorCode) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    switch (code) {
      case ChatErrorCode.MESSAGE_EMPTY:
      case ChatErrorCode.MESSAGE_TOO_LONG:
      case ChatErrorCode.IMAGE_NOT_SUPPORTED:
      case ChatErrorCode.INVALID_CURSOR:
        status = HttpStatus.BAD_REQUEST; // 400
        break;
      case ChatErrorCode.NOT_PARTICIPANT:
      case ChatErrorCode.MATCH_NOT_ACTIVE:
        status = HttpStatus.FORBIDDEN; // 403
        break;
      case ChatErrorCode.MATCH_NOT_FOUND:
        status = HttpStatus.NOT_FOUND; // 404
        break;
      case ChatErrorCode.NOT_IMPLEMENTED:
        status = HttpStatus.NOT_IMPLEMENTED; // 501
        break;
    }
    super({ code }, status);
    this.name = 'ChatException';
  }
}
