# UC001: Register via Email (Đăng ký tài khoản)

> **Revision**: v2 — 2026-05-06. Cập nhật theo kết quả review BA:
> - Thêm `isEmailVerified` vào Data Model (Q1).
> - Thêm quy tắc strip `+alias` email (Q2).
> - Xác định rõ response body (Q4).
> - Thay đổi luồng: KHÔNG cấp JWT khi đăng ký. Phải verify email trước (Q7).

## 1. Context & Goal
Tính năng cho phép người dùng mới tạo tài khoản bằng Email và Mật khẩu. Sau khi đăng ký, hệ thống sẽ gửi email xác thực (UC005). User PHẢI xác thực email trước khi được cấp JWT và sử dụng ứng dụng.

## 2. Actors & Roles
- Guest (Khách): Người chưa có tài khoản.

## 3. Out of Scope (Non-goals)
- Xác thực Email (UC005 xử lý).
- Đăng ký bằng Social (UC009-011).
- Điền thông tin Profile.

## 4. Data Model Impact
Thêm bảng `User` vào Prisma:
```prisma
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  isEmailVerified Boolean   @default(false)
  isOnboarded     Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Tuyệt đối không lưu plain-text password. Đăng ký KHÔNG cấp JWT (phải verify email trước).
- **Performance**: API đăng ký tốn CPU do hash bcrypt, cần Rate Limit để ngăn chặn DDOS.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL tự động loại bỏ khoảng trắng dư thừa (trim) và chuẩn hóa email thành chữ thường trước khi xử lý.
- THE hệ thống SHALL loại bỏ phần `+alias` trong email trước ký tự `@` (ví dụ: `user+1@gmail.com` → `user@gmail.com`) để chống tạo nhiều tài khoản từ 1 email.
- THE hệ thống SHALL tự động loại bỏ khoảng trắng 2 đầu của password trước khi validate.
- THE hệ thống SHALL mã hóa (hash) mật khẩu bằng thuật toán bcrypt với 10 rounds trước khi lưu.
- THE hệ thống SHALL tự động kích hoạt luồng gửi email xác thực (UC005) ngay sau khi tạo User thành công.
- API Impact: `POST /api/auth/register` (Body: `{ email, password }`)
- Response Body: `{ message: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.", user: { id, email } }`

## 7. Acceptance Criteria
- WHEN guest gọi API `/api/auth/register` với thông tin hợp lệ, THE hệ thống SHALL tạo bản ghi User mới (với `isEmailVerified = false`), kích hoạt gửi email xác thực, và trả về HTTP 201 **KHÔNG kèm Set-Cookie JWT**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE payload gửi lên thiếu email/password hoặc chứa khoảng trắng dư thừa làm sai định dạng, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE email không đúng định dạng chuẩn hoặc vượt quá 255 ký tự, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE password có độ dài dưới 8 hoặc trên 100 ký tự, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE đăng ký bằng một email đã tồn tại trong hệ thống (sau khi đã strip alias và lowercase), THE hệ thống SHALL trả về HTTP 409 (Conflict).
- WHERE số lần gọi API đăng ký vượt quá 3 lần trong 1 giờ từ 1 IP, THE hệ thống SHALL từ chối request và trả về HTTP 429 (Too Many Requests).
