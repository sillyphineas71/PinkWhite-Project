# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Marked as Out of Scope / Future | Header |

---

# UC069: Thả cảm xúc vào tin nhắn (React)

> **Status**: Out of Scope (Phase 1)
> **Revision**: Future Improvement / Out of Scope (Phase 1)
> - **LƯU Ý:** Tính năng này KHÔNG nằm trong database baseline hiện tại và CHƯA được implement trong phase này.
> - Realtime sync qua Socket.IO.

## 1. Context & Goal
Cho phép người dùng thả biểu tượng cảm xúc (❤️ 😂 👍 😮 😢 😡) vào một tin nhắn cụ thể, giống Facebook Messenger / iMessage. Mỗi người chỉ được thả tối đa 1 reaction cho mỗi tin nhắn (thả lại sẽ thay thế reaction cũ). Mục tiêu là tăng tính tương tác trong cuộc trò chuyện.

## 2. Actors & Roles
- **Active User**: Thành viên của Match (cả Sender lẫn Receiver đều có quyền thả reaction).

## 3. Out of Scope (Non-goals)
- Custom emoji / sticker.
- Xem danh sách ai đã react (chỉ hiển thị trên UI).

## 4. Data Model Impact
- Ghi vào bảng `MessageReaction` (hoặc nhúng vào bảng `Message` dạng JSON column):
  - `id`: UUID.
  - `messageId`: FK → Message.
  - `userId`: FK → User.
  - `emoji`: String (1 ký tự emoji hoặc shortcode: `HEART`, `LAUGH`, `THUMBS_UP`, `WOW`, `SAD`, `ANGRY`).
  - `createdAt`: DateTime.
- INSERT / UPDATE / DELETE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 150ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ thành viên của Match mới có quyền react.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "MSG_REACT", userId, messageId, emoji }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Tin nhắn tồn tại, `isUnsent = false`, User thuộc Match `ACTIVE`.
- **Rules**:
  - **Thêm/Thay đổi Reaction**: WHEN User gọi `POST /api/chat/messages/:messageId/react` với payload `{ emoji }`, THE hệ thống SHALL:
    1. Kiểm tra tin nhắn chưa bị thu hồi (`isUnsent = false`).
    2. Nếu User chưa react tin nhắn này → INSERT reaction mới.
    3. Nếu User đã react trước đó → UPDATE reaction cũ thành emoji mới.
    4. Phát sự kiện Socket `chat:messageReacted` tới đối phương kèm `{ matchId, messageId, userId, emoji }`.
  - **Gỡ Reaction**: WHEN User gọi `DELETE /api/chat/messages/:messageId/react`, THE hệ thống SHALL:
    1. Xóa reaction của User trên tin nhắn đó.
    2. Phát sự kiện Socket `chat:messageReactionRemoved` tới đối phương.

## 7. Acceptance Criteria
- **AC1:** Thả reaction thành công → Đối phương nhận event realtime.
- **AC2:** Thả lại reaction khác → Reaction cũ bị thay thế.
- **AC3:** Gỡ reaction thành công → Đối phương nhận event xóa.
- **AC4:** React vào tin nhắn đã bị thu hồi → Bị từ chối.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `messageId` không tồn tại, THE hệ thống SHALL trả về HTTP 404.
- WHERE tin nhắn đã bị thu hồi (`isUnsent = true`), THE hệ thống SHALL trả về HTTP 400 "Không thể thả cảm xúc vào tin nhắn đã thu hồi".
- WHERE `emoji` không nằm trong danh sách cho phép, THE hệ thống SHALL trả về HTTP 400.
- WHERE User không thuộc Match, THE hệ thống SHALL trả về HTTP 403.
