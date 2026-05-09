# UC043: Làm mới Feed (Refresh Feed)

> **Revision**: v1 — Production-Grade
> - Kéo để tải thêm (Pull-to-Refresh / Load More).
> - Tái sử dụng logic UC042 với cursor mới.

## 1. Context & Goal
Khi User đã quẹt hết tất cả Profile trong trang Feed hiện tại, họ cần một cách để tải thêm Profile mới. Về bản chất, UC043 là hành động gọi lại UC042 với cursor tiếp theo. Ngoài ra, User cũng có thể Pull-to-Refresh để reset Feed từ đầu (bỏ cursor).

## 2. Actors & Roles
- **User**: Người dùng đang ở màn hình Swipe.

## 3. Out of Scope (Non-goals)
- Thay đổi thuật toán xếp hạng khi refresh (giai đoạn sau).

## 4. Data Model Impact
- Không thay đổi DB. Đọc lại dữ liệu giống UC042.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 500ms (giống UC042) |

### 5.2 Rate Limiting
- Giới hạn **5 lần refresh / phút** để chống abuse (người dùng spam pull-to-refresh).

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Giống UC042.
- **Rules**:
  - WHEN User "kéo để tải thêm" (Load More), THE Client SHALL gọi `GET /api/discovery/feed?cursor=<lastId>` với cursor là `userId` cuối cùng từ response trước.
  - WHEN User "kéo để làm mới" (Pull-to-Refresh), THE Client SHALL gọi `GET /api/discovery/feed` **không có cursor** để reset về đầu danh sách.
  - THE hệ thống SHALL áp dụng toàn bộ logic filter/exclude của UC042.
  - IF User refresh quá 5 lần/phút, THEN hệ thống SHALL trả về HTTP 429 "Vui lòng chờ một chút trước khi tải lại".

## 7. Acceptance Criteria
- **AC1:** User quẹt hết 20 profile trong trang 1, gửi cursor → Nhận thêm tối đa 20 profile mới (không trùng trang 1). HTTP 200.
- **AC2:** User pull-to-refresh (không gửi cursor) → Nhận lại Feed từ đầu (có thể thay đổi thứ tự nếu có Profile mới). HTTP 200.
- **AC3:** User spam refresh 6 lần trong 1 phút → HTTP 429.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE không còn Profile nào để hiển thị, THE hệ thống SHALL trả về HTTP 200 với `{ data: [], hasMore: false }`.
- WHERE cursor trỏ tới một User đã bị xóa/ban, THE hệ thống SHALL bỏ qua cursor và trả Feed từ đầu.
