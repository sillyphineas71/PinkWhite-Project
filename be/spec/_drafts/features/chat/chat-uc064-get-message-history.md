# UC064: Lấy lịch sử tin nhắn của một Match (Get Message History)

> **Revision**: v1 — Production-Grade
> - REST API lấy lịch sử tin nhắn (không qua Socket).
> - Cursor-based pagination, sắp xếp từ mới nhất xuống cũ nhất.

## 1. Context & Goal
Khi người dùng mở một cuộc trò chuyện, ứng dụng cần tải lịch sử tin nhắn trước đó để hiển thị. API này dùng REST (không phải Socket) vì đây là hành động đọc dữ liệu tĩnh, phù hợp với HTTP hơn. Mục tiêu là trả về danh sách tin nhắn phân trang nhanh chóng.

## 2. Actors & Roles
- **Active User**: Người dùng thuộc về lượt Match đang muốn xem lịch sử.

## 3. Out of Scope (Non-goals)
- Tìm kiếm tin nhắn theo nội dung (full-text search).
- Lọc tin nhắn theo loại (text, image, voice).

## 4. Data Model Impact
- Đọc bảng `Message`, lọc `matchId` và `isUnsent = false` (ẩn tin nhắn đã thu hồi).
- Đọc bảng `Match` để xác thực quyền.
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query | ≤ 100ms |
| API Response Time (p95) | ≤ 300ms |

### 5.2 Pagination
- Sử dụng **Cursor-based pagination** với `cursor` là `messageId` (hoặc `createdAt`).
- Mỗi trang trả về tối đa **30 tin nhắn**.
- Sắp xếp DESC theo `createdAt` (tin nhắn mới nhất lên đầu).

### 5.3 Security & Privacy
- Chỉ thành viên của Match mới có quyền đọc lịch sử tin nhắn.
- Tin nhắn đã bị thu hồi (`isUnsent = true`) SHALL hiển thị placeholder "Tin nhắn đã bị thu hồi" thay vì nội dung gốc.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "GET_MSG_HISTORY", userId, matchId, resultCount }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập và thuộc về Match.
- **Rules**:
  - WHEN User gọi `GET /api/chat/:matchId/messages?cursor=<cursor>&limit=30`, THE hệ thống SHALL:
    1. Xác minh User thuộc Match và Match đang `ACTIVE`.
    2. Query bảng `Message` theo `matchId`, sắp xếp DESC theo `createdAt`.
    3. Đối với tin nhắn có `isUnsent = true`, thay `content` bằng chuỗi placeholder.
    4. Trả về HTTP 200 kèm JSON danh sách.
  - THE hệ thống SHALL trả về JSON:
    ```json
    {
      "data": [
        {
          "messageId": "uuid",
          "senderId": "uuid",
          "type": "TEXT",
          "content": "Xin chào!",
          "status": "READ",
          "isUnsent": false,
          "createdAt": "2026-05-19T10:00:00Z"
        }
      ],
      "nextCursor": "uuid-of-last-item",
      "hasMore": true
    }
    ```

## 7. Acceptance Criteria
- **AC1:** Lấy lịch sử thành công → HTTP 200 với danh sách tin nhắn mới nhất lên đầu.
- **AC2:** Tin nhắn đã thu hồi → `content` hiển thị placeholder, `isUnsent = true`.
- **AC3:** Phân trang → Truyền `cursor` trả về trang tiếp theo chính xác.
- **AC4:** Không có tin nhắn → HTTP 200, `data: []`, `hasMore: false`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE User không thuộc Match, THE hệ thống SHALL trả về HTTP 403.
- WHERE `matchId` không tồn tại, THE hệ thống SHALL trả về HTTP 404.
- WHERE `limit` > 50 hoặc ≤ 0, THE hệ thống SHALL clamp về [1, 50].
