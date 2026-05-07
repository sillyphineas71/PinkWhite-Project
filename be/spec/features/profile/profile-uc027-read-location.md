# UC027: Đọc vị trí hiện tại

> **Revision**: v2 — Production-Grade
> - Logic lấy tọa độ kết hợp Fallback Passport.

## 1. Context & Goal
Trả về thông tin vị trí của user (bao gồm tọa độ, và trạng thái xem có đang dùng Passport hay không). Tính năng này dùng để tính toán và hiển thị khoảng cách (`X km away`) trên giao diện Card swipe.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập. (Thường hệ thống tự gọi trong thuật toán Match, hoặc trả về để hiển thị).

## 3. Data Model Impact
- Đọc từ bảng `Location`.

## 4. Non-functional Requirements (NFR)
- Có thể được tách riêng hoặc tích hợp chung vào Aggregated Profile API (`GET /api/profile/:id`) tùy chiến lược Frontend.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN hệ thống hoặc Client cần lấy Tọa độ hiệu lực của User (Active Coordinates), THE hệ thống SHALL kiểm tra bản ghi `Location` và bảng `User/Subscription` (để check quyền Premium).
  - IF `isPassport = true` VÀ user vẫn đang sở hữu gói Premium hợp lệ, THEN hệ thống SHALL trả về `(passportLat, passportLng)` làm tọa độ chính thức.
  - ELSE (Nếu không dùng Passport hoặc đã hết hạn Premium), THE hệ thống SHALL tự động trả về tọa độ GPS thật `(latitude, longitude)`.

## 6. Acceptance Criteria
- **AC1:** User bật Passport, Premium còn hạn → Trả về tọa độ Passport.
- **AC2:** User bật Passport, Premium hết hạn → Tự động Fallback trả về tọa độ Real GPS.
