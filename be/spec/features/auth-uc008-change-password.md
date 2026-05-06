# UC008: Thay đổi mật khẩu (Change Password)

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Thêm Performance SLA, Observability.
> - KHÔNG tự động force logout (Q3). User tự chọn qua UC015.

## 1. Context & Goal
Cho phép người dùng chủ động thay đổi mật khẩu khi đang đăng nhập. Không tự động đăng xuất các thiết bị khác — user có thể chủ động gọi UC015 nếu muốn.

## 2. Actors & Roles
- User: Người dùng đã xác thực.

## 3. Out of Scope (Non-goals)
- Force Logout toàn bộ thiết bị (UC015 xử lý riêng, user tự chọn).

## 4. Data Model Impact
- Update `passwordHash` trong `User`.

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 500ms |
| Response Time (p99) | ≤ 800ms |
| bcrypt compare (old) | ≤ 300ms |
| bcrypt hash (new) | ≤ 300ms |
| DB Update | ≤ 30ms |

### 5.2 Security
- Bắt buộc nhập mật khẩu hiện tại (xác nhận danh tính).
- THE hệ thống SHALL sử dụng constant-time compare (bcrypt.compare) cho mật khẩu cũ.
- Mật khẩu mới không được trùng mật khẩu cũ.

### 5.3 Observability
- Log `INFO`: `{ action: "PASSWORD_CHANGED", userId, ip, timestamp }`.
- Log `WARN`: `{ action: "PASSWORD_CHANGE_FAILED", reason, userId, ip, timestamp }`.

## 6. Functional Requirements & Business Rules
- WHILE đổi mật khẩu, THE hệ thống SHALL yêu cầu user nhập đúng mật khẩu hiện tại.
- THE hệ thống SHALL trim khoảng trắng 2 đầu và validate mật khẩu mới (8-100 ký tự).
- THE hệ thống SHALL hash mật khẩu mới bằng bcrypt 10 rounds.
- THE hệ thống SHALL từ chối nếu mật khẩu mới giống mật khẩu cũ.
- API: `POST /api/auth/change-password` (Body: `{ oldPassword, newPassword }`)
- Response (200): `{ "message": "Đổi mật khẩu thành công" }`

## 7. Acceptance Criteria
- WHEN user gọi API với mật khẩu cũ đúng và mật khẩu mới hợp lệ, THE hệ thống SHALL cập nhật mật khẩu mới và trả về HTTP 200 trong **≤ 500ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE user nhập sai mật khẩu hiện tại → HTTP 401 (Unauthorized) trong **≥ 300ms** (constant-time).
- WHERE mật khẩu mới dưới 8 hoặc trên 100 ký tự → HTTP 400.
- WHERE mật khẩu mới trùng mật khẩu cũ → HTTP 400 "Mật khẩu mới không được trùng mật khẩu cũ".
- WHERE không có Cookie hoặc Access Token hết hạn → HTTP 401 trong **≤ 10ms**.
- WHERE DB timeout > **500ms** → HTTP 503, log `ERROR`.
