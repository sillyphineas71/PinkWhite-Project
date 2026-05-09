# UC054: Xem danh sách "Who Liked Me" (Premium Gold)

> **Revision**: v1 — Production-Grade
> - Tính năng Premium Gold/Platinum: Xem ai đã Like mình.
> - Phân trang Cursor-based.
> - Free tier chỉ thấy số lượng (blurred).

## 1. Context & Goal
Đây là tính năng "selling point" lớn nhất của gói Gold/Platinum. Trên Tinder thật, Free user chỉ thấy một con số mờ "X người đã Like bạn", nhưng không xem được danh sách cụ thể. Premium Gold/Platinum cho phép xem trực tiếp danh sách các Profile đã Like mình, để User quyết định Like lại (tạo Match) hoặc Pass.

## 2. Actors & Roles
- **User Gold/Platinum**: Xem danh sách đầy đủ.
- **User Free/Plus**: Chỉ xem được số lượng (count), không xem được danh sách.

## 3. Out of Scope (Non-goals)
- Like lại từ danh sách này (User phải quay lại Feed hoặc gọi API Like trực tiếp).

## 4. Data Model Impact
- Đọc bảng `Swipe` (`WHERE targetId = currentUser AND action IN (LIKE, SUPER_LIKE)`).
- Loại trừ những Swipe đã có Match tương ứng (đã Match rồi thì không cần hiện nữa).
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query (count for Free) | ≤ 20ms |
| DB Query (list for Premium) | ≤ 100ms |
| API Response Time (p95) | ≤ 300ms |

### 5.2 Pagination
- Cursor-based, tối đa **20 items / trang**.

### 5.3 Privacy
- Không trả về `dob`, `email` của người đã Like.
- Chỉ trả về: `userId`, `fullName`, `age`, `photos[0]` (ảnh Avatar), `distance`, `likedAt`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User Free/Plus gọi `GET /api/swipe/who-liked-me`, THE hệ thống SHALL:
    - Chỉ trả về số lượng (`count`) và KHÔNG trả về danh sách chi tiết.
    ```json
    { "count": 12, "isBlurred": true, "data": [] }
    ```
  - WHEN User Gold/Platinum gọi `GET /api/swipe/who-liked-me?cursor=<id>&limit=20`, THE hệ thống SHALL:
    - Trả về danh sách chi tiết các Profile đã Like/Super Like mình (chưa Match).
    ```json
    {
      "count": 12,
      "isBlurred": false,
      "data": [
        {
          "swipeId": "uuid",
          "userId": "uuid",
          "fullName": "...",
          "age": 25,
          "avatar": "url",
          "action": "SUPER_LIKE",
          "likedAt": "2026-05-09T..."
        }
      ],
      "nextCursor": "uuid",
      "hasMore": true
    }
    ```
  - THE hệ thống SHALL sắp xếp theo `createdAt DESC` (người Like gần nhất lên đầu).
  - Super Like SHALL được đánh dấu riêng (`action: "SUPER_LIKE"`) để Frontend hiển thị badge đặc biệt.

## 7. Acceptance Criteria
- **AC1:** User Free có 5 lượt Like → Response `{ count: 5, isBlurred: true, data: [] }`.
- **AC2:** User Gold có 5 lượt Like → Response `{ count: 5, isBlurred: false, data: [...5 items] }`.
- **AC3:** User A Like User B, User B Like lại A (Match) → User A không xuất hiện trong "Who Liked Me" của B nữa (đã chuyển sang danh sách Match).

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE không ai Like User, THE hệ thống SHALL trả về `{ count: 0, isBlurred: false, data: [] }`.
- WHERE JWT không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
