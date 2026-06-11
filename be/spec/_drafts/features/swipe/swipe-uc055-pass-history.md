# UC055: Đọc lịch sử các lượt đã Pass

> **Revision**: v1 — Production-Grade
> - Cho phép User xem lại những ai mình đã Pass.
> - Phục vụ cho Rewind (UC050) và giúp User hối hận xem lại.

## 1. Context & Goal
User có thể muốn xem lại lịch sử các Profile mình đã Pass (quẹt trái). Thông tin này cũng giúp Frontend hiển thị cho User biết họ có thể Rewind Profile nào (lượt Pass gần nhất). Trên Tinder thật, đây là tính năng ẩn / chỉ phục vụ nội bộ cho Rewind.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Rewind từ lịch sử (chỉ Rewind lượt gần nhất — UC050).

## 4. Data Model Impact
- Đọc bảng `Swipe` (`WHERE swiperId = currentUser AND action = PASS`).
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query | ≤ 50ms |
| API Response Time (p95) | ≤ 200ms |

### 5.2 Pagination
- Cursor-based, tối đa **20 items / trang**.

### 5.3 Data Retention
- **Free tier**: Chỉ trả về lịch sử Pass trong **7 ngày gần nhất**.
- **Premium tier**: Trả về lịch sử Pass trong **30 ngày gần nhất**.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `GET /api/swipe/history/passed?cursor=<id>&limit=20`, THE hệ thống SHALL:
    1. Xác định số ngày retention theo tier (7 hoặc 30).
    2. Query bảng `Swipe` với `swiperId = userId`, `action = PASS`, `createdAt >= NOW() - X days`.
    3. Sắp xếp theo `createdAt DESC`.
  - THE hệ thống SHALL trả về HTTP 200:
    ```json
    {
      "data": [
        {
          "swipeId": "uuid",
          "targetId": "uuid",
          "fullName": "...",
          "age": 25,
          "avatar": "url",
          "passedAt": "2026-05-09T..."
        }
      ],
      "nextCursor": "uuid",
      "hasMore": true
    }
    ```
  - THE hệ thống SHALL chỉ trả về Profile của Target nếu Target chưa bị ban/xóa.

## 7. Acceptance Criteria
- **AC1:** User đã Pass 5 người hôm nay → Response chứa 5 items.
- **AC2:** User đã Pass 1 người 8 ngày trước → Người đó không xuất hiện trong lịch sử (> 7 ngày).
- **AC3:** User chưa Pass ai → Response `{ data: [], hasMore: false }`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Target đã bị ban hoặc xóa tài khoản, THE hệ thống SHALL loại bỏ khỏi kết quả (không hiển thị Profile ghost).
- WHERE JWT không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
