| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-12 | Thêm quyết định D7 (Migrate GET /matches/search) | Decision Log, 4.1, 8 |
| 2026-06-12 | Initial SPEC creation and lockdown | All |

# Phase 4: Chat Persistence Specification

## DECISION LOG (LOCKED)
| ID | Câu hỏi | Phương án (kèm trade-off) | Khuyến nghị Reviewer | Trạng thái |
|---|---|---|---|---|
| D1 | Image message ở phase này | **(a) Chỉ TEXT.** API từ chối `messageType=IMAGE` ở phase này (trả lỗi domain `IMAGE_NOT_SUPPORTED`, không 500). | Chọn (a) | **LOCKED** |
| D2 | Đọc lịch sử khi match đã UNMATCHED/BLOCKED | **Match không-ACTIVE:** Cấm gửi, KHÔNG cho đọc lịch sử, loại hoàn toàn khỏi inbox. | | **LOCKED** |
| D3 | Soft-delete message (`deleted_by_sender`) | **(a) Hoãn soft-delete** sang phase sau. | | **LOCKED** |
| D4 | Có gộp việc fix match-read split-brain vào phase 4 không? | **(a) Gộp:** Viết MỘT `MatchReadRepository` (Postgres) dùng chung cho ChatService và MatchService; xóa mock `MatchRepository`, trỏ `GET /matches` sang Postgres (kèm authz participant-only + test). | | **LOCKED** |
| D5 | Unread/mark-read semantics | **(a) Tinh chỉnh, race-safe:** Mark-read sử dụng transaction lock row match, dịch chuyển pointer tiến lên, và đếm lại số tin nhắn chưa đọc từ đối phương để tránh nuốt tin nhắn xen ngang. | | **LOCKED** |
| D6 | Số phận MatchService/MatchController khi xóa mock MatchRepository | **(a) Chốt phương án xử lý từng route:** Migrate List, Profile, Unmatch sang Postgres. Disable Rematch. Xóa cũ Mark-read. | | **LOCKED** |
| D7 | Số phận GET /api/matches/search | **(a) Migrate sang Postgres:** Dùng `MatchReadRepository`, thêm filter `ILIKE` trên `profile.display_name` của đối phương, authz participant-only, bỏ phụ thuộc mock. | | **LOCKED** |

---

## 1. Overview
Phase 4 introduces Chat Persistence, enabling users who have matched to exchange messages. It replaces the legacy mock Match system with a pure PostgreSQL-backed read/write architecture.

## 2. Goals
* Provide a robust, transaction-safe API for sending and retrieving text messages within an `ACTIVE` Match.
* Establish an inbox view and unified match fetching using SET-BASED queries without N+1.
* Strictly maintain accurate unread message counts with race-safe atomic operations.

## 3. Scope
**In Scope:**
* Persistence layer của chat (tạo `messages` record + cập nhật denormalized fields trên `matches`).
* Xóa Mock `MatchRepository` và tạo `MatchReadRepository` đọc từ Postgres.
* Lọc permission nghiêm ngặt theo `match.status = ACTIVE`.
* Các Use Cases: Gửi tin nhắn, danh sách tin nhắn, inbox list, mark-read.
* Race-safe unread count and read pointers.

**Out of Scope / Future (Không thực hiện ở phase này):**
* Realtime socket delivery & socket auth (thuộc module realtime).
* Outbox / notification cho sự kiện `new_message`.
* Storage upload thật (voice, video, media).
* Typing indicators, Presence (Online/Offline status), Read receipts realtime.
* ClientMessageId idempotency cho retry logic.
* Rate-limit riêng cho endpoint send (anti-spam).
* Render các tin nhắn `DELETED_BY_SENDER`/`REMOVED_BY_MODERATION` trong list.

## 4. Dependencies & Architecture
* **Match Module**: D4 quyết định xóa mock repository. Chat và Match sẽ dùng chung `MatchReadRepository` để đọc dữ liệu Postgres trực tiếp.
* **Storage Module**: Out of scope (D1 quyết định chỉ có TEXT).

