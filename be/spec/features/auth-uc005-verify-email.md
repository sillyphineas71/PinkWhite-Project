# UC005: Xác thực Email (Verify Email)

> **Revision**: v3 — 2026-05-06. Nâng cấp Production-Grade.

## 1. Context & Goal
Xác thực email ngay sau đăng ký (UC001). Bước BẮT BUỘC trước khi user được cấp JWT.

## 2. Actors & Roles
- Unverified User: Chưa xác thực email, chưa có JWT.

## 3. Out of Scope (Non-goals)
- Dùng SMS OTP.

## 4. Data Model Impact
```prisma
model VerificationToken {
  id        String   @id @default(uuid())
  email     String
  tokenHash String   @unique  // Lưu SHA-256 hash, KHÔNG lưu plain-text
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([email])
  @@index([expiresAt])
}
```

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Request API (p95) | ≤ 200ms |
| Confirm API (p95) | ≤ 300ms |
| DB Write/Delete | ≤ 30ms |
| JWT Sign (khi confirm) | ≤ 5ms |
| Email Job Enqueue | ≤ 10ms |

### 5.2 Security
- Token là chuỗi crypto-secure 32 ký tự. Lưu dạng **SHA-256 hash** trong DB (không lưu plain-text).
- TTL: 15 phút. Chỉ dùng 1 lần. Token cũ bị hủy khi sinh mới.
- Confirm API phải dùng **database transaction** (delete token + update user) để chống race condition.

### 5.3 Observability
- Log `INFO`: `{ action: "EMAIL_VERIFIED", userId, timestamp }` khi xác thực thành công.
- Log `WARN`: `{ action: "VERIFY_TOKEN_INVALID", email (masked), ip, timestamp }` khi token sai/hết hạn.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL sinh token crypto-secure 32 ký tự.
- THE hệ thống SHALL hash token bằng SHA-256 trước khi lưu DB.
- WHEN sinh token mới, THE hệ thống SHALL xóa tất cả token cũ của email đó trước.
- THE hệ thống SHALL gửi email qua Background Job.
- WHEN confirm thành công, THE hệ thống SHALL cấp Access Token (15p) + Refresh Token (7d) lần đầu.
- THE hệ thống SHALL wrap thao tác confirm trong **transaction** (xóa token + update `isEmailVerified` + tạo Session).
- API:
  - `POST /api/auth/verify-email/request` (Body: `{ email }`)
  - `POST /api/auth/verify-email/confirm` (Body: `{ email, token }`)

## 7. Acceptance Criteria
- WHEN user gọi request API, THE hệ thống SHALL hủy token cũ, tạo token mới, enqueue email job và trả về HTTP 200 trong **≤ 200ms (p95)**.
- WHEN user gọi confirm API với token hợp lệ, THE hệ thống SHALL cập nhật `isEmailVerified = true`, cấp JWT và trả về HTTP 200 trong **≤ 300ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token hết hạn hoặc không tồn tại → HTTP 400 "Token không hợp lệ hoặc đã hết hạn".
- WHERE gửi lại email quá 3 lần/giờ → HTTP 429.
- WHERE email đã xác thực trước đó → HTTP 400 "Email đã được xác thực".
- WHERE email không tồn tại → HTTP 404.
- WHERE hai request confirm cùng lúc (race condition), THE hệ thống SHALL dùng transaction + row locking, chỉ 1 request thành công, request còn lại nhận HTTP 400.
- WHERE DB transaction thất bại → rollback, log `ERROR`, trả HTTP 500.
