# UC006: Yêu cầu khôi phục mật khẩu (Forgot Password)

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Thêm Performance SLA, Observability.
> - Token lưu dạng SHA-256 hash (Q1).
> - Rate limit IP + email (đồng nhất với UC002/UC005).

## 1. Context & Goal
Cho phép người dùng lấy lại quyền truy cập khi quên mật khẩu bằng cách gửi email chứa link đặt lại mật khẩu. API này là public, không yêu cầu JWT.

## 2. Actors & Roles
- Guest: Người dùng chưa đăng nhập.

## 3. Out of Scope (Non-goals)
- Khôi phục qua SMS.
- Tự động đăng nhập sau khi reset (UC007 xử lý).

## 4. Data Model Impact
```prisma
model ResetPasswordToken {
  id        String   @id @default(uuid())
  email     String
  tokenHash String   @unique  // SHA-256 hash, KHÔNG lưu plain-text
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([email])
  @@index([expiresAt])
}
```

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 200ms |
| Response Time (p99) | ≤ 400ms |
| DB Write | ≤ 30ms |
| Email Job Enqueue | ≤ 10ms |
| Throughput | ≥ 200 req/s |

### 5.2 Security
- THE hệ thống SHALL luôn trả HTTP 200 bất kể email có tồn tại hay không (chống user enumeration).
- Token lưu dạng **SHA-256 hash** trong DB, không lưu plain-text.
- Token crypto-secure 32 ký tự, TTL 15 phút, chỉ dùng 1 lần.
- WHEN sinh token mới, THE hệ thống SHALL xóa tất cả token cũ của email đó.

### 5.3 Observability
- Log `INFO`: `{ action: "FORGOT_PASSWORD_REQUESTED", email (masked), ip, timestamp }`.
- Log `WARN`: `{ action: "FORGOT_PASSWORD_RATE_LIMITED", ip, timestamp }` khi bị rate limit.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL sinh token crypto-secure 32 ký tự.
- THE hệ thống SHALL hash token bằng SHA-256 trước khi lưu DB.
- WHEN sinh token mới cho cùng email, THE hệ thống SHALL xóa tất cả token cũ trước.
- THE hệ thống SHALL gửi email chứa link reset qua Background Job.
- WHEN email không tồn tại trong DB, THE hệ thống SHALL vẫn trả HTTP 200 nhưng KHÔNG gửi email và KHÔNG tạo token.
- API: `POST /api/auth/forgot-password` (Body: `{ email }`)
- Response (200): `{ "message": "Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu." }`

## 7. Acceptance Criteria
- WHEN guest gọi API với email tồn tại, THE hệ thống SHALL hủy token cũ, tạo token mới (hash SHA-256), enqueue email job và trả về HTTP 200 trong **≤ 200ms (p95)**.
- WHEN guest gọi API với email không tồn tại, THE hệ thống SHALL trả về HTTP 200 với cùng response body trong **≤ 200ms (p95)** (chống timing attack).

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE request từ cùng 1 **IP + email** vượt quá 3 lần/giờ → HTTP 429.
- WHERE tổng request từ 1 IP vượt quá **10 lần/giờ** bất kể email → HTTP 429.
- WHERE payload thiếu email hoặc sai định dạng → HTTP 400 trong **≤ 50ms**.
- WHERE DB transaction thất bại → rollback, log `ERROR`, trả HTTP 500.