### 4.1. Match Module Disposition
Để giải quyết dứt điểm technical debt của việc sử dụng mock `MatchRepository`, các API thuộc `MatchController` và logic trong `MatchService` sẽ được định đoạt như sau:
* `GET /api/matches`: **Migrate** sang dùng `MatchReadRepository` (Postgres). Bổ sung quyền authz participant-only.
* `GET /api/matches/search`: **Migrate** sang dùng `MatchReadRepository` (Postgres). Bổ sung quyền authz participant-only và filter `ILIKE` trên `profile.display_name` của đối phương.
* `GET /api/matches/:id/profile`: **Migrate** sang dùng `MatchReadRepository` (Postgres). Bổ sung quyền authz participant-only.
* `POST /api/matches/:id/unmatch`: **Migrate** sang Postgres: update `status=UNMATCHED`, ghi nhận `unmatched_at`, `unmatched_by_user_id`. Cần authz participant.
* `POST /api/matches/:id/rematch`: **Hoãn (Disable)** ở phase này. Disable route và trả về lỗi `NOT_IMPLEMENTED`.
* `PATCH /api/matches/:id/read` (cũ): **Xóa (Removed)**. Tính năng mark-read được ủy quyền hoàn toàn cho `POST /api/chat/:matchId/read`.
**Cam kết:** Sau phase 4, KHÔNG CÒN reference nào tới mock `MatchRepository` trong toàn bộ codebase.

## 5. Domain Model & Semantics

### Message
* Primary entity. Bảng `messages`.
* Key fields: `id`, `matchId`, `senderId`, `messageType`, `body`, `createdAt`.

### Match (Denormalized fields)
* `unread_count_a` / `unread_count_b`: Lưu số tin chưa đọc. Tăng bằng `{ increment: 1 }` khi nhận tin. Giảm bằng phép đếm lại khi mark-read.
* `last_read_message_id_a` / `last_read_message_id_b`: Pointer tin nhắn đọc cuối cùng. Chỉ dịch chuyển tiến lên.
* `last_read_at_a` / `last_read_at_b`: Timestamp lúc mark-read.
* **Semantics**: `last_message_at` CHỈ cập nhật khi có tin nhắn mới. `last_interaction_at` cập nhật khi match được tạo hoặc có tương tác khác. Inbox sẽ sort theo `last_message_at DESC` để đảm bảo ổn định vị trí các cuộc hội thoại chưa đọc.

## 6. Use Cases & Main Flows

### UC-CHAT-001 Send Message
* **Main flow (Race-safe & Atomic)**:
  1. Verify Match exists in Postgres and Actor is a participant. 
  2. Verify `match.status === ACTIVE`. (Nếu không ACTIVE -> chặn).
  3. Validate TEXT body: `trim()`, cấm rỗng/chỉ-whitespace, giới hạn `1..1000` chars. Nếu truyền `messageType=IMAGE` -> trả lỗi `IMAGE_NOT_SUPPORTED`.
  4. Thực thi trong 1 **Transaction**:
     * Insert record vào bảng `messages`.
     * Xác định target side: Nếu Actor = `userAId` -> tăng `unread_count_b: { increment: 1 }`. Ngược lại tăng `unread_count_a: { increment: 1 }`.
     * Update `last_message_at` và `last_interaction_at` thành hiện tại.
  5. Trả về `MessageDto`.

### UC-CHAT-002 Get Conversation Messages
* **Main flow**:
  1. Verify Match exists in Postgres and Actor is a participant.
  2. Verify `match.status === ACTIVE` (D2 chốt cấm đọc lịch sử nếu không active).
  3. Truy vấn `messages` theo `match_id` với Cursor-based pagination composite cursor: `{createdAt, id}`. Sort order là `createdAt DESC, id DESC`. Limit mặc định 20, max 50.

### UC-CHAT-003 Get Inbox
* **Main flow**:
  1. Truy vấn SET-BASED (VD: Lateral Join / Window function), **CẤM N+1**.
  2. Chỉ lấy các Match có `status = ACTIVE` mà Actor tham gia. Limit mặc định 20, max 50.
  3. Select các trường profile của đối phương + message mới nhất + unread count tương ứng của Actor.
  4. Sort theo `last_message_at DESC NULLS LAST, match_id DESC`. (Nếu `last_message_at` là NULL, tức match chưa có tin nhắn, đẩy xuống dưới cùng).

### UC-CHAT-004 Mark Conversation As Read
* **Main flow (Race-safe)**:
  1. Verify Match `ACTIVE` và Actor tham gia.
  2. Thực thi trong 1 **Transaction**:
     * `SELECT FOR UPDATE` row match để lấy lock.
     * Xác định side của Actor (VD: A).
     * Lấy `id` của tin nhắn mới nhất trong hội thoại.
     * So sánh: Nếu `newest_msg_id > last_read_message_id_a` (pointer chỉ đi tới), thì update `last_read_message_id_a = newest_msg_id`.
     * Cập nhật `last_read_at_a = NOW()`.
     * **TUYỆT ĐỐI KHÔNG** "set 0" mù quáng. Cập nhật `unread_count_a` = `COUNT(*)` số lượng tin nhắn do đối phương gửi (side B) có `id > last_read_message_id_a`. (Thường là 0, nhưng nếu có tin xen ngang lúc đang đọc sẽ tự giữ lại > 0).

