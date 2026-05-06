# UC009: Login via Google OAuth

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Provider duy nhất (Q4: xóa Facebook, Apple).
> - Thêm Performance SLA, Observability, Data Model chi tiết.

## 1. Context & Goal
Đăng nhập hoặc đăng ký nhanh bằng tài khoản Google. Nếu user chưa tồn tại, hệ thống tự tạo tài khoản mới và đánh dấu `isEmailVerified = true` (vì Google đã verify email).

## 2. Actors & Roles
- Guest: Người dùng chưa đăng nhập.

## 3. Out of Scope (Non-goals)
- Link/Unlink tài khoản Google vào tài khoản Email có sẵn.
- Facebook OAuth, Apple ID OAuth (đã loại khỏi scope).

## 4. Data Model Impact
```prisma
model SocialAccount {
  id             String   @id @default(uuid())
  userId         String
  provider       String   // "GOOGLE"
  providerUserId String
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId])
  @@index([userId])
}
```

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 1500ms |
| Response Time (p99) | ≤ 3000ms |
| Google API verify | ≤ 1000ms (timeout 5s) |
| DB Read/Write | ≤ 50ms |
| JWT Sign | ≤ 5ms |
| Throughput | ≥ 200 req/s |

> ⚠️ Response time cao hơn các API khác vì phụ thuộc network call tới Google.

### 5.2 Security
- THE hệ thống SHALL verify Google ID Token trực tiếp với Google API, TUYỆT ĐỐI không tin dữ liệu từ FE.
- Thiết lập HTTP timeout **5 giây** khi gọi Google API.
- Cấp Access Token (15p) + Refresh Token (7d) giống UC002.

### 5.3 Observability
- Log `INFO`: `{ action: "SOCIAL_LOGIN_SUCCESS", provider: "GOOGLE", userId, ip, timestamp }`.
- Log `WARN`: `{ action: "SOCIAL_LOGIN_FAILED", provider: "GOOGLE", reason, ip, timestamp }`.
- Log `ERROR`: `{ action: "GOOGLE_API_ERROR", statusCode, responseTime, timestamp }` khi Google API lỗi.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL verify Google ID Token với Google OAuth2 API.
- THE hệ thống SHALL strip `+alias` và lowercase email lấy từ Google (đồng nhất với UC001).
- WHEN email chưa tồn tại, THE hệ thống SHALL tạo User mới + SocialAccount trong **1 transaction**, set `isEmailVerified = true`.
- WHEN email đã tồn tại VÀ đã có SocialAccount link, THE hệ thống SHALL login bình thường.
- WHEN email đã tồn tại NHƯNG chưa có SocialAccount link (đăng ký bằng email trước đó), THE hệ thống SHALL trả lỗi 409 yêu cầu đăng nhập bằng email.
- THE hệ thống SHALL cấp Access Token + Refresh Token qua `Set-Cookie`.
- API: `POST /api/auth/social/google` (Body: `{ idToken }`)
- Response (200): `{ "message": "Đăng nhập thành công", "user": { "id", "email", "isOnboarded" } }`

## 7. Acceptance Criteria
- WHEN guest gọi API với Google ID Token hợp lệ, THE hệ thống SHALL verify token, login (hoặc tạo tài khoản mới), cấp JWT và trả về HTTP 200 trong **≤ 1500ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Google ID Token không hợp lệ hoặc bị từ chối → HTTP 401.
- WHERE email từ Google trùng với tài khoản email/password (chưa link) → HTTP 409 "Tài khoản với email này đã tồn tại. Vui lòng đăng nhập bằng email."
- WHERE tài khoản bị banned → HTTP 403.
- WHERE tài khoản bị soft deleted → xử lý theo luồng pendingRestore (UC013).
- WHERE Google API timeout > **5s** → HTTP 502 (Bad Gateway), log `ERROR`.
- WHERE Google API trả lỗi (5xx) → HTTP 502, log `ERROR`.
- WHERE DB transaction thất bại → rollback, log `ERROR`, trả HTTP 500.
