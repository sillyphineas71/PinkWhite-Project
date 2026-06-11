# UC066: Thu hồi tin nhắn (Unsend)

> **Revision**: v1 — Production-Grade
> - Soft delete tin nhắn (giữ metadata, xóa nội dung).
> - Giới hạn thời gian thu hồi.

## 1. Context & Goal
Cho phép người dùng rút lại tin nhắn đã gửi nhầm. Tin nhắn sẽ không bị xóa vật lý (Hard Delete) mà chỉ ẩn nội dung và đánh dấu `isUnsent = true`. Cả hai bên sẽ thấy placeholder "Tin nhắn đã bị thu hồi". Mục tiêu là bảo vệ quyền riêng tư của Sender khi gửi nhầm.

## 2. Actors & Roles
- **Sender**: Chỉ người gửi tin nhắn gốc mới có quyền thu hồi.

## 3. Out of Scope (Non-goals)
- Hard Delete tin nhắn khỏi DB (lý do pháp lý/CSKH).
- Cho phép Receiver thu hồi tin nhắn người khác gửi.

## 4. Data Model Impact
- Cập nhật cột `isUnsent = true` và xóa `content` (set thành `null` hoặc chuỗi rỗng) trong bảng `Message`.
- UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 200ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ Sender mới có quyền thu hồi tin nhắn.
- Giới hạn thời gian: chỉ được thu hồi trong vòng **60 phút** kể từ lúc gửi.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "MSG_UNSEND", senderId, messageId }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Tin nhắn thuộc về Sender, chưa bị thu hồi trước đó, và còn trong thời hạn 60 phút.
- **Rules**:
  - WHEN Sender gọi `POST /api/chat/messages/:messageId/unsend`, THE hệ thống SHALL:
    1. Kiểm tra tin nhắn tồn tại và Sender là người gửi gốc.
    2. Kiểm tra thời gian tạo tin nhắn chưa quá 60 phút.
    3. Cập nhật `Message`: `isUnsent = true`, xóa `content`.
    4. Xóa toàn bộ các Reaction (thả cảm xúc) đang gắn với tin nhắn này (nếu có).
    5. Cập nhật bảng `Match`: Nếu tin nhắn bị thu hồi chính là tin nhắn cuối cùng (snippet), thì cập nhật `lastMessageIsUnsent = true` và xóa `lastMessageContent`.
    6. Phát sự kiện Socket `chat:messageUnsent` tới cả Sender và Receiver kèm `{ matchId, messageId }`.
  - THE hệ thống SHALL trả về HTTP 200 OK.

## 7. Acceptance Criteria
- **AC1:** Thu hồi thành công (trong 60 phút) → `isUnsent = true`, cả hai thấy placeholder.
- **AC2:** Thu hồi sau 60 phút → HTTP 400 "Đã quá thời hạn thu hồi".
- **AC3:** Receiver cố thu hồi tin nhắn của Sender → HTTP 403.
- **AC4:** Thu hồi tin nhắn đã thu hồi rồi → HTTP 400.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `messageId` không tồn tại, THE hệ thống SHALL trả về HTTP 404.
- WHERE User không phải là Sender gốc, THE hệ thống SHALL trả về HTTP 403.
- WHERE thời gian đã quá 60 phút, THE hệ thống SHALL trả về HTTP 400 "Đã quá thời hạn thu hồi (60 phút)".
