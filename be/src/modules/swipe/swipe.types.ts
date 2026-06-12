import { HttpException, HttpStatus } from '@nestjs/common';

export enum SwipeErrorCode {
  INVALID_SWIPE_ACTION = 'INVALID_SWIPE_ACTION',
  SWIPE_NOT_ALLOWED = 'SWIPE_NOT_ALLOWED',
  TARGET_NOT_AVAILABLE = 'TARGET_NOT_AVAILABLE',
  SELF_SWIPE_NOT_ALLOWED = 'SELF_SWIPE_NOT_ALLOWED',
  ALREADY_MATCHED = 'ALREADY_MATCHED',
}

export class SwipeException extends HttpException {
  constructor(public readonly code: SwipeErrorCode) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    switch (code) {
      case SwipeErrorCode.INVALID_SWIPE_ACTION:
      case SwipeErrorCode.SELF_SWIPE_NOT_ALLOWED:
      case SwipeErrorCode.ALREADY_MATCHED:
        status = HttpStatus.BAD_REQUEST;
        break;
      case SwipeErrorCode.SWIPE_NOT_ALLOWED:
        status = HttpStatus.FORBIDDEN;
        break;
      case SwipeErrorCode.TARGET_NOT_AVAILABLE:
        status = HttpStatus.NOT_FOUND;
        break;
    }
    super({ code }, status);
    this.name = 'SwipeException';
  }
}
