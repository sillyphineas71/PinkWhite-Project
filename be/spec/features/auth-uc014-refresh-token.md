# UC014: Refresh Access Token

## 1. Context & Goal
Duy trì phiên đăng nhập bảo mật bằng cách cấp mới Access Token mà không cần user đăng nhập lại.

## 2. Actors & Roles
- User.

## 3. Out of Scope (Non-goals)
- Quản lý device fingerprint.

## 4. Data Model Impact
Sử dụng bảng `Session`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Áp dụng Refresh Token Rotation.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL xoay vòng Refresh Token mỗi lần sử dụng.
- API Impact: `POST /api/auth/refresh`

## 7. Acceptance Criteria
- WHEN user gọi API kèm Refresh Token hợp lệ, THE hệ thống SHALL cấp Access/Refresh Token mới, cập nhật DB và trả về HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Refresh Token đã hết hạn/bị thu hồi, THE hệ thống SHALL trả về HTTP 401.
- WHERE phát hiện Refresh Token cũ bị sử dụng lại (bị trộm), THE hệ thống SHALL thu hồi toàn bộ Session của user đó và trả về HTTP 401.
