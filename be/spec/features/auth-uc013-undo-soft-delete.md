# UC013: Undo Soft Delete (Khôi phục tài khoản)

## 1. Context & Goal
Cho phép user khôi phục tài khoản trong vòng 30 ngày sau khi xóa mềm.

## 2. Actors & Roles
- Deleted User.

## 3. Out of Scope (Non-goals)
- Khôi phục sau 30 ngày.

## 4. Data Model Impact
Xóa (set null) cột `deletedAt`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Chỉ thực hiện được sau khi user login thành công (nhưng ở trạng thái chờ khôi phục).

## 6. Functional Requirements & Business Rules
- WHILE user có `deletedAt != null` đăng nhập, THE hệ thống SHALL yêu cầu xác nhận khôi phục.
- API Impact: `POST /api/auth/account/restore`

## 7. Acceptance Criteria
- WHEN deleted user gọi API restore với token hợp lệ, THE hệ thống SHALL set `deletedAt = null` và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE user gọi API nhưng `deletedAt` đã trôi qua 30 ngày, THE hệ thống SHALL trả về HTTP 404.
