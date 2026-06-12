import { BadRequestException } from '@nestjs/common';

export interface DiscoveryCursorPayload {
  distanceMeters: number;
  candidateUserId: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeDiscoveryCursor(
  distanceMeters: number,
  candidateUserId: string,
): string {
  const payload: DiscoveryCursorPayload = { distanceMeters, candidateUserId };
  const jsonStr = JSON.stringify(payload);
  return Buffer.from(jsonStr, 'utf-8').toString('base64');
}

export function decodeDiscoveryCursor(
  cursor?: string,
): DiscoveryCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(cursor, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonStr);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.distanceMeters !== 'number' ||
      !Number.isInteger(payload.distanceMeters) ||
      payload.distanceMeters < 0 ||
      typeof payload.candidateUserId !== 'string' ||
      !UUID_REGEX.test(payload.candidateUserId)
    ) {
      throw new Error('Invalid cursor shape');
    }

    return {
      distanceMeters: payload.distanceMeters,
      candidateUserId: payload.candidateUserId,
    };
  } catch (error) {
    throw new BadRequestException('INVALID_CURSOR');
  }
}
