# UC003: Logout (Đăng xuất)

> **Revision**: v3 — 2026-05-06. Nâng cấp Production-Grade:
> - Thêm Performance SLA.
> - Thêm Idempotent behavior.
> - Thêm Observability.

## 1. Context & Goal
Cho phép người dùng hủy phiên làm việc hiện tại. Logout sẽ thu hồi Refresh Token trong DB và xóa cả hai Cookie (Access + Refresh).

## 2. Actors & Roles
- User: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Đăng xuất khỏi TẤT CẢ các thiết bị (UC015).

## 4. Data Model Impact
- Xóa bản ghi `Session` tương ứng với Refresh Token hiện tại trong DB.

## 5. Non-functional Requirements

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Response Time (p95) | ≤ 100ms |
| Response Time (p99) | ≤ 200ms |
| DB Delete (DELETE Session) | ≤ 30ms |
| Throughput | ≥ 1000 requests/giây |

### 5.2 Security
- Thu hồi Refresh Token trong DB giúp đảm bảo kẻ tấn công không thể dùng Refresh Token đã bị đánh cắp để tạo Access Token mới.
- Access Token cũ (nếu bị lộ) chỉ còn sống tối đa 15 phút.

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO` với payload: `{ action: "LOGOUT", userId, ip, timestamp }` khi đăng xuất thành công.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request tới `/api/auth/logout`, THE hệ thống SHALL xác thực trạng thái đăng nhập qua JwtGuard.
- THE hệ thống SHALL xóa bản ghi Session (Refresh Token) tương ứng trong DB.
- THE hệ thống SHALL xóa cả Cookie Access Token và Cookie Refresh Token bằng cách set giá trị rỗng với `Max-Age=0`.
- THE hệ thống SHALL xử lý Logout theo nguyên tắc **Idempotent**: gọi nhiều lần vẫn cho kết quả giống nhau, không gây lỗi.
- API Impact: `POST /api/auth/logout`
- Success Response (HTTP 200):
```json
{ "message": "Đăng xuất thành công" }
```

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/logout`, THE hệ thống SHALL xóa Session trong DB, trả về HTTP 200 và xóa cả Access Token Cookie và Refresh Token Cookie trong vòng **≤ 100ms (p95)**.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE gọi API Logout nhưng không có Cookie hoặc Access Token đã hết hạn, THE hệ thống SHALL trả về HTTP 401 trong vòng **≤ 20ms**.
- WHERE Refresh Token không tìm thấy trong DB (đã bị thu hồi trước đó), THE hệ thống SHALL vẫn xóa Cookie và trả về HTTP 200 (idempotent).
- WHERE Database không phản hồi trong vòng **200ms**, THE hệ thống SHALL timeout, ghi log `ERROR` và trả về HTTP 503.
