# UC015: Force Logout All Devices

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Thêm Performance SLA, Observability.
> - Chi tiết hóa luồng xóa Session.

## 1. Context & Goal
Đăng xuất khỏi toàn bộ các thiết bị bằng cách thu hồi tất cả Refresh Token (xóa toàn bộ Session). Access Token cũ trên các thiết bị khác sẽ tự hết hạn trong vòng tối đa 15 phút.

## 2. Actors & Roles
- User: Người dùng đã xác thực.

## 3. Out of Scope (Non-goals)
- Đăng xuất 1 thiết bị cụ thể (ngoài thiết bị hiện tại).

## 4. Data Model Impact
- Delete ALL bản ghi `Session` của user trong DB.

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 150ms |
| Response Time (p99) | ≤ 300ms |
| DB Delete (DELETE WHERE userId) | ≤ 50ms |
| Throughput | ≥ 500 req/s |

### 5.2 Security
- Sau khi xóa toàn bộ Session, không thiết bị nào có thể refresh Access Token nữa.
- Access Token cũ (15p TTL) sẽ tự hết hạn, không thể thu hồi ngay (stateless). Đây là trade-off chấp nhận được.
- THE hệ thống SHALL invalidate cache `/me` của user (nếu đang dùng Redis cache từ UC004).

### 5.3 Observability
- Log `INFO`: `{ action: "FORCE_LOGOUT_ALL", userId, sessionCount, ip, timestamp }`.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request, THE hệ thống SHALL xác thực Access Token qua JwtGuard.
- THE hệ thống SHALL xóa toàn bộ bản ghi Session của user trong DB.
- THE hệ thống SHALL xóa Cookie Access Token và Refresh Token trên thiết bị hiện tại.
- THE hệ thống SHALL invalidate Redis cache của user (nếu có).
- API: `POST /api/auth/logout-all`
- Response (200): `{ "message": "Đã đăng xuất khỏi tất cả thiết bị" }`

## 7. Acceptance Criteria
- WHEN user gọi API, THE hệ thống SHALL xóa toàn bộ Session trong DB, xóa Cookie, invalidate cache và trả về HTTP 200 trong **≤ 150ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE không có Cookie hoặc Access Token hết hạn → HTTP 401 trong **≤ 10ms**.
- WHERE user không có Session nào trong DB (đã bị xóa trước đó) → vẫn trả HTTP 200 (idempotent).
- WHERE DB timeout > **200ms** → HTTP 503, log `ERROR`.
