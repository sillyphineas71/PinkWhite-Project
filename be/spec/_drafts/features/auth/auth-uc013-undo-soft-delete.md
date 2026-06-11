# UC013: Undo Soft Delete (Khôi phục tài khoản)

> **Revision**: v3 — 2026-05-06T14:42+07:00. Production-Grade.
> - Phương án A (Q6): Login cho phép user bị xóa đăng nhập với cờ `pendingRestore`, chỉ cho phép gọi API restore.
> - Thêm Performance SLA, Observability.

## 1. Context & Goal
Cho phép user khôi phục tài khoản trong vòng 30 ngày sau khi xóa mềm. Luồng: user đăng nhập bình thường → hệ thống phát hiện `deletedAt != null` → trả cờ `pendingRestore: true` → Frontend chuyển hướng sang màn hình xác nhận khôi phục → user gọi API restore.

> ⚠️ **Cross-reference UC002**: API Login phải được cập nhật để cho phép user có `deletedAt != null` đăng nhập, nhưng response kèm `pendingRestore: true`. Mọi API khác (ngoài `/restore` và `/logout`) phải trả HTTP 403 cho user ở trạng thái này.

## 2. Actors & Roles
- Deleted User: User đã soft delete, đăng nhập thành công nhưng ở trạng thái restricted.

## 3. Out of Scope (Non-goals)
- Khôi phục sau 30 ngày (Cron Job sẽ hard delete).

## 4. Data Model Impact
- Set `deletedAt = null` trong `User`.

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 100ms |
| Response Time (p99) | ≤ 200ms |
| DB Update | ≤ 30ms |

### 5.2 Security
- Chỉ user đã đăng nhập (có JWT hợp lệ) và đang ở trạng thái `pendingRestore` mới được gọi API này.

### 5.3 Observability
- Log `INFO`: `{ action: "ACCOUNT_RESTORED", userId, ip, timestamp }`.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL xác thực Access Token qua JwtGuard.
- THE hệ thống SHALL kiểm tra user có `deletedAt != null` (đang ở trạng thái pending restore).
- THE hệ thống SHALL set `deletedAt = null` để khôi phục tài khoản.
- API: `POST /api/auth/account/restore`
- Response (200): `{ "message": "Tài khoản đã được khôi phục thành công." }`

## 7. Acceptance Criteria
- WHEN deleted user (đã login, có JWT, đang pending restore) gọi API, THE hệ thống SHALL set `deletedAt = null` và trả về HTTP 200 trong **≤ 100ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `deletedAt` đã trôi qua hơn 30 ngày (tài khoản đã bị hard delete hoặc sắp bị) → HTTP 410 (Gone).
- WHERE user không ở trạng thái pending restore (`deletedAt = null`) → HTTP 400 "Tài khoản không cần khôi phục".
- WHERE không có Cookie hoặc Access Token hết hạn → HTTP 401.
- WHERE DB timeout > **200ms** → HTTP 503, log `ERROR`.
