# UC003: Logout (Đăng xuất)

> **Revision**: v2 — 2026-05-06. Cập nhật theo kết quả review BA:
> - Logout phải xóa cả Refresh Token trong DB (Q5).

## 1. Context & Goal
Cho phép người dùng hủy phiên làm việc hiện tại. Vì hệ thống dùng Refresh Token, logout sẽ thu hồi Refresh Token trong DB và xóa cả hai Cookie (Access + Refresh).

## 2. Actors & Roles
- User: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Đăng xuất khỏi TẤT CẢ các thiết bị (UC015).

## 4. Data Model Impact
- Xóa bản ghi `Session` tương ứng với Refresh Token hiện tại trong DB.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Thu hồi Refresh Token trong DB giúp đảm bảo kẻ tấn công không thể dùng Refresh Token đã bị đánh cắp để tạo Access Token mới. Access Token cũ (nếu bị lộ) chỉ còn sống tối đa 15 phút.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request tới `/api/auth/logout`, THE hệ thống SHALL xác thực trạng thái đăng nhập qua JwtGuard.
- THE hệ thống SHALL xóa bản ghi Session (Refresh Token) tương ứng trong DB.
- THE hệ thống SHALL xóa cả Cookie Access Token và Cookie Refresh Token bằng cách set giá trị rỗng với `Max-Age=0`.
- API Impact: `POST /api/auth/logout`

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/logout`, THE hệ thống SHALL xóa Session trong DB, trả về HTTP 200 và thiết lập Header `Set-Cookie` cho cả Access Token và Refresh Token với giá trị rỗng, Max-Age=0.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE gọi API Logout nhưng không có Cookie hoặc Token đã hết hạn, THE hệ thống SHALL trả về HTTP 401 (Unauthorized).
- WHERE Refresh Token không tìm thấy trong DB (đã bị thu hồi trước đó), THE hệ thống SHALL vẫn xóa Cookie và trả về HTTP 200 (idempotent).
