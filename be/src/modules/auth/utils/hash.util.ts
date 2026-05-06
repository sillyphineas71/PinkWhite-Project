import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Hash password bằng bcrypt (UC001, UC007, UC008)
 */
export async function hashPassword(
  password: string,
  rounds: number,
): Promise<string> {
  return bcrypt.hash(password, rounds);
}

/**
 * So sánh password bằng bcrypt - constant-time (UC002, UC008, UC012)
 */
export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Chạy dummy bcrypt hash để chống Timing Attack (UC002)
 * Khi email không tồn tại, vẫn tốn ~300ms như khi email tồn tại
 */
export async function dummyBcryptCompare(rounds: number): Promise<void> {
  const dummyHash = await bcrypt.hash('dummy', rounds);
  await bcrypt.compare('dummy-input', dummyHash);
}

/**
 * Hash token bằng SHA-256 (UC005, UC006, UC014)
 * Dùng cho VerificationToken, ResetPasswordToken, RefreshToken
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Sinh token crypto-secure 32 ký tự (UC005, UC006)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
