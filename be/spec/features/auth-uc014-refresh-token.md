# UC014: Refresh Access Token

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Thêm Session schema chi tiết.
> - Thêm Performance SLA, Observability.
> - Refresh Token Rotation + Reuse Detection.

## 1. Context & Goal
Duy trì phiên đăng nhập bảo mật bằng cách cấp mới Access Token (15 phút) mà không cần user đăng nhập lại. Sử dụng cơ chế **Refresh Token Rotation** để đảm bảo mỗi Refresh Token chỉ dùng được 1 lần.

## 2. Actors & Roles
- User: Người dùng đã đăng nhập, Access Token hết hạn.

## 3. Out of Scope (Non-goals)
- Quản lý device fingerprint.

## 4. Data Model Impact
```prisma
model Session {
  id               String   @id @default(uuid())
  userId           String
  refreshTokenHash String   @unique  // SHA-256 hash
  userAgent        String?
  ipAddress        String?
  expiresAt        DateTime
  createdAt        DateTime @default(now())
  user             User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}
```

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 150ms |
| Response Time (p99) | ≤ 300ms |
| DB Read (SELECT Session) | ≤ 20ms |
| DB Update (rotate token) | ≤ 30ms |
| JWT Sign | ≤ 5ms |
| Throughput | ≥ 1000 req/s |

### 5.2 Security
- **Refresh Token Rotation**: Mỗi lần sử dụng, hệ thống cấp Refresh Token mới và vô hiệu hóa cái cũ.
- **Reuse Detection**: Nếu phát hiện Refresh Token cũ (đã bị rotate) bị sử dụng lại → dấu hiệu bị đánh cắp → thu hồi TOÀN BỘ Session của user.
- Refresh Token lưu dạng SHA-256 hash trong DB.

### 5.3 Observability
- Log `INFO`: `{ action: "TOKEN_REFRESHED", userId, ip, timestamp }`.
- Log `CRITICAL`: `{ action: "REFRESH_TOKEN_REUSE_DETECTED", userId, ip, timestamp }` khi phát hiện token reuse (PHẢI alert ngay).

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL đọc Refresh Token từ Cookie (path: `/api/auth/refresh`).
- THE hệ thống SHALL hash Refresh Token bằng SHA-256 và so khớp với `refreshTokenHash` trong DB.
- THE hệ thống SHALL kiểm tra `expiresAt` của Session.
- THE hệ thống SHALL kiểm tra trạng thái user (isBanned, deletedAt) trước khi cấp token mới.
- THE hệ thống SHALL sinh Refresh Token mới, hash SHA-256 và cập nhật DB (rotate).
- THE hệ thống SHALL cấp Access Token mới (15p) + Refresh Token mới (7d) qua `Set-Cookie`.
- API: `POST /api/auth/refresh` (Không cần Body, đọc từ Cookie)
- Response (200): `{ "message": "Token đã được làm mới" }`

## 7. Acceptance Criteria
- WHEN user gọi API kèm Refresh Token hợp lệ, THE hệ thống SHALL cấp Access/Refresh Token mới, rotate token trong DB và trả về HTTP 200 trong **≤ 150ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Refresh Token hết hạn hoặc không tồn tại → HTTP 401.
- WHERE phát hiện **Refresh Token reuse** (token cũ đã bị rotate), THE hệ thống SHALL **thu hồi toàn bộ Session** của user, log `CRITICAL` và trả về HTTP 401.
- WHERE user bị banned (`isBanned = true`) → HTTP 403 (không cấp token mới).
- WHERE user bị soft deleted → xử lý theo luồng pendingRestore.
- WHERE DB timeout > **200ms** → HTTP 503, log `ERROR`.
