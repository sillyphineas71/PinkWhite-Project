# UC067: Gửi tin nhắn Hình ảnh / GIF

> **Revision**: v1 — Production-Grade
> - Upload ảnh/GIF lên Cloud Storage, gửi URL qua Socket.IO.
> - Validate kích thước và định dạng file.

## 1. Context & Goal
Ngoài tin nhắn text, người dùng cần có khả năng chia sẻ hình ảnh và GIF trong cuộc trò chuyện. Flow gồm 2 bước: (1) Upload file lên Cloud Storage (giống flow upload ảnh Profile — UC020), (2) Gửi tin nhắn dạng `IMAGE` hoặc `GIF` chứa URL của file. Mục tiêu là hỗ trợ giao tiếp đa phương tiện một cách mượt mà.

## 2. Actors & Roles
- **Sender**: Người dùng gửi ảnh/GIF. Phải thuộc Match `ACTIVE`.

## 3. Out of Scope (Non-goals)
- Xử lý video dài (clip).
- Sticker packs (gói sticker tùy chỉnh).

## 4. Data Model Impact
- Ghi vào bảng `Message` với `type = IMAGE` hoặc `type = GIF`, `content` chứa URL của file đã upload.
- Cập nhật `Match.lastInteractionAt` và `unreadCount` (giống UC063).
- INSERT + UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Upload File (Presigned URL) | ≤ 500ms |
| Socket Event gửi message | ≤ 200ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Giới hạn dung lượng file: **tối đa 10MB** cho ảnh, **tối đa 5MB** cho GIF.
- Chỉ chấp nhận định dạng: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- URL file phải là URL hợp lệ từ Cloud Storage đã xác thực (không chấp nhận URL bên ngoài).

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "MSG_IMAGE_SENT", senderId, matchId, messageId, fileSize }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Sender thuộc Match `ACTIVE`. File đã được upload thành công lên Cloud Storage.
- **Rules**:
  - **Bước 1 (Upload)**: WHEN Sender gọi `POST /api/chat/:matchId/upload`, THE hệ thống SHALL:
    1. Validate định dạng và kích thước file.
    2. Trả về Presigned URL để Client upload trực tiếp lên Cloud Storage.
  - **Bước 2 (Gửi message)**: WHEN Sender phát sự kiện Socket `chat:sendMessage` với payload `{ matchId, type: "IMAGE"|"GIF", content: "<fileUrl>" }`, THE hệ thống SHALL:
    1. Validate URL thuộc domain Cloud Storage hợp lệ.
    2. INSERT Message vào DB.
    3. Cập nhật Match (`lastInteractionAt`, `unreadCount`).
    4. Phát Socket event `chat:newMessage` tới Receiver.

## 7. Acceptance Criteria
- **AC1:** Upload + gửi ảnh thành công → Receiver nhận được tin nhắn chứa URL ảnh.
- **AC2:** File quá 10MB → Bị từ chối.
- **AC3:** Định dạng không hợp lệ (VD: `.exe`) → Bị từ chối.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE file vượt quá giới hạn dung lượng, THE hệ thống SHALL trả về HTTP 413 Payload Too Large.
- WHERE định dạng file không hợp lệ, THE hệ thống SHALL trả về HTTP 415 Unsupported Media Type.
- WHERE URL file không thuộc domain Cloud Storage, THE hệ thống SHALL từ chối với lỗi `chat:error`.
