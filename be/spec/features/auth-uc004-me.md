# UC004: Lấy thông tin user hiện tại (Get /me)

> **Revision**: v2 — 2026-05-06. Cập nhật theo kết quả review BA:
> - API `/me` phải check `isBanned` trong DB mỗi lần gọi (Q3).

## 1. Context & Goal
Trả về thông tin cơ bản của người dùng đang đăng nhập để Frontend biết user là ai và có cần chuyển hướng qua trang Onboarding không. API này cũng đóng vai trò "gác cổng" — kiểm tra trạng thái tài khoản realtime.

## 2. Actors & Roles
- User: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Lấy thông tin chi tiết Profile (Sở thích, Ảnh).

## 4. Data Model Impact
- Read trường `id`, `email`, `isOnboarded`, `isEmailVerified` từ model `User`.
- Read trường trạng thái tài khoản (banned/deleted) từ model `User`.

## 5. Non-functional Requirements (Security, Performance)
- **Security**: Token nằm trong HTTP-only cookie. API này **query DB mỗi lần gọi** để đảm bảo trạng thái tài khoản (banned/deleted) luôn được phản ánh realtime.
- **Performance**: Truy vấn đơn giản (SELECT by ID), chi phí thấp. Có thể cache ngắn (ví dụ 30s) nếu cần tối ưu sau.

## 6. Functional Requirements & Business Rules
- WHILE xử lý request tới `/api/auth/me`, THE hệ thống SHALL xác thực Access Token qua JwtGuard.
- THE hệ thống SHALL query Database để kiểm tra trạng thái tài khoản (banned, deleted) dựa trên `userId` từ JWT payload.
- API Impact: `GET /api/auth/me`
- Response Body: `{ id, email, isOnboarded, isEmailVerified }`

## 7. Acceptance Criteria
- WHEN user gọi API `/api/auth/me` với Cookie chứa Access Token hợp lệ và tài khoản đang ở trạng thái bình thường, THE hệ thống SHALL trả về HTTP 200 và thông tin User (`id`, `email`, `isOnboarded`, `isEmailVerified`).

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE gọi API nhưng không có Cookie hoặc Access Token đã hết hạn, THE hệ thống SHALL trả về HTTP 401 (Unauthorized).
- WHERE tài khoản đã bị Admin khóa (banned), THE hệ thống SHALL trả về HTTP 403 (Forbidden) kèm thông báo "Tài khoản của bạn đã bị khóa".
- WHERE tài khoản đã bị xóa mềm (có `deletedAt`), THE hệ thống SHALL trả về HTTP 403 (Forbidden) kèm thông báo "Tài khoản không còn hoạt động".
