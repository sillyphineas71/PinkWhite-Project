# UC002: Login via Email (Đăng nhập)

> **Revision**: v3 — 2026-05-06. Nâng cấp Production-Grade:
> - Thêm Performance SLA.
> - Thêm Timing Attack protection.
> - Thêm Observability.
> - Thêm Error Response Schema.

## 1. Context & Goal
Cho phép người dùng đã có tài khoản và đã xác thực email lấy lại phiên làm việc thông qua Access Token (ngắn hạn) và Refresh Token (dài hạn).

## 2. Actors & Roles
- Guest (Khách): Người chưa đăng nhập.

## 3. Out of Scope (Non-goals)
- Quên mật khẩu (UC006-007).

## 4. Data Model Impact
- Read thông tin từ model `User`.
- Tạo bản ghi mới trong bảng `Session` (xem UC014 để biết schema).

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 500ms |
| Response Time (p99) | ≤ 800ms |
| DB Read (SELECT User by email) | ≤ 30ms |
| bcrypt compare | ≤ 300ms |
| DB Write (INSERT Session) | ≤ 50ms |
| JWT Sign | ≤ 5ms |
| Throughput | ≥ 500 requests/giây |

### 5.2 Security
- Trả lỗi chung "Email hoặc mật khẩu không chính xác" ở lỗi 401 để chống dò rỉ thông tin.
- THE hệ thống SHALL sử dụng hàm so sánh **constant-time** (bcrypt.compare) để chống Timing Attack — thời gian phản hồi khi email đúng/sai phải gần như giống nhau.
- Access Token có TTL ngắn (15 phút) giúp giảm rủi ro nếu bị đánh cắp.

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO` với payload: `{ action: "LOGIN_SUCCESS", userId, ip, userAgent, timestamp }` khi đăng nhập thành công.
- THE hệ thống SHALL ghi log `WARN` với payload: `{ action: "LOGIN_FAILED", reason, email (masked), ip, timestamp }` khi đăng nhập thất bại.
- THE hệ thống SHALL ghi log `WARN` với payload: `{ action: "LOGIN_RATE_LIMITED", email (masked), ip, timestamp }` khi bị rate limit.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL cấu hình Access Token (JWT) với thời hạn sống (TTL) là **15 phút**.
- THE hệ thống SHALL cấu hình Refresh Token với thời hạn sống (TTL) là **7 ngày**.
- THE hệ thống SHALL thiết lập Access Token vào Cookie với `HttpOnly=true`, `SameSite=Lax`, `Secure=true`, `Path=/`.
- THE hệ thống SHALL thiết lập Refresh Token vào một Cookie riêng biệt với `HttpOnly=true`, `SameSite=Lax`, `Secure=true`, `Path=/api/auth/refresh`.
- THE hệ thống SHALL lưu Refresh Token (đã hash bằng SHA-256) vào bảng `Session` trong DB.
- WHEN email không tồn tại trong DB, THE hệ thống SHALL vẫn thực hiện một phép hash bcrypt giả (dummy) trước khi trả lỗi 401, để đảm bảo thời gian phản hồi đồng nhất (chống Timing Attack).
- API Impact: `POST /api/auth/login` (Body: `{ email, password }`)
- Success Response (HTTP 200):
```json
{
  "message": "Đăng nhập thành công",
  "user": { "id": "uuid", "email": "user@example.com", "isOnboarded": false }
}
```

## 7. Acceptance Criteria
- WHEN guest gọi API `/api/auth/login` với email và password hợp lệ (và email đã xác thực), THE hệ thống SHALL trả về HTTP 200, cấp Access Token và Refresh Token qua Header `Set-Cookie` trong vòng **≤ 500ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE email hoặc password không khớp, THE hệ thống SHALL trả về HTTP 401 kèm thông báo "Email hoặc mật khẩu không chính xác" trong thời gian phản hồi **≥ 300ms** (đảm bảo constant-time).
- WHERE email chưa được xác thực (`isEmailVerified = false`), THE hệ thống SHALL trả về HTTP 403 kèm thông báo "Vui lòng xác thực email trước khi đăng nhập".
- WHERE tài khoản đang bị khóa (`isBanned = true`), THE hệ thống SHALL trả về HTTP 403.
- WHERE tài khoản đã bị xóa mềm (`deletedAt != null`), THE hệ thống SHALL trả về HTTP 403.
- WHERE số lần đăng nhập sai vượt quá 5 lần trong 15 phút từ cùng 1 **IP + email**, THE hệ thống SHALL trả về HTTP 429.
- WHERE tổng số lần đăng nhập sai vượt quá **20 lần trong 15 phút từ cùng 1 IP** (bất kể email nào), THE hệ thống SHALL block toàn bộ IP đó và trả về HTTP 429 (chống credential stuffing hàng loạt).
- WHERE payload gửi lên thiếu/sai định dạng, THE hệ thống SHALL trả về HTTP 400 trong vòng **≤ 50ms**.
- WHERE Database không phản hồi trong vòng **500ms**, THE hệ thống SHALL timeout, ghi log `ERROR` và trả về HTTP 503 (Service Unavailable).
