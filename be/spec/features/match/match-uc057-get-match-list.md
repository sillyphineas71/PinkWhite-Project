# UC057: Đọc danh sách các lượt Match hiện có (Get Match List)

> **Revision**: v2 — Production-Grade
> - Lấy danh sách những người đã Match.
> - Hỗ trợ Pagination và sắp xếp theo tương tác gần nhất.
> - **v2**: Dùng `unreadCountA`/`unreadCountB` thay `hasUnreadMessage`. Thêm filter Ghost Data (Banned/Deleted).

## 1. Context & Goal
Người dùng cần một màn hình danh sách để xem tất cả những người mình đã Match, từ đó có thể bấm vào để bắt đầu hoặc tiếp tục cuộc trò chuyện. Mục tiêu là tải danh sách nhanh chóng và ưu tiên hiển thị những người có tương tác mới nhất lên đầu.

## 2. Actors & Roles
- **Active User**: Người dùng đã hoàn tất Onboarding và đang đăng nhập hợp lệ.

## 3. Out of Scope (Non-goals)
- Lấy nội dung toàn bộ tin nhắn chat (đây là nhiệm vụ của Module Chat).
- Tìm kiếm theo tên (UC059).

## 4. Data Model Impact
- Đọc bảng `Match`, lọc `status = ACTIVE` và `userAId = userId` hoặc `userBId = userId`.
- **JOIN bảng `User`** để kiểm tra `isBanned = false` và `deletedAt IS NULL` của đối phương (Chống Ghost Data).
- Đọc bảng `Profile` và `Photo` để lấy ảnh và tên hiển thị.
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query (Join) | ≤ 150ms |
| API Response Time (p95) | ≤ 400ms |

### 5.2 Pagination
- Sử dụng **Cursor-based pagination** với `cursor` là `lastInteractionAt` kết hợp với `matchId` để tránh mất dữ liệu.
- Giới hạn `limit` tối đa 50 item mỗi trang.

### 5.3 Security & Privacy
- User chỉ được phép xem các lượt Match của chính mình.
- User đối phương bị ban hoặc đã xóa tài khoản SHALL bị loại khỏi danh sách trả về.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "GET_MATCH_LIST", userId, resultCount }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập hợp lệ.
- **Rules**:
  - WHEN User gọi `GET /api/matches?cursor=<cursor>&limit=20`, THE hệ thống SHALL:
    1. Lọc các Match có `userAId = userId` hoặc `userBId = userId`.
    2. Chỉ lấy Match có `status = ACTIVE`.
    3. **Loại bỏ Ghost Data**: JOIN bảng `User` cho đối phương và chỉ giữ lại những Match mà đối phương có `isBanned = false` VÀ `deletedAt IS NULL`.
    4. Join bảng Profile và Photo để lấy thông tin đối phương (Tên, Avatar, Tuổi).
    5. Trả kèm cờ `unreadCount` riêng cho User hiện tại:
       - IF User hiện tại là `userAId` THEN trả về `unreadCountA`.
       - IF User hiện tại là `userBId` THEN trả về `unreadCountB`.
  - THE hệ thống SHALL sắp xếp kết quả giảm dần (DESC) theo cột `lastInteractionAt`.
  - THE hệ thống SHALL trả về HTTP 200 kèm JSON:
    ```json
    {
      "data": [
        {
          "matchId": "uuid",
          "partner": {
            "userId": "uuid",
            "fullName": "...",
            "avatar": "url",
            "age": 25
          },
          "unreadCount": 3,
          "lastInteractionAt": "2026-05-19T10:00:00Z"
        }
      ],
      "nextCursor": "...",
      "hasMore": true
    }
    ```

## 7. Acceptance Criteria
- **AC1:** Lấy danh sách thành công → Trả về HTTP 200, danh sách được sắp xếp từ mới nhất đến cũ nhất.
- **AC2:** Trả về đúng thông tin đối phương → Tên, Ảnh đại diện, và `unreadCount` riêng biệt cho User đang gọi API.
- **AC3:** Hỗ trợ Pagination → Truyền `cursor` trả về trang tiếp theo chính xác.
- **AC4:** Ghost Data bị lọc → Nếu đối phương bị Banned hoặc đã xóa tài khoản, Match đó KHÔNG xuất hiện trong danh sách.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `limit` > 50 hoặc ≤ 0, THE hệ thống SHALL clamp giá trị về khoảng hợp lệ [1, 50].
- WHERE token không hợp lệ, THE hệ thống SHALL trả về HTTP 401 Unauthorized.
