# UC002: Login via Email (Đăng nhập)

## 1. Context & Goal
Cho phép người dùng đã có tài khoản lấy lại phiên làm việc (Session/Token) để tiếp tục sử dụng ứng dụng.

## 2. Actors & Roles
- Guest (Khách): Người chưa đăng nhập.

## 3. Out of Scope (Non-goals)
- Quên mật khẩu.
- Cơ chế Refresh Token.

## 4. Data Model Impact
- Tính năng này chỉ Đọc (Read) thông tin từ model `User`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Trả lỗi chung "Email hoặc mật khẩu không chính xác" ở lỗi 401 để tránh lộ việc email có tồn tại hay không.
- **Performance**: Verify JWT stateless giúp giảm tải DB. So khớp bcrypt tốn CPU cần Rate Limit.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL cấu hình JWT với thời hạn sống (TTL) là 7 ngày.
- THE hệ thống SHALL thiết lập Cookie chứa JWT với các thuộc tính `HttpOnly=true`, `SameSite=Lax`, `Secure=true`.
- API Impact: `POST /api/auth/login` (Body: `{ email, password }`)

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/login` với email và password hợp lệ, THE hệ thống SHALL trả về HTTP 200 và cấp JWT qua Header `Set-Cookie`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE email hoặc password không khớp, THE hệ thống SHALL trả về HTTP 401 (Unauthorized) kèm thông báo "Email hoặc mật khẩu không chính xác".
- WHERE số lần đăng nhập sai vượt quá 5 lần trong 15 phút từ 1 IP, THE hệ thống SHALL block IP đó và trả về HTTP 429 (Too Many Requests).
- WHERE tài khoản của user đang bị khóa/vô hiệu hóa, THE hệ thống SHALL từ chối đăng nhập và trả về HTTP 403 (Forbidden).
- WHERE payload gửi lên thiếu email hoặc password hoặc sai định dạng, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
