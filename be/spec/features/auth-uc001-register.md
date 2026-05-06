# UC001: Register via Email (Đăng ký tài khoản)

> **Revision**: v3 — 2026-05-06. Nâng cấp Production-Grade:
> - Thêm Performance SLA (response time, throughput).
> - Thêm Database Transaction requirement.
> - Thêm Error Response Schema.
> - Thêm Observability (Logging).
> - Thêm Database Index.

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
  isBanned        Boolean   @default(false)
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // email đã có @unique → Prisma tự tạo unique index, KHÔNG cần @@index([email])
  @@index([deletedAt])
}
```

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 500ms |
| Response Time (p99) | ≤ 800ms |
| DB Write (INSERT User) | ≤ 50ms |
| bcrypt hash (10 rounds) | ≤ 300ms |
| Email Job Enqueue | ≤ 10ms |
| Throughput | ≥ 100 requests/giây |

### 5.2 Security
- Tuyệt đối không lưu plain-text password.
- Đăng ký KHÔNG cấp JWT (phải verify email trước).
- THE hệ thống SHALL wrap toàn bộ thao tác (tạo User + tạo VerificationToken) trong một **Database Transaction**. Nếu bất kỳ bước nào thất bại, toàn bộ transaction phải rollback.

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO` với payload: `{ action: "USER_REGISTERED", userId, email (masked), ip, timestamp }` khi đăng ký thành công.
- THE hệ thống SHALL ghi log `WARN` với payload: `{ action: "REGISTER_FAILED", reason, email (masked), ip, timestamp }` khi đăng ký thất bại (duplicate, validation error).

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL tự động loại bỏ khoảng trắng dư thừa (trim) và chuẩn hóa email thành chữ thường trước khi xử lý.
- THE hệ thống SHALL loại bỏ phần `+alias` trong email trước ký tự `@` (ví dụ: `user+1@gmail.com` → `user@gmail.com`) để chống tạo nhiều tài khoản từ 1 email.
- THE hệ thống SHALL tự động loại bỏ khoảng trắng 2 đầu của password trước khi validate.
- THE hệ thống SHALL mã hóa (hash) mật khẩu bằng thuật toán bcrypt với 10 rounds trước khi lưu.
- THE hệ thống SHALL tự động kích hoạt luồng gửi email xác thực (UC005) ngay sau khi tạo User thành công.
- API Impact: `POST /api/auth/register` (Body: `{ email, password }`)
- Success Response (HTTP 201):
```json
{
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```
- Error Response Schema (HTTP 4xx):
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Email không đúng định dạng",
  "timestamp": "2026-05-06T00:00:00.000Z"
}
```

## 7. Acceptance Criteria
- WHEN guest gọi API `/api/auth/register` với thông tin hợp lệ, THE hệ thống SHALL tạo bản ghi User mới (với `isEmailVerified = false`) trong một transaction, kích hoạt gửi email xác thực, và trả về HTTP 201 **KHÔNG kèm Set-Cookie JWT** trong vòng **≤ 500ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE payload gửi lên thiếu email/password hoặc sai định dạng, THE hệ thống SHALL trả về HTTP 400 trong vòng **≤ 50ms**.
- WHERE email không đúng định dạng chuẩn hoặc vượt quá 255 ký tự, THE hệ thống SHALL trả về HTTP 400.
- WHERE password có độ dài dưới 8 hoặc trên 100 ký tự, THE hệ thống SHALL trả về HTTP 400.
- WHERE đăng ký bằng một email đã tồn tại trong hệ thống (sau khi đã strip alias và lowercase), THE hệ thống SHALL trả về HTTP 409 (Conflict).
- WHERE số lần gọi API đăng ký vượt quá 3 lần trong 1 giờ từ 1 IP, THE hệ thống SHALL từ chối request và trả về HTTP 429.
- WHERE Database Transaction thất bại (DB down, timeout), THE hệ thống SHALL rollback, ghi log `ERROR` và trả về HTTP 500 (Internal Server Error).
