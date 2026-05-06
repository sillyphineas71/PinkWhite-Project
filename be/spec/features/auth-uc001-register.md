# UC001: Register via Email (Đăng ký tài khoản)

## 1. Context & Goal
Tính năng cho phép người dùng mới tạo tài khoản bằng Email và Mật khẩu. Mục tiêu là khởi tạo User trong hệ thống và cấp phát JWT ngay lập tức.

## 2. Actors & Roles
- Guest (Khách): Người chưa có tài khoản.

## 3. Out of Scope (Non-goals)
- Xác thực Email (Send verification link).
- Đăng ký bằng Social.
- Điền thông tin Profile (Tên, Ảnh, Sở thích).

## 4. Data Model Impact
Thêm bảng `User` vào Prisma:
```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  isOnboarded  Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Tuyệt đối không lưu plain-text password. Token JWT được set vào `HttpOnly`, `Secure` Cookie.
- **Performance**: API đăng ký tốn CPU do hash bcrypt, cần Rate Limit để ngăn chặn DDOS.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL tự động loại bỏ khoảng trắng dư thừa (trim) và chuẩn hóa email thành chữ thường trước khi xử lý.
- THE hệ thống SHALL tự động loại bỏ khoảng trắng 2 đầu của password trước khi validate.
- THE hệ thống SHALL mã hóa (hash) mật khẩu bằng thuật toán bcrypt với 10 rounds trước khi lưu.
- API Impact: `POST /api/auth/register` (Body: `{ email, password }`)

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/register` với thông tin hợp lệ, THE hệ thống SHALL tạo bản ghi User mới trong Database, trả về HTTP 201 và cấp JWT qua Header `Set-Cookie`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE payload gửi lên thiếu email/password hoặc chứa khoảng trắng dư thừa làm sai định dạng, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE email không đúng định dạng chuẩn hoặc vượt quá 255 ký tự, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE password có độ dài dưới 8 hoặc trên 100 ký tự, THE hệ thống SHALL trả về HTTP 400 (Bad Request).
- WHERE đăng ký bằng một email đã tồn tại trong hệ thống, THE hệ thống SHALL trả về HTTP 409 (Conflict).
- WHERE số lần gọi API đăng ký vượt quá 3 lần trong 1 giờ từ 1 IP, THE hệ thống SHALL từ chối request và trả về HTTP 429 (Too Many Requests).
