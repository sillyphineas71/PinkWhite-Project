# UC009: Login via Google OAuth

## 1. Context & Goal
Đăng nhập hoặc đăng ký nhanh bằng tài khoản Google.

## 2. Actors & Roles
- Guest.

## 3. Out of Scope (Non-goals)
- Link tài khoản Google vào tài khoản Email hiện có.

## 4. Data Model Impact
Thêm model `SocialAccount`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Verify token với Google Backend.
- **Performance**: Timeout 5s khi gọi Google API.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL xác thực tính hợp lệ của OAuth Token với Google.
- THE hệ thống SHALL sử dụng email từ Google để tạo Profile nếu chưa có.
- THE hệ thống SHALL đánh dấu `isEmailVerified = true`.
- API Impact: `POST /api/auth/social/google` (Body: `{ token }`)

## 7. Acceptance Criteria
- WHEN user gọi API với token Google hợp lệ, THE hệ thống SHALL trả về HTTP 200 và JWT.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
- WHERE email bị trùng với tài khoản đã có (nhưng chưa link), THE hệ thống SHALL trả về HTTP 409.
- WHERE Google API lỗi, THE hệ thống SHALL trả về HTTP 502.
