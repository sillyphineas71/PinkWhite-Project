# UC026: Cập nhật vị trí hiện tại (GPS Coordinates)

> **Revision**: v2 — Production-Grade
> - Threshold chặn spam DB: Chỉ cập nhật nếu lệch > 1000m.

## 1. Context & Goal
Lưu trữ tọa độ thực tế của người dùng để phục vụ cho tính năng cốt lõi: Tìm người xung quanh (Geo-spatial query). Vì điện thoại có thể thay đổi tọa độ liên tục dù user chỉ đi bộ, hệ thống cần có cơ chế Throttling để bảo vệ Database.

## 2. Actors & Roles
- **User**: Người dùng đang mở ứng dụng.

## 3. Data Model Impact
- Cập nhật bảng `Location` (các cột `latitude`, `longitude`, `updatedAt`).

## 4. Non-functional Requirements (NFR)
- **Công thức tính khoảng cách:** Sử dụng Haversine Formula (tính trong Memory/Service Layer) để so sánh tọa độ mới với DB.
- API Response (p99): ≤ 50ms. Rất quan trọng vì API này gọi thường xuyên (Background).

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN Client gọi API báo cáo tọa độ `(lat, lng, isMocked)` mới, THE hệ thống SHALL kiểm tra cờ `isMocked`.
  - IF `isMocked = true`, THEN hệ thống SHALL từ chối cập nhật và trả về HTTP 403 "Phát hiện GPS giả. Vui lòng nâng cấp Passport để đổi vị trí".
  - ELSE, THE hệ thống SHALL lấy tọa độ hiện tại trong DB ra đối chiếu.
  - IF đây là lần cập nhật đầu tiên (DB chưa có bản ghi), THEN hệ thống SHALL tạo mới bản ghi `Location` ngay lập tức.
  - IF khoảng cách (Distance) giữa `(lat_new, lng_new)` và `(lat_old, lng_old)` trong DB < 1000 mét, THEN hệ thống SHALL bỏ qua thao tác ghi DB (để tối ưu I/O) và trả về luôn HTTP 200 OK.
  - IF khoảng cách ≥ 1000 mét, THEN hệ thống SHALL cập nhật `latitude` và `longitude` mới, đồng thời update thời gian `updatedAt`.

## 6. Acceptance Criteria
- **AC1:** User đứng yên hoặc di chuyển 500m, app gửi GPS mới → DB không thực thi truy vấn UPDATE, API vẫn trả 200.
- **AC2:** User di chuyển 2km (sang phường khác) → Hệ thống ghi đè tọa độ mới vào DB.
- **AC3:** App dùng Fake GPS đẩy lên `isMocked: true` → HTTP 403.
