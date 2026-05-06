# UC003: Logout (Đăng xuất)

## 1. Context & Goal
Cho phép người dùng hủy phiên làm việc hiện tại trên thiết bị đang sử dụng.

## 2. Actors & Roles
- User: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Đăng xuất khỏi TẤT CẢ các thiết bị.

## 4. Data Model Impact
- Không thay đổi dữ liệu Database (JWT là stateless).

## 5. Non-functional Requirements (Security, Performance)
- **Security**: JWT vẫn hợp lệ cho đến khi hết hạn. Logout chỉ xóa cookie ở client side. Ở phase sau cần blacklist token nếu muốn tuyệt đối.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request tới `/api/auth/logout`, THE hệ thống SHALL xác thực trạng thái đăng nhập qua JwtGuard.
- API Impact: `POST /api/auth/logout`

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/logout`, THE hệ thống SHALL trả về HTTP 200 và thiết lập Header `Set-Cookie` với Token rỗng, Max-Age=0.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE gọi API Logout nhưng không có Cookie hoặc Token đã hết hạn, THE hệ thống SHALL trả về HTTP 401 (Unauthorized).
