export enum MatchErrorCode {
  MATCH_ALREADY_EXISTS = 'MATCH_ALREADY_EXISTS',
  TARGET_NOT_AVAILABLE = 'TARGET_NOT_AVAILABLE',
}

export class MatchException extends Error {
  constructor(public readonly code: MatchErrorCode, message?: string) {
    super(message || code);
    this.name = 'MatchException';
  }
}
