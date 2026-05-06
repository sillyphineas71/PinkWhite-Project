# UC006: Yêu cầu khôi phục mật khẩu (Forgot Password)

## 1. Context & Goal
Cho phép người dùng lấy lại quyền truy cập khi quên mật khẩu bằng cách gửi email chứa link đặt lại.

## 2. Actors & Roles
- Guest: Người dùng chưa đăng nhập.

## 3. Out of Scope (Non-goals)
- Khôi phục qua số điện thoại.

## 4. Data Model Impact
Sử dụng model `ResetPasswordToken`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Không xác nhận việc email có tồn tại hay không ở response.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL sinh ra một token ngẫu nhiên, sống 15 phút.
- API Impact: `POST /api/auth/forgot-password` (Body: `{ email }`)

## 7. Acceptance Criteria
- WHEN guest gọi API với email tồn tại, THE hệ thống SHALL sinh token, gửi email reset qua Job và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE email không tồn tại trong DB, THE hệ thống SHALL vẫn trả về HTTP 200 (chống dò rỉ) nhưng không gửi mail.
- WHERE request từ 1 IP vượt quá 3 lần/giờ, THE hệ thống SHALL trả về HTTP 429 (Too Many Requests).
