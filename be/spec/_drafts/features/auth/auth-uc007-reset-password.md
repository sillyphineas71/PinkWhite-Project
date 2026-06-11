# UC007: Thực thi khôi phục mật khẩu (Reset Password)

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Thêm Performance SLA, Observability.
> - Token verify bằng SHA-256 hash.
> - Thu hồi toàn bộ Session cũ sau khi reset (Q2).
> - Transaction cho toàn bộ thao tác.

## 1. Context & Goal
Cho phép người dùng đặt lại mật khẩu mới bằng token nhận từ email (UC006). Sau khi reset thành công, toàn bộ Session cũ bị thu hồi để đảm bảo kẻ tấn công không còn phiên nào hợp lệ.

## 2. Actors & Roles
- Guest: Người dùng quên mật khẩu, có token hợp lệ.

## 3. Out of Scope (Non-goals)
- Tự động đăng nhập sau reset (user phải login lại thủ công).

## 4. Data Model Impact
- Update `passwordHash` trong `User`.
- Delete bản ghi `ResetPasswordToken`.
- Delete ALL bản ghi `Session` của user (thu hồi toàn bộ phiên).

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 500ms |
| Response Time (p99) | ≤ 800ms |
| bcrypt hash | ≤ 300ms |
| DB Transaction (update + delete) | ≤ 80ms |

### 5.2 Security
- Token chỉ dùng 1 lần. Verify bằng cách hash input với SHA-256 rồi so khớp `tokenHash` trong DB.
- THE hệ thống SHALL thu hồi toàn bộ Session (Refresh Token) của user sau khi reset thành công.
- THE hệ thống SHALL wrap toàn bộ thao tác trong **database transaction**.

### 5.3 Observability
- Log `INFO`: `{ action: "PASSWORD_RESET_SUCCESS", userId, ip, timestamp }`.
- Log `WARN`: `{ action: "PASSWORD_RESET_FAILED", reason, ip, timestamp }` khi token sai/hết hạn.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL trim khoảng trắng 2 đầu và validate mật khẩu mới (8-100 ký tự).
- THE hệ thống SHALL hash mật khẩu mới bằng bcrypt 10 rounds.
- THE hệ thống SHALL thực hiện trong 1 transaction: (1) verify token, (2) update passwordHash, (3) xóa token, (4) xóa toàn bộ Session của user.
- API: `POST /api/auth/reset-password` (Body: `{ token, newPassword }`)
- Response (200): `{ "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." }`

## 7. Acceptance Criteria
- WHEN guest gọi API với token hợp lệ và password mới hợp lệ, THE hệ thống SHALL cập nhật mật khẩu, xóa token, thu hồi toàn bộ Session và trả về HTTP 200 trong **≤ 500ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token sai, hết hạn hoặc đã sử dụng → HTTP 400 "Token không hợp lệ hoặc đã hết hạn".
- WHERE mật khẩu mới dưới 8 hoặc trên 100 ký tự → HTTP 400.
- WHERE DB transaction thất bại → rollback, log `ERROR`, trả HTTP 500.
- WHERE hai request reset cùng token cùng lúc (race condition), THE hệ thống SHALL dùng transaction + row locking, chỉ 1 request thành công.
