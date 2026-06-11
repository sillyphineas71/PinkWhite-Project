# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial chat module spec | Toàn bộ file |

---

# Chat Module

## Goal
Cung cấp lớp persistence cho tin nhắn giữa matched users. Kiểm tra chat permission dựa trên match status và block status.

## Responsibilities
- Lưu message vào DB.
- List conversations (inbox).
- List messages của một conversation (cursor pagination).
- Kiểm tra chat permission (active match + no block).
- Mark messages/conversation as read (persist).
- Trigger realtime delivery (notify `realtime` module).

## Out of Scope
- Realtime delivery (→ `realtime` module — chat persistence triggers, realtime delivers).
- Match creation (→ `match` module).
- Gửi tin nhắn Voice, GIF (Out of Scope phase 1).
- React to message (Future Improvement).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-09.

Key rules:
- Chỉ active matched users mới chat được.
- Sau unmatch: không gửi được message mới.
- Sau block: không gửi được message mới.
- Permission phải check mỗi lần gửi message.
- Message content là sensitive data — KHÔNG log.

## Privacy / Security Notes
- Message content phải không được log.
- Chỉ participants của match mới access được messages.
- Error khi không được chat phải generic: "Chat no longer available" (không tiết lộ unmatch vs block).
- Không có public message read endpoint.

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/chats | User | Danh sách conversations (inbox) |
| GET | /api/chats/:matchId/messages | User | Messages của một conversation |
| POST | /api/chats/:matchId/messages | User | Gửi message |
| PATCH | /api/chats/:matchId/read | User | Mark conversation as read |

## Data Model Requirements
*(Concept only)*

**Message entity (`messages`):**
- `id` (UUIDv7)
- `match_id` (FK → Match)
- `sender_id` (FK → User, required. Ghi chú: Nếu tương lai cần System messages không có sender_id thì phải sửa DB schema, hiện tại schema bắt buộc).
- `message_type` (text, image, system)
- `body` (text content)
- `media_url` (photo url)
- `status` (sent, deleted_by_sender, removed_by_moderation)
- `created_at`

**Conversation Read Status:**
- KHÔNG có bảng riêng. Read state (`unread_count`, `last_interaction_at`) được lưu trữ ngay trên các fields của bảng `matches`.

## Events
*(Target)*

| Event | Trigger | Consumer |
|---|---|---|
| `MESSAGE_SENT` | Message stored | Realtime (deliver via socket) |
| `MESSAGE_READ` | Mark read | Realtime (deliver read receipt) |

## Logging / Audit
- Log: "Message sent" với matchId, senderId — KHÔNG log content.
- Log: "Message marked read" với matchId, userId.

## Testing Notes
- Unit: chat permission check (all scenarios: unmatched, blocked, not participant, active match OK).
- Integration: send message in active match → 201. After unmatch → 403. After block → 403.
- Privacy: GET messages must verify participant. Non-participant → 403 or 404.

## Known Implementation Gaps
- **GAP-10:** Chat module chưa tồn tại (`src/modules/chat` chưa có).
- **GAP-06:** Socket gateway chưa có auth → realtime delivery chưa hoạt động.

## Open Questions
- Message retention policy bao lâu? (xem OQ-02-01)
- Có cần message search không?
- Cursor pagination dùng `createdAt` hay `id`?
- Khi hard delete account: messages của user đó thì sao?
