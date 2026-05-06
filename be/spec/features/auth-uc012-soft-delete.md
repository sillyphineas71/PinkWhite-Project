# UC012: Soft Delete Account (Xóa tài khoản mềm)

## 1. Context & Goal
Bảo vệ quyền riêng tư người dùng, cho phép xóa tài khoản nhưng có cơ hội khôi phục trong 30 ngày.

## 2. Actors & Roles
- User.

## 3. Out of Scope (Non-goals)
- Hard delete ngay lập tức.

## 4. Data Model Impact
Sử dụng cột `deletedAt`.

## 5. Non-functional Requirements (Security, Performance)
- **Performance**: Index `deletedAt` để tránh full-table scan.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL bỏ qua (không hiển thị) các user có `deletedAt != null` trong mọi API đọc dữ liệu.
- API Impact: `POST /api/auth/account/delete`

## 7. Acceptance Criteria
- WHEN user gọi API xóa tài khoản, THE hệ thống SHALL cập nhật `deletedAt`, xóa Cookie và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE user đang bị khóa gọi API xóa, THE hệ thống SHALL giữ lại cờ `isBanned = true`.
