# UC040: Đọc Preferences hiện tại

> **Revision**: v1 — Production-Grade
> - API đọc thuần, trả về toàn bộ thiết lập bộ lọc của User.

## 1. Context & Goal
Cho phép User xem lại bộ lọc tìm kiếm hiện tại của mình (để hiển thị trên UI Settings). Frontend cần dữ liệu này để fill sẵn vào form khi User muốn chỉnh sửa.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Cập nhật Preferences (UC041 xử lý).

## 4. Data Model Impact
- Đọc bảng `Preference` qua `userId`. Không thay đổi dữ liệu.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query | ≤ 10ms |
| API Response Time (p95) | ≤ 50ms |

### 5.2 Security
- Chỉ cho phép User đọc Preferences của chính mình (khớp `userId` từ JWT).

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `GET /api/discovery/preferences`, THE hệ thống SHALL truy vấn bảng `Preference` theo `userId` từ JWT.
  - IF không tìm thấy bản ghi Preference, THEN hệ thống SHALL trả về HTTP 404 "Chưa thiết lập Preferences".
  - THE hệ thống SHALL trả về HTTP 200 kèm JSON: `{ minAge, maxAge, genderFilter, maxDistance }`.

## 7. Acceptance Criteria
- **AC1:** User đã tạo Preference → GET trả về HTTP 200 với đầy đủ thông tin.
- **AC2:** User chưa tạo Preference → HTTP 404.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE JWT không hợp lệ hoặc hết hạn, THE hệ thống SHALL trả về HTTP 401.
- WHERE User bị ban (`isBanned = true`), THE hệ thống SHALL trả về HTTP 403.
