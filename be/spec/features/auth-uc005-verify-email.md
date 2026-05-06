# UC005: Xác thực Email (Verify Email)

> **Revision**: v2 — 2026-05-06. Cập nhật theo kết quả review BA:
> - Hủy token cũ khi sinh token mới (Q6).
> - Sau khi verify thành công, cấp JWT lần đầu tiên (Q7).

## 1. Context & Goal
Tính năng xác thực email ngay sau khi đăng ký (UC001). Đây là bước BẮT BUỘC trước khi user được cấp JWT và sử dụng ứng dụng. Hệ thống gửi email chứa mã OTP hoặc link xác thực, user phải xác nhận để kích hoạt tài khoản.

## 2. Actors & Roles
- Unverified User: Người vừa đăng ký tài khoản, chưa xác thực email, chưa có JWT.

## 3. Out of Scope (Non-goals)
- Dùng SMS OTP.

## 4. Data Model Impact
Thêm model `VerificationToken`:
```prisma
model VerificationToken {
  id        String   @id @default(uuid())
  email     String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```
Cập nhật cột `isEmailVerified` trong bảng `User` (đã khai báo ở UC001).

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Token là chuỗi ngẫu nhiên crypto-secure, thời hạn 15 phút, chỉ dùng 1 lần. Khi sinh token mới, token cũ bị hủy ngay lập tức.
- **Performance**: Gửi email qua Background Job (Message Queue) để không block HTTP request.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL sinh ra một chuỗi token duy nhất dài 32 ký tự bằng thuật toán crypto-secure.
- THE hệ thống SHALL giới hạn thời gian sống của token là 15 phút.
- WHEN sinh token mới cho cùng một email, THE hệ thống SHALL xóa (invalidate) tất cả token cũ của email đó trước khi tạo token mới.
- THE hệ thống SHALL gửi email chứa link/mã xác thực qua Background Job.
- WHEN xác thực thành công, THE hệ thống SHALL cấp Access Token và Refresh Token (JWT) cho user lần đầu tiên.
- API Impact:
  - `POST /api/auth/verify-email/request` (Body: `{ email }`) — Gửi/gửi lại email xác thực.
  - `POST /api/auth/verify-email/confirm` (Body: `{ email, token }`) — Xác nhận token.

## 7. Acceptance Criteria
- WHEN unverified user gọi API `/api/auth/verify-email/request`, THE hệ thống SHALL hủy token cũ (nếu có), tạo token mới, đưa job gửi email vào hàng đợi và trả về HTTP 200.
- WHEN unverified user gọi API `/api/auth/verify-email/confirm` với token hợp lệ, THE hệ thống SHALL cập nhật `isEmailVerified = true`, xóa token, cấp Access Token + Refresh Token qua `Set-Cookie` và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token cung cấp đã hết hạn hoặc không tồn tại, THE hệ thống SHALL trả về HTTP 400 (Bad Request) kèm thông báo "Token không hợp lệ hoặc đã hết hạn".
- WHERE user yêu cầu gửi lại email xác thực quá 3 lần trong 1 giờ, THE hệ thống SHALL trả về HTTP 429 (Too Many Requests).
- WHERE email đã được xác thực trước đó, THE hệ thống SHALL trả về HTTP 400 (Bad Request) kèm thông báo "Email đã được xác thực".
- WHERE email không tồn tại trong hệ thống, THE hệ thống SHALL trả về HTTP 404 (Not Found).
