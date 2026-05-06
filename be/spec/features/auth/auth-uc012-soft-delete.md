# UC012: Soft Delete Account (Xóa tài khoản mềm)

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Yêu cầu nhập password xác nhận (Q7).
> - Force logout all sessions khi xóa (Q5).
> - Thêm Performance SLA, Observability, Transaction.

## 1. Context & Goal
Bảo vệ quyền riêng tư người dùng bằng cách cho phép xóa tài khoản (soft delete). Đây là hành động destructive nên yêu cầu xác nhận danh tính bằng mật khẩu. Sau khi xóa, toàn bộ Session trên mọi thiết bị bị thu hồi ngay lập tức.

## 2. Actors & Roles
- User: Người dùng đã xác thực.

## 3. Out of Scope (Non-goals)
- Hard delete ngay lập tức (chạy Cron Job sau 30 ngày).

## 4. Data Model Impact
- Update `deletedAt` = `now()` trong `User`.
- Delete ALL bản ghi `Session` của user.

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 500ms |
| Response Time (p99) | ≤ 800ms |
| bcrypt compare (verify password) | ≤ 300ms |
| DB Transaction | ≤ 80ms |

### 5.2 Security
- Bắt buộc nhập mật khẩu hiện tại để xác nhận danh tính trước khi xóa.
- THE hệ thống SHALL thu hồi toàn bộ Session (force logout all) trong cùng transaction.
- User có `isBanned = true` vẫn được phép xóa tài khoản, nhưng cờ `isBanned` phải được giữ lại.

### 5.3 Observability
- Log `INFO`: `{ action: "ACCOUNT_SOFT_DELETED", userId, ip, timestamp }`.
- Log `WARN`: `{ action: "ACCOUNT_DELETE_FAILED", reason, userId, ip, timestamp }`.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL yêu cầu user cung cấp mật khẩu hiện tại trong request body.
- THE hệ thống SHALL verify mật khẩu bằng bcrypt.compare (constant-time).
- THE hệ thống SHALL thực hiện trong 1 transaction: (1) verify password, (2) set `deletedAt = now()`, (3) xóa toàn bộ Session.
- THE hệ thống SHALL xóa cả Cookie Access Token và Refresh Token.
- THE hệ thống SHALL bỏ qua user có `deletedAt != null` trong mọi API đọc (Discovery, Feed, Match).
- API: `POST /api/auth/account/delete` (Body: `{ password }`)
- Response (200): `{ "message": "Tài khoản đã được xóa. Bạn có 30 ngày để khôi phục." }`

## 7. Acceptance Criteria
- WHEN user gọi API với password đúng, THE hệ thống SHALL set `deletedAt`, thu hồi toàn bộ Session, xóa Cookie và trả về HTTP 200 trong **≤ 500ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE user nhập sai mật khẩu → HTTP 401 trong **≥ 300ms** (constant-time).
- WHERE tài khoản đã bị xóa trước đó (`deletedAt != null`) → HTTP 400 "Tài khoản đã được xóa".
- WHERE không có Cookie hoặc Access Token hết hạn → HTTP 401.
- WHERE DB transaction thất bại → rollback, log `ERROR`, trả HTTP 500.
