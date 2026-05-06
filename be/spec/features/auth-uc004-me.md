# UC004: Lấy thông tin user hiện tại (Get /me)

> **Revision**: v3 — 2026-05-06. Nâng cấp Production-Grade.

## 1. Context & Goal
Trả về thông tin cơ bản của người dùng đang đăng nhập. Đây là API hot-path — gọi mỗi lần user mở app.

## 2. Actors & Roles
- User: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Lấy thông tin chi tiết Profile.

## 4. Data Model Impact
- Read: `id`, `email`, `isOnboarded`, `isEmailVerified`, `isBanned`, `deletedAt` từ `User`.

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 80ms |
| Response Time (p99) | ≤ 150ms |
| DB Read (SELECT by PK) | ≤ 20ms |
| JWT Verify | ≤ 2ms |
| Throughput | ≥ 3000 req/s |

### 5.2 Caching Strategy
- Cache trạng thái user trong Redis, TTL **30 giây**.
- WHEN Admin ban/unban/delete user, THE hệ thống SHALL invalidate cache ngay lập tức.

### 5.3 Security
- Query DB (hoặc cache) mỗi lần gọi để check `isBanned`/`deletedAt` realtime.

### 5.4 Observability
- Log `WARN`: `{ action: "BANNED_USER_ACCESS", userId, ip, timestamp }` khi user bị ban cố truy cập.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request, THE hệ thống SHALL xác thực Access Token qua JwtGuard.
- THE hệ thống SHALL chỉ SELECT đúng các cột cần thiết — KHÔNG SELECT *.
- API: `GET /api/auth/me`
- Response (200): `{ id, email, isOnboarded, isEmailVerified }`

## 7. Acceptance Criteria
- WHEN user gọi API với Access Token hợp lệ, THE hệ thống SHALL trả về HTTP 200 trong vòng **≤ 80ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE không có Cookie hoặc Token hết hạn → HTTP 401 trong **≤ 10ms**.
- WHERE `isBanned = true` → HTTP 403 "Tài khoản đã bị khóa".
- WHERE `deletedAt != null` → HTTP 403 "Tài khoản không còn hoạt động".
- WHERE user không tồn tại (hard deleted) → HTTP 401.
- WHERE DB timeout > **100ms** → HTTP 503, log `ERROR`.
