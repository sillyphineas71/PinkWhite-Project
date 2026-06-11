# UC028: Cập nhật vị trí tùy chỉnh (Passport - Premium)

> **Revision**: v2 — Production-Grade
> - Logic check Premium.

## 1. Context & Goal
Tính năng "Passport" (Đổi vị trí) là một trong những nguồn thu chính (Premium Feature) của ứng dụng. User có thể cắm cờ ở một thành phố khác (vd: Tokyo) để "quẹt" người ở đó trước khi đi du lịch.

## 2. Actors & Roles
- **Premium User**: Người dùng đang có gói đăng ký hợp lệ.

## 3. Data Model Impact
- Cập nhật bảng `Location` (các cột `isPassport`, `passportLat`, `passportLng`).

## 4. Non-functional Requirements (NFR)
- DB Update: ≤ 30ms.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN user gọi API cập nhật vị trí Passport, THE hệ thống SHALL kiểm tra trạng thái Subscription (Quyền Premium) của user.
  - IF user không có gói Premium hợp lệ, THEN hệ thống SHALL từ chối và trả về HTTP 403 "Yêu cầu nâng cấp gói".
  - IF hợp lệ, THE hệ thống SHALL lưu `passportLat`, `passportLng` và set cờ `isPassport = true`.

*(Lưu ý: Logic Fallback tự động khi Premium hết hạn đã được xử lý ở đầu ra (Read) trong UC027).*

## 6. Acceptance Criteria
- **AC1:** User Free gọi API → HTTP 403.
- **AC2:** User Premium gọi API `(lat, lng)` → DB cập nhật thành công, `isPassport` bật.
