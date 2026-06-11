# UC065: Cập nhật trạng thái tin nhắn (Read Receipts)

> **Revision**: v2 — Production-Grade
> - Đánh dấu tin nhắn từ `SENT` → `DELIVERED` → `READ`.
> - Phát Socket event realtime cho Sender khi Receiver đọc.
> - **v2 (Vá Lỗ hổng 2)**: Cập nhật `unreadCount` dựa trên thời gian thực thay vì gán cứng bằng 0 để chống Race Condition khi có tin nhắn mới tới cùng lúc.

## 1. Context & Goal
Read Receipts là tính năng giúp người dùng biết tin nhắn của mình đã được đối phương nhận và đọc chưa (dấu tích xanh giống WhatsApp/iMessage). Mục tiêu là đồng bộ trạng thái tin nhắn realtime giữa 2 bên.

## 2. Actors & Roles
- **Receiver**: Người nhận tin nhắn. Hệ thống tự động cập nhật `DELIVERED` khi Receiver online, và `READ` khi Receiver mở cuộc trò chuyện.

## 3. Out of Scope (Non-goals)
- Tắt/Bật Read Receipts theo ý người dùng (giai đoạn sau).
- Typing indicator ("Đang gõ...") — sẽ được xử lý riêng bằng ephemeral Socket event.

## 4. Data Model Impact
- Cập nhật cột `status` trong bảng `Message` từ `SENT` → `DELIVERED` → `READ`.
- UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Status update (DB) | ≤ 50ms |
| Socket event gửi cho Sender | ≤ 100ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ Receiver mới có quyền cập nhật trạng thái tin nhắn.

### 5.4 Observability
- Không ghi log (tránh spam log do gọi quá nhiều lần).

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Tin nhắn tồn tại và thuộc về Match của Receiver.
- **Rules**:
  - **DELIVERED**: WHEN Receiver kết nối Socket (online) hoặc lấy lịch sử tin nhắn (UC064), THE hệ thống SHALL tự động cập nhật tất cả tin nhắn có `status = SENT` (gửi bởi đối phương) thành `DELIVERED`.
  - **READ**: WHEN Receiver phát sự kiện Socket `chat:markRead` với payload `{ matchId, lastReadMessageId }`, THE hệ thống SHALL:
    1. Tìm `createdAt` của `lastReadMessageId` (gọi là `time_of_last_read`).
    2. Cập nhật tất cả tin nhắn từ `SENT`/`DELIVERED` thành `READ` (chỉ tin nhắn do đối phương gửi) có `createdAt <= time_of_last_read`.
    3. Cập nhật bảng `Match`: `unreadCount = (SELECT COUNT(*) FROM Message WHERE matchId = X AND senderId != ReceiverId AND createdAt > time_of_last_read)`. Đảm bảo không bị lỡ tin nhắn đến sau.
    4. Phát sự kiện Socket `chat:messagesRead` tới Sender kèm `{ matchId, lastReadMessageId }`.

## 7. Acceptance Criteria
- **AC1:** Receiver kết nối Socket → Các tin nhắn SENT tự chuyển thành DELIVERED.
- **AC2:** Receiver gọi markRead → Tất cả tin nhắn chuyển thành READ, Sender nhận event.
- **AC3:** Sender thấy dấu tích chuyển từ "đã gửi" → "đã nhận" → "đã đọc".

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `lastReadMessageId` không tồn tại, THE hệ thống SHALL bỏ qua (không ném lỗi).
- WHERE Receiver cố gắng đánh dấu tin nhắn do chính mình gửi, THE hệ thống SHALL bỏ qua.
