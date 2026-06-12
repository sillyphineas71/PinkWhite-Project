import { encodeDiscoveryCursor, decodeDiscoveryCursor } from './discovery-cursor.util';
import { BadRequestException } from '@nestjs/common';

describe('Discovery Cursor Util', () => {
  it('should encode and decode correctly', () => {
    const candidateUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const distanceMeters = 12345;
    
    const encoded = encodeDiscoveryCursor(distanceMeters, candidateUserId);
    expect(typeof encoded).toBe('string');
    
    const decoded = decodeDiscoveryCursor(encoded);
    expect(decoded).toBeDefined();
    expect(decoded!.candidateUserId).toBe(candidateUserId);
    expect(decoded!.distanceMeters).toBe(distanceMeters);
  });

  it('should return null when decoding null/undefined', () => {
    expect(decodeDiscoveryCursor(undefined)).toBeNull();
    expect(decodeDiscoveryCursor(null as unknown as string)).toBeNull();
    expect(decodeDiscoveryCursor('')).toBeNull();
  });

  it('should throw INVALID_CURSOR on invalid base64', () => {
    expect(() => decodeDiscoveryCursor('invalid-base64-!@#')).toThrow(BadRequestException);
    try {
      decodeDiscoveryCursor('invalid-base64-!@#');
    } catch (e: any) {
      expect(e.response.message).toBe('INVALID_CURSOR');
    }
  });

  it('should throw INVALID_CURSOR on invalid JSON', () => {
    const invalidJson = Buffer.from('{"bad":"json"').toString('base64');
    expect(() => decodeDiscoveryCursor(invalidJson)).toThrow(BadRequestException);
  });

  it('should throw INVALID_CURSOR on missing distanceMeters', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ candidateUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })).toString('base64');
    expect(() => decodeDiscoveryCursor(invalidPayload)).toThrow(BadRequestException);
  });

  it('should throw INVALID_CURSOR on negative distanceMeters', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ distanceMeters: -1, candidateUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })).toString('base64');
    expect(() => decodeDiscoveryCursor(invalidPayload)).toThrow(BadRequestException);
  });

  it('should throw INVALID_CURSOR on non-integer distanceMeters', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ distanceMeters: 1.5, candidateUserId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })).toString('base64');
    expect(() => decodeDiscoveryCursor(invalidPayload)).toThrow(BadRequestException);
  });

  it('should throw INVALID_CURSOR on missing candidateUserId', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ distanceMeters: 100 })).toString('base64');
    expect(() => decodeDiscoveryCursor(invalidPayload)).toThrow(BadRequestException);
  });

  it('should throw INVALID_CURSOR on invalid candidateUserId shape', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ distanceMeters: 100, candidateUserId: 'not-a-uuid' })).toString('base64');
    expect(() => decodeDiscoveryCursor(invalidPayload)).toThrow(BadRequestException);
  });
});
