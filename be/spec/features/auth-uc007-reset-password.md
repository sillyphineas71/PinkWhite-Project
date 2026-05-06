# UC007: Thực thi khôi phục mật khẩu (Reset Password)

## 1. Context & Goal
Cho phép người dùng đặt lại mật khẩu mới dựa trên link/token nhận được từ email.

## 2. Actors & Roles
- Guest: Người dùng quên mật khẩu.

## 3. Out of Scope (Non-goals)
- Quản lý phiên đăng nhập nhiều thiết bị (sẽ xử lý ở UC015 Force Logout).

## 4. Data Model Impact
Cập nhật cột `passwordHash` trong model `User`. Xóa bản ghi `ResetPasswordToken`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Token chỉ sử dụng 1 lần.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL yêu cầu mật khẩu mới trim khoảng trắng, từ 8-100 ký tự.
- THE hệ thống SHALL mã hóa mật khẩu mới bằng bcrypt (10 rounds).
- API Impact: `POST /api/auth/reset-password` (Body: `{ token, newPassword }`)

## 7. Acceptance Criteria
- WHEN guest gọi API với token hợp lệ và mật khẩu mới hợp lệ, THE hệ thống SHALL cập nhật mật khẩu mới, xóa token và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token sai, hết hạn hoặc đã được sử dụng, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE mật khẩu mới không hợp lệ, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
