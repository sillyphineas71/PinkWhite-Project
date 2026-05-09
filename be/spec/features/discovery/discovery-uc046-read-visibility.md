# UC046: Đọc trạng thái Ẩn danh hiện tại

> **Revision**: v1 — Production-Grade
> - API đọc thuần, trả về trạng thái `isHidden`.

## 1. Context & Goal
Cho phép Frontend biết User đang bật hay tắt chế độ ẩn danh để hiển thị toggle UI chính xác (ví dụ: icon mắt mở/mắt đóng trên Settings).

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Thay đổi trạng thái (UC045 xử lý).

## 4. Data Model Impact
- Đọc cột `isHidden` từ bảng `Profile`. Không thay đổi dữ liệu.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query | ≤ 5ms |
| API Response Time (p95) | ≤ 30ms |

### 5.2 Security
- Chỉ cho phép đọc trạng thái của chính mình.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `GET /api/discovery/visibility`, THE hệ thống SHALL truy vấn `Profile.isHidden` theo `userId` từ JWT.
  - THE hệ thống SHALL trả về HTTP 200 kèm JSON: `{ isHidden: true/false }`.

## 7. Acceptance Criteria
- **AC1:** User đang bật ẩn danh → GET trả về `{ isHidden: true }`. HTTP 200.
- **AC2:** User chưa từng bật ẩn danh → GET trả về `{ isHidden: false }`. HTTP 200.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Profile chưa tồn tại (User chưa Onboarding), THE hệ thống SHALL trả về HTTP 404.
- WHERE JWT không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
