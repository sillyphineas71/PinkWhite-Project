# UC002: Login via Email (Đăng nhập)

> **Revision**: v2 — 2026-05-06. Cập nhật theo kết quả review BA:
> - Giảm TTL Access Token xuống 15 phút, sử dụng Refresh Token ngay Phase 1 (Q5).
> - Rate Limit theo IP + email kết hợp (Q8).
> - Yêu cầu email đã xác thực mới được login (Q7).

## 1. Context & Goal
Cho phép người dùng đã có tài khoản và đã xác thực email lấy lại phiên làm việc thông qua Access Token (ngắn hạn) và Refresh Token (dài hạn).

## 2. Actors & Roles
- Guest (Khách): Người chưa đăng nhập.

## 3. Out of Scope (Non-goals)
- Quên mật khẩu (UC006-007).

## 4. Data Model Impact
- Read thông tin từ model `User`.
- Tạo bản ghi mới trong bảng `Session` (xem UC014 để biết schema).

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Trả lỗi chung "Email hoặc mật khẩu không chính xác" ở lỗi 401 để chống dò rỉ thông tin. Access Token có TTL ngắn (15 phút) giúp giảm rủi ro nếu bị đánh cắp.
- **Performance**: Verify Access Token là stateless (không query DB). Chỉ query DB khi cần refresh.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL cấu hình Access Token (JWT) với thời hạn sống (TTL) là **15 phút**.
- THE hệ thống SHALL cấu hình Refresh Token với thời hạn sống (TTL) là **7 ngày**.
- THE hệ thống SHALL thiết lập Access Token vào Cookie với `HttpOnly=true`, `SameSite=Lax`, `Secure=true`.
- THE hệ thống SHALL thiết lập Refresh Token vào một Cookie riêng biệt (path: `/api/auth/refresh`) với `HttpOnly=true`, `SameSite=Lax`, `Secure=true`.
- THE hệ thống SHALL lưu Refresh Token vào bảng `Session` trong DB.
- API Impact: `POST /api/auth/login` (Body: `{ email, password }`)

## 7. Acceptance Criteria
- WHEN guest gọi API `/api/auth/login` với email và password hợp lệ (và email đã xác thực), THE hệ thống SHALL trả về HTTP 200, cấp Access Token và Refresh Token qua Header `Set-Cookie`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE email hoặc password không khớp, THE hệ thống SHALL trả về HTTP 401 (Unauthorized) kèm thông báo "Email hoặc mật khẩu không chính xác".
- WHERE email chưa được xác thực (`isEmailVerified = false`), THE hệ thống SHALL trả về HTTP 403 (Forbidden) kèm thông báo "Vui lòng xác thực email trước khi đăng nhập".
- WHERE tài khoản của user đang bị khóa/vô hiệu hóa, THE hệ thống SHALL từ chối đăng nhập và trả về HTTP 403 (Forbidden).
- WHERE số lần đăng nhập sai vượt quá 5 lần trong 15 phút từ cùng 1 **IP + email**, THE hệ thống SHALL block và trả về HTTP 429 (Too Many Requests).
- WHERE payload gửi lên thiếu email hoặc password hoặc sai định dạng, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
