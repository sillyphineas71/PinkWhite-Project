# UC010: Login via Facebook OAuth

## 1. Context & Goal
Đăng nhập hoặc đăng ký nhanh bằng tài khoản Facebook.

## 2. Actors & Roles
- Guest.

## 3. Out of Scope (Non-goals)
- Lấy danh sách bạn bè Facebook.

## 4. Data Model Impact
Sử dụng model `SocialAccount`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Verify token với Facebook Graph API.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL xác thực tính hợp lệ của OAuth Token với Facebook.
- API Impact: `POST /api/auth/social/facebook` (Body: `{ token }`)

## 7. Acceptance Criteria
- WHEN user gọi API với token Facebook hợp lệ, THE hệ thống SHALL trả về HTTP 200 và JWT.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
- WHERE email bị trùng, THE hệ thống SHALL trả về HTTP 409.
