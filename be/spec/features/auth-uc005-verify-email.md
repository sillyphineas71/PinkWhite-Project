# UC005: Xác thực Email (Verify Email)

## 1. Context & Goal
Tính năng yêu cầu người dùng xác thực địa chỉ email để đảm bảo họ là chủ sở hữu hợp lệ của email đó.

## 2. Actors & Roles
- User: Người vừa đăng ký tài khoản nhưng chưa xác thực email.

## 3. Out of Scope (Non-goals)
- Dùng SMS OTP.

## 4. Data Model Impact
Thêm model `VerificationToken` và cột `isEmailVerified` vào `User`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Token là chuỗi ngẫu nhiên an toàn, thời hạn 15 phút.
- **Performance**: Gửi email qua Background Job.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL sinh ra một chuỗi token duy nhất dài 32 ký tự.
- THE hệ thống SHALL giới hạn thời gian sống của token là 15 phút.
- THE hệ thống SHALL gửi email chứa link xác thực qua Background Job.
- API Impact: `POST /api/auth/verify-email/request` và `POST /api/auth/verify-email/confirm`

## 7. Acceptance Criteria
- WHEN user gọi API request xác thực, THE hệ thống SHALL tạo token, đưa job gửi email vào hàng đợi và trả về HTTP 200.
- WHEN user gọi API confirm xác thực với token hợp lệ, THE hệ thống SHALL cập nhật `isEmailVerified = true` cho User, xóa token và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token cung cấp đã hết hạn hoặc không tồn tại, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE user yêu cầu gửi lại email xác thực quá 3 lần/giờ, THE hệ thống SHALL trả về HTTP 429 (Too Many Requests).
- WHERE email của user đã được xác thực trước đó, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
