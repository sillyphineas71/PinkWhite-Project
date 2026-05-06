/**
 * Chuẩn hóa email theo đúng UC001 Spec:
 * 1. Trim khoảng trắng 2 đầu
 * 2. Lowercase toàn bộ
 * 3. Strip phần +alias trước ký tự @ (ví dụ: user+1@gmail.com → user@gmail.com)
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [localPart, domain] = trimmed.split('@');

  if (!localPart || !domain) {
    return trimmed;
  }

  // Strip +alias
  const cleanLocal = localPart.split('+')[0];
  return `${cleanLocal}@${domain}`;
}
