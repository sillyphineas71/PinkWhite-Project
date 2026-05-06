# UC011: Login via Apple ID

## 1. Context & Goal
Đăng nhập hoặc đăng ký nhanh bằng Apple ID.

## 2. Actors & Roles
- Guest.

## 3. Out of Scope (Non-goals)
- Link tài khoản.

## 4. Data Model Impact
Sử dụng model `SocialAccount`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Verify JWT signature từ Apple.

## 6. Functional Requirements & Business Rules
- THE hệ thống SHALL xác thực tính hợp lệ của Apple ID Token.
- API Impact: `POST /api/auth/social/apple` (Body: `{ token }`)

## 7. Acceptance Criteria
- WHEN user gọi API với token Apple hợp lệ, THE hệ thống SHALL trả về HTTP 200 và cấp JWT.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE token không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
- WHERE email bị trùng, THE hệ thống SHALL trả về HTTP 409.
