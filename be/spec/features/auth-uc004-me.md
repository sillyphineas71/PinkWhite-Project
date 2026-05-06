# UC004: Lấy thông tin user hiện tại (Get /me)

## 1. Context & Goal
Trả về thông tin cơ bản của người dùng đang đăng nhập để Frontend biết user là ai và có cần chuyển hướng qua trang Onboarding không.

## 2. Actors & Roles
- User: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Lấy thông tin chi tiết Profile (Sở thích, Ảnh).

## 4. Data Model Impact
- Read trường `id`, `email`, `isOnboarded` từ model `User`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Token nằm trong HTTP-only cookie, Frontend lấy thông tin thông qua API này thay vì decode JWT.
- **Performance**: Nhanh, cache lại kết quả nếu cần.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request tới `/api/auth/me`, THE hệ thống SHALL xác thực trạng thái đăng nhập qua JwtGuard.
- API Impact: `GET /api/auth/me`

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/me` với Cookie chứa JWT hợp lệ, THE hệ thống SHALL trả về HTTP 200 và thông tin User (`id`, `email`, `isOnboarded`).

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE gọi API Private Route nhưng không có Cookie hoặc Token đã hết hạn, THE hệ thống SHALL trả về HTTP 401 (Unauthorized).
