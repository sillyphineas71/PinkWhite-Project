# UC072: Xem danh sách cuộc trò chuyện gần đây (Inbox Snippet)

> **Revision**: v2 — Production-Grade
> - Trả về danh sách Match kèm tin nhắn cuối cùng (snippet).
> - Khác biệt với UC057 ở chỗ: UC057 trả danh sách Match đơn giản, UC072 bổ sung thêm preview tin nhắn.
> - **v2 (Vá Lỗ hổng 1)**: Không query bảng `Message` (tránh N+1). Snippet dữ liệu đã được chuẩn hóa ngược (denormalized) lưu sẵn trên bảng `Match` (`lastMessageContent`, `lastMessageSenderId`, v.v.).

## 1. Context & Goal
Màn hình "Inbox" (Hộp thư đến) hiển thị danh sách các cuộc trò chuyện gần đây, mỗi dòng gồm: ảnh đại diện, tên đối phương, đoạn tin nhắn cuối cùng (snippet), và thời gian gửi. Giống giao diện Messenger / WhatsApp. Mục tiêu là giúp người dùng nhanh chóng biết ai đã nhắn tin và nội dung gì.

## 2. Actors & Roles
- **Active User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Tìm kiếm tin nhắn (full-text search trên nội dung).
- Ghim cuộc trò chuyện lên đầu.

## 4. Data Model Impact
- Chỉ đọc bảng `Match` (ACTIVE, Ghost Data filter). Bảng `Match` đã chứa sẵn các cột snippet: `lastMessageContent`, `lastMessageSenderId`, `lastMessageType`, `lastMessageIsUnsent`, `lastMessageCreatedAt`.
- Đọc bảng `Profile` và `Photo` (ảnh + tên đối phương).
- Không JOIN bảng `Message`, loại bỏ hoàn toàn N+1 query bottleneck.
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query | ≤ 200ms |
| API Response Time (p95) | ≤ 500ms |

### 5.2 Pagination
- Cursor-based pagination, `cursor` là `lastInteractionAt` kết hợp `matchId`.
- Tối đa 20 item mỗi trang.

### 5.3 Security & Privacy
- Chỉ trả về cuộc trò chuyện của User hiện tại.
- Tin nhắn đã bị thu hồi → snippet hiển thị "Tin nhắn đã bị thu hồi".
- Ghost Data filter: loại đối phương bị Banned/Deleted.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "GET_INBOX", userId, resultCount }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `GET /api/chat/inbox?cursor=<cursor>&limit=20`, THE hệ thống SHALL:
    1. Lấy danh sách Match `ACTIVE` của User (giống UC057 + Ghost Data filter).
    2. Snippet được lấy trực tiếp từ các cột `lastMessage...` trên bảng `Match`.
    3. Nếu `lastMessageIsUnsent = true`, thay snippet bằng "Tin nhắn đã bị thu hồi".
    4. Sắp xếp danh sách DESC theo `lastInteractionAt`.
  - THE hệ thống SHALL trả về HTTP 200 kèm JSON:
    ```json
    {
      "data": [
        {
          "matchId": "uuid",
          "partner": {
            "userId": "uuid",
            "fullName": "Alice",
            "avatar": "url"
          },
          "lastMessage": {
            "content": "Tối nay rảnh không?",
            "type": "TEXT",
            "senderId": "uuid",
            "createdAt": "2026-05-19T21:30:00Z",
            "isUnsent": false
          },
          "unreadCount": 2,
          "lastInteractionAt": "2026-05-19T21:30:00Z"
        }
      ],
      "nextCursor": "...",
      "hasMore": true
    }
    ```

## 7. Acceptance Criteria
- **AC1:** Lấy inbox thành công → Trả HTTP 200 kèm danh sách, sắp xếp mới nhất lên đầu.
- **AC2:** Match chưa có tin nhắn nào → `lastMessage = null`.
- **AC3:** Tin nhắn cuối bị thu hồi → snippet = "Tin nhắn đã bị thu hồi".
- **AC4:** Ghost Data → Match có đối phương bị Banned/Deleted không xuất hiện.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `limit` > 50 hoặc ≤ 0, THE hệ thống SHALL clamp về [1, 50].
- WHERE token không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