## 7. Business Rules
* **BR-001**: Quyền truy cập: Chỉ userA hoặc userB của một Match mới được thao tác với match đó.
* **BR-002**: Message Validation: TEXT body bắt buộc phải `trim()`, không được rỗng hoặc chỉ toàn whitespace, độ dài trong khoảng `1..1000` ký tự.
* **BR-003**: Trạng thái cuộc trò chuyện: Mọi endpoint chat (gửi, đọc lịch sử, inbox) chỉ hoạt động khi `match.status === ACTIVE`. Nếu status bị thay đổi (bởi logic Unmatch hoặc Safety module set BLOCKED), hội thoại tự động bị ẩn và chặn truy cập hoàn toàn.
* **BR-004**: Pagination & Limits: Cả messages và inbox đều sử dụng limit mặc định là 20, tối đa 50 mỗi trang.
* **BR-005**: Inbox Cursor Pagination sử dụng composite payload: `{ lastMessageAt, matchId }`. Xử lý NULL `lastMessageAt` cho các Match chưa có tin nhắn bằng cách gom về cuối danh sách.

## 8. API Contracts & DTOs

### Chat APIs
* `POST /api/chat/:matchId/messages` -> `MessageDto`
* `GET /api/chat/:matchId/messages?cursor=...&limit=20` -> `{ data: MessageDto[], nextCursor }`
* `GET /api/chat/inbox?cursor=...&limit=20` -> `{ data: InboxItemDto[], nextCursor }`
* `POST /api/chat/:matchId/read` -> `{ success: true }`

### Match APIs (Migrated / Disabled / Removed)
* `GET /api/matches?cursor=...&limit=20` -> Migrate to Postgres (participant-only)
* `GET /api/matches/search?q=...` -> Migrate to Postgres (participant-only, ILIKE filter on display_name)
* `GET /api/matches/:id/profile` -> Migrate to Postgres (participant-only)
* `POST /api/matches/:id/unmatch` -> Migrate to Postgres (sets `UNMATCHED` status)
* `POST /api/matches/:id/rematch` -> **Disabled** (Returns 501 `NOT_IMPLEMENTED`)
* `PATCH /api/matches/:id/read` -> **Removed**

### Data Transfer Objects & Privacy
**`MessageDto`**
* `id` (String)
* `matchId` (String)
* `senderId` (String)
* `messageType` (Enum: `TEXT`, `IMAGE`)
* `body` (String)
* `createdAt` (DateTime)

**`InboxItemDto`**
* `matchId` (String)
* `partner`: Chỉ lộ `userId`, `displayName`, `avatar`. (Ghi chú Privacy: **KHÔNG LỘ** `email`, `location`, `last_active` bất chấp privacy preferences).
* `latestMessage`: `MessageDto` hoặc `null`.
* `unreadCount`: Int.

## 9. Error Catalog (Domain Errors - No Generic 500)
Tất cả các lỗi business phải ném Exception tương ứng kèm mã Domain:
* `MATCH_NOT_FOUND`: HTTP 404 - Truy cập Match không tồn tại. Dùng chung cho Chat và Match endpoints.
* `NOT_PARTICIPANT`: HTTP 403 - Actor không thuộc về Match. Dùng chung cho Chat và Match endpoints.
* `MATCH_NOT_ACTIVE`: HTTP 403 - Match đã bị hủy hoặc khóa (Unmatched/Blocked).
* `MESSAGE_EMPTY`: HTTP 400 - Nội dung rỗng hoặc toàn khoảng trắng.
* `MESSAGE_TOO_LONG`: HTTP 400 - Vượt 1000 ký tự.
* `IMAGE_NOT_SUPPORTED`: HTTP 400 - Client gửi messageType=IMAGE.
* `INVALID_CURSOR`: HTTP 400 - Base64 cursor sai định dạng.
* `NOT_IMPLEMENTED`: HTTP 501 - Chức năng chưa được triển khai (VD: rematch).

## Appendix A - Prisma Schema Constraints
* **`Match`**: Bảng `matches` sử dụng composite unique key trên `[userAId, userBId]`. Các trường unread (`unreadCountA`, `unreadCountB`) là non-null Int với default = 0.
* **`Message`**: Bảng `messages` chứa foreign keys tới `Match` (`match_id`) và `User` (`sender_id`). Status là Enum (`SENT`, `DELETED_BY_SENDER`, `REMOVED_BY_MODERATION`).
