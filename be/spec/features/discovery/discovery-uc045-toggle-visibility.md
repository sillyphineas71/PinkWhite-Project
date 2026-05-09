# UC045: Bật/Tắt chế độ Ẩn danh (Hide My Profile)

> **Revision**: v1 — Production-Grade
> - Khi bật: Profile không xuất hiện trong Feed của bất kỳ ai.
> - Khi tắt: Profile quay lại bình thường.

## 1. Context & Goal
Cho phép User tạm thời ẩn Profile khỏi Feed Discovery mà không cần xóa tài khoản. Thường sử dụng khi User đã tìm được người phù hợp, hoặc muốn tạm nghỉ. Khi ẩn danh, User vẫn giữ nguyên các Match/Chat hiện có, nhưng không ai mới có thể tìm thấy họ.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Xóa tài khoản (UC012).
- Ẩn danh khỏi Match/Chat hiện tại (chỉ ẩn khỏi Feed mới).

## 4. Data Model Impact
- Cập nhật cột `isHidden` (Boolean, default `false`) trong bảng `Profile`.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Update | ≤ 10ms |
| API Response Time (p95) | ≤ 50ms |

### 5.2 Side Effects
- UC042 (Feed) phải kiểm tra cờ `isHidden` và loại trừ User đang ẩn.
- UC047 (Like): Nếu User đang ẩn danh mà cố gắng Like người khác, hệ thống vẫn cho phép (chỉ ẩn khỏi Feed, không ẩn khỏi tương tác chủ động).

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "PROFILE_VISIBILITY_CHANGED", userId, isHidden: true/false, timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `PATCH /api/discovery/visibility` với body `{ isHidden: true }`, THE hệ thống SHALL set `Profile.isHidden = true` và trả về HTTP 200.
  - WHEN User gọi `PATCH /api/discovery/visibility` với body `{ isHidden: false }`, THE hệ thống SHALL set `Profile.isHidden = false` và trả về HTTP 200.
  - THE hệ thống SHALL không ảnh hưởng đến các Match/Chat hiện có.
  - IF giá trị `isHidden` gửi lên trùng với giá trị hiện tại trong DB, THE hệ thống SHALL vẫn trả HTTP 200 (idempotent) mà không ghi log thay đổi.

## 7. Acceptance Criteria
- **AC1:** User Premium bật ẩn danh → User A không xuất hiện trong Feed của bất kỳ ai. HTTP 200.
- **AC2:** User Premium tắt ẩn danh → User A xuất hiện lại trong Feed bình thường. HTTP 200.
- **AC3:** User Free gọi API bật ẩn danh → HTTP 403 "Tính năng này yêu cầu gói Premium".

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE User không có gói Premium active, THE hệ thống SHALL trả về HTTP 403.
- WHERE body thiếu trường `isHidden`, THE hệ thống SHALL trả về HTTP 400.
- WHERE `isHidden` không phải Boolean, THE hệ thống SHALL trả về HTTP 400.
