# UC015: Force Logout All Devices

## 1. Context & Goal
Đăng xuất khỏi toàn bộ các thiết bị (thu hồi tất cả phiên làm việc).

## 2. Actors & Roles
- User.

## 3. Out of Scope (Non-goals)
- Chỉ đăng xuất 1 thiết bị cụ thể (ngoài thiết bị hiện tại).

## 4. Data Model Impact
Xóa dữ liệu trong bảng `Session`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Vô hiệu hóa ngay lập tức khả năng làm mới Access Token trên mọi thiết bị.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL xóa toàn bộ bản ghi Session của user khi có yêu cầu.
- API Impact: `POST /api/auth/logout-all`

## 7. Acceptance Criteria
- WHEN user gọi API, THE hệ thống SHALL xóa toàn bộ Session trong DB và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE gọi API nhưng không xác thực được user hiện tại, THE hệ thống SHALL trả về HTTP 401.
