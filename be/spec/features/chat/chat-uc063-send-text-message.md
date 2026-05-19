# UC063: Gửi tin nhắn Text

> **Revision**: v2 — Production-Grade
> - Gửi tin nhắn văn bản qua Socket.IO.
> - Tích hợp cập nhật `unreadCount` và `lastInteractionAt` trên bảng Match.
> - **v2 (Vá Lỗ hổng 1 & 3)**: Sử dụng `clientMessageId` (UUID) để chống duplicate do mạng rớt. Cập nhật các cột Snippet (`lastMessage...`) thẳng vào bảng `Match`.

## 1. Context & Goal
Đây là tính năng cốt lõi nhất của hệ thống Chat. Sau khi hai người Match thành công, họ có thể gửi tin nhắn text cho nhau theo thời gian thực thông qua Socket.IO. Mỗi tin nhắn phải được lưu trữ vĩnh viễn (persistent) vào Database để hỗ trợ lấy lịch sử (UC064). Mục tiêu là đảm bảo tin nhắn được gửi, nhận và lưu trữ chính xác với độ trễ tối thiểu.

## 2. Actors & Roles
- **Sender**: Người dùng gửi tin nhắn. Phải thuộc về lượt Match đang `ACTIVE`.
- **Receiver**: Người nhận tin nhắn. Nếu đang online (kết nối Socket), nhận tin nhắn realtime. Nếu offline, tin nhắn được lưu DB và `unreadCount` tăng lên.

## 3. Out of Scope (Non-goals)
- Gửi tin nhắn hình ảnh / GIF (UC067).
- Gửi tin nhắn Voice (UC068).
- End-to-End Encryption (E2EE) — chưa nằm trong scope giai đoạn này.

## 4. Data Model Impact
- Ghi vào bảng `Message`:
  - `id`: Bắt buộc sử dụng `clientMessageId` (UUID) từ phía Client gửi lên (tránh trùng lặp khi mạng rớt retry).
  - `matchId`: FK → Match.
  - `senderId`: FK → User.
  - `type`: Enum (`TEXT`, `IMAGE`, `GIF`, `VOICE`).
  - `content`: String (nội dung text, tối đa 2000 ký tự).
  - `status`: Enum (`SENT`, `DELIVERED`, `READ`).
  - `isUnsent`: Boolean (mặc định `false`, `true` khi bị thu hồi — UC066).
  - `createdAt`: DateTime.
  - `updatedAt`: DateTime.
- Cập nhật bảng `Match`: 
  - Tăng `unreadCountA` hoặc `unreadCountB` của **phía nhận**.
  - Cập nhật các cột Snippet: `lastInteractionAt = NOW()`, `lastMessageContent`, `lastMessageSenderId`, `lastMessageType`, `lastMessageIsUnsent = false`.
- INSERT + UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Socket Event → DB Persist | ≤ 100ms |
| Socket Event → Receiver nhận | ≤ 200ms (nếu online) |

### 5.2 Pagination
- Không áp dụng (gửi từng tin nhắn).

### 5.3 Security & Privacy
- Chỉ 2 thành viên trong Match `ACTIVE` mới được phép gửi/nhận tin nhắn cho nhau.
- Content phải được sanitize (loại bỏ HTML/Script injection).
- Không áp dụng bộ lọc Profanity/URL vì đây là cuộc trò chuyện riêng tư 1-1.
- Chặn gửi tin nhắn nếu Match đã bị Unmatch.
- **Rate Limiting**: Tối đa 30 tin nhắn/phút cho mỗi User trong mỗi cuộc trò chuyện để chống spam qua Socket.IO.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "MSG_SENT", senderId, matchId, messageId }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Cả hai User đều có Match `ACTIVE`. Sender đang kết nối Socket.IO. Payload bắt buộc chứa `clientMessageId` (UUID).
- **Rules**:
  - WHEN Sender phát sự kiện Socket `chat:sendMessage` với payload `{ matchId, content, clientMessageId }`, THE hệ thống SHALL:
    1. Xác thực Sender có thuộc Match đó không và Match đang ở trạng thái `ACTIVE`.
    2. Validate `content` (không rỗng, tối đa 2000 ký tự, sanitize HTML).
    3. INSERT bản ghi `Message` với `id = clientMessageId` và `status = SENT`.
       - *Idempotency Check*: Nếu dính lỗi `UNIQUE_VIOLATION` (do Client gửi lại), hệ thống bỏ qua bước Insert và tiến thẳng tới bước trả ACK success.
    4. Cập nhật bảng `Match`: `lastInteractionAt = NOW()`, `lastMessageContent = content`, `lastMessageSenderId = senderId`, `lastMessageType = 'TEXT'`, `lastMessageIsUnsent = false`.
    5. Tăng `unreadCount` của phía nhận (`unreadCountA` nếu nhận là A, `unreadCountB` nếu nhận là B).
    6. Phát sự kiện Socket `chat:newMessage` tới Receiver (nếu đang online).
    7. Trả ACK cho Sender kèm `messageId` (`clientMessageId`) và `createdAt`.
  - IF Receiver đang offline, THEN hệ thống chỉ lưu DB và tăng unreadCount, không phát Socket event.

## 7. Acceptance Criteria
- **AC1:** Sender gửi tin nhắn → Tin nhắn được lưu DB, Receiver nhận được realtime event.
- **AC2:** Sender gửi tin nhắn khi Receiver offline → Tin nhắn lưu DB, unreadCount tăng.
- **AC3:** Gửi tin nhắn rỗng hoặc vượt quá 2000 ký tự → Bị từ chối.
- **AC4:** Gửi tin nhắn vào Match đã bị Unmatch → Bị từ chối.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `matchId` không tồn tại hoặc Sender không thuộc Match, THE hệ thống SHALL phát Socket event `chat:error` với message lỗi.
- WHERE `content` rỗng hoặc vượt quá 2000 ký tự, THE hệ thống SHALL từ chối và phát `chat:error`.
- WHERE Match đã bị Unmatch, THE hệ thống SHALL phát `chat:error` "Cuộc trò chuyện này đã kết thúc".
