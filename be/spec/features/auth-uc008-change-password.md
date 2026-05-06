# UC008: Thay đổi mật khẩu (Change Password)

## 1. Context & Goal
Cho phép người dùng chủ động thay đổi mật khẩu khi đang đăng nhập.

## 2. Actors & Roles
- User: Người dùng đã xác thực.

## 3. Out of Scope (Non-goals)
- Force Logout các thiết bị khác (Xử lý riêng).

## 4. Data Model Impact
Cập nhật cột `passwordHash` trong `User`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Bắt buộc nhập lại mật khẩu cũ.

## 6. Functional Requirements & Business Rules
- WHILE đổi mật khẩu, THE hệ thống SHALL yêu cầu user nhập đúng mật khẩu hiện tại.
- THE hệ thống SHALL mã hóa mật khẩu mới bằng bcrypt 10 rounds.
- API Impact: `POST /api/auth/change-password` (Body: `{ oldPassword, newPassword }`)

## 7. Acceptance Criteria
- WHEN user gọi API với mật khẩu cũ đúng và mật khẩu mới hợp lệ, THE hệ thống SHALL cập nhật mật khẩu mới và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE user nhập sai mật khẩu hiện tại, THE hệ thống SHALL trả về HTTP 401 (Unauthorized).
- WHERE mật khẩu mới không hợp lệ, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
