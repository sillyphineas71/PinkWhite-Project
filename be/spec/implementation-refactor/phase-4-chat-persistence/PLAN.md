| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-12 | Initial Technical Plan with MUST-FIX and MINOR-FIX applied | All |

# Phase 4 Technical Implementation Plan

## 1. FILE/MODULE MAP
**New Files (Chat Module):**
* `src/modules/chat/chat.module.ts`
* `src/modules/chat/controllers/chat.controller.ts`
* `src/modules/chat/services/chat.service.ts`
* `src/modules/chat/repositories/message.repository.ts` (Write/Read messages)
* `src/modules/chat/repositories/chat-inbox.repository.ts` (SET-BASED Inbox query)
* `src/modules/chat/utils/chat-cursor.util.ts`
* `src/modules/chat/dto/send-message.dto.ts`
* `src/modules/chat/dto/message.dto.ts`
* `src/modules/chat/dto/inbox.dto.ts`
* `src/modules/chat/exceptions/chat.exception.ts` (ChatException & ChatErrorCode)

**New Files (Match Module):**
* `src/modules/match/repositories/match-read.repository.ts` (Postgres implementation)
* `src/modules/match/types/match.types.ts` (Nơi chứa `MatchEntity` type để tránh gãy import sau khi xóa file cũ)

**Modified Files:**
* `src/app.module.ts` (Register `ChatModule`)
* `src/modules/match/match.module.ts` (Provide & export `MatchReadRepository`, remove `MatchRepository`)
* `src/modules/match/services/match.service.ts` (Đổi type sang import từ `match.types.ts`, inject `MatchReadRepository`, migrate list/profile/unmatch, trả `NOT_IMPLEMENTED` cho rematch)
* `src/modules/match/controllers/match.controller.ts` (Remove `PATCH /:id/read`, add explicit authz guards cho các endpoints)

**Deleted Files:**
* `src/modules/match/repositories/match.repository.ts` (Mock in-memory map)

## 2. IMPORT AUDIT (Pre-Delete)
**Audit Query:** `grep -r "MatchRepository" src/`
**Findings:** 
The mock `MatchRepository` (and `MatchEntity` type exported from it) is currently imported ONLY in:
1. `src/modules/match/services/match.service.ts`
2. `src/modules/match/match.module.ts`
**Safety Resolution:** Di chuyển `MatchEntity` sang `match.types.ts`. Sửa import trong `match.service.ts`. Xóa file `match.repository.ts`. `SwipeModule` hoàn toàn cách ly và không bị ảnh hưởng.

## 3. CÁCH HIỆN THỰC 3 CHỖ KHÓ

### A. Mark-read Race-safe
Mọi logic phải gói gọn trong 1 closure `prisma.$transaction(async (tx) => { ... })`:
1. **Lock Row:** Dùng `tx.$queryRaw` gọi `SELECT id, unread_count_a, last_read_message_id_a FROM matches WHERE id = $1 FOR UPDATE`.
2. **Xác định tin nhắn mới nhất:** `newest_id = SELECT MAX(id) FROM messages WHERE match_id = $1 AND sender_id = $partner_id`.
3. **Dịch pointer:** Chỉ dịch tiến nếu `(last_read_message_id IS NULL OR newest_id > last_read_message_id)`.
4. **Recompute Unread Count:** Dùng pointer MỚI để đếm lại chính xác số tin chưa đọc bằng:
   `SELECT count(*) FROM messages WHERE match_id = $1 AND sender_id = $partner_id AND id > $NEW_pointer`
   *(Tuyệt đối không set cứng bằng 0 để tránh nuốt tin nhắn xen ngang).*
5. **Update Match:** Gọi `tx.match.update(...)` gán kết quả COUNT vừa tính vào `unread_count_a`, và set `last_read_at_a = NOW()`.

### B. Send: Atomic Increment & Chống TOCTOU
Để chống Time-of-check to Time-of-use (match bị unmatch ngay giữa lúc verify và insert tin), TOÀN BỘ luồng phải chạy trong `prisma.$transaction`:
1. **Verify (Trong TX):** Đọc Match bên trong transaction. Kiểm tra `match.status === ACTIVE` và Actor là participant. Ném `ChatException(MATCH_NOT_ACTIVE)` nếu sai.
2. **Xác định Side:** Check `actor === match.userAId`. 
3. **Insert Message:** `tx.message.create({ data: ... })`
4. **Atomic Update Match:**
   ```typescript
   tx.match.update({
     where: { id: matchId },
     data: {
       unreadCountB: isUserA ? { increment: 1 } : undefined,
       unreadCountA: !isUserA ? { increment: 1 } : undefined,
       lastMessageAt: new Date(),
       lastInteractionAt: new Date(),
     }
   })
   ```

### C. Inbox SET-BASED Query (Keyset Pagination, No N+1)
Tránh N+1 bằng `LATERAL` join và phân trang Keyset (Cursor), BỎ HẲN OFFSET.
Sửa chuẩn Schema SQL:
```sql
SELECT m.id AS match_id, m.last_message_at, m.last_interaction_at,
       m.user_a_id, m.user_b_id,
       CASE WHEN m.user_a_id = $1 THEN m.unread_count_a ELSE m.unread_count_b END AS unread_count,
       p.user_id AS partner_user_id, p.display_name AS partner_name, 
       pp.public_url AS partner_avatar_url,
       msg.id AS msg_id, msg.body AS msg_body, msg.created_at AS msg_created_at
FROM matches m
-- Lấy profile đối phương (đã sửa Join)
JOIN profiles p ON p.user_id = CASE WHEN m.user_a_id = $1 THEN m.user_b_id ELSE m.user_a_id END
-- Lấy avatar chính của user_id (Bỏ profile_id, dùng user_id và is_avatar)
LEFT JOIN profile_photos pp ON pp.user_id = p.user_id AND pp.is_avatar = true AND pp.deleted_at IS NULL
-- Lấy tin nhắn mới nhất
LEFT JOIN LATERAL (
   SELECT id, body, created_at FROM messages 
   WHERE match_id = m.id 
   ORDER BY created_at DESC, id DESC LIMIT 1
) msg ON true
WHERE (m.user_a_id = $1 OR m.user_b_id = $1) AND m.status = 'ACTIVE'
-- (PREDICATE CURSOR SẼ ĐƯỢC CHÈN Ở ĐÂY BỞI REPOSITORY)
ORDER BY m.last_message_at DESC NULLS LAST, m.id DESC
LIMIT $2;
```

## 4. CURSOR & PAGINATION BOUNDS
* **Keyset Predicate cho Inbox (last_message_at DESC NULLS LAST, id DESC)**:
  * Trang đầu: Không có predicate.
  * Trang sau (cursor.lastMessageAt `!=` NULL):
    `AND ((m.last_message_at < $cursorTs) OR (m.last_message_at = $cursorTs AND m.id < $cursorMatchId) OR (m.last_message_at IS NULL))`
  * Trang sau (cursor.lastMessageAt `===` NULL):
    `AND (m.last_message_at IS NULL AND m.id < $cursorMatchId)`
* **Validation**: Ném `ChatException(INVALID_CURSOR)` nếu giải mã Base64 thất bại.
* **Limits**: Default 20, Max 50 trên cả Inbox và Messages endpoint. Bỏ OFFSET.

## 5. ERROR MODEL & MAPPING
Tạo lớp `ChatException` kế thừa `HttpException` (hoặc xử lý qua ExceptionFilter của NestJS) bao bọc `ChatErrorCode` Enum:
* `MATCH_NOT_FOUND` -> 404
* `NOT_PARTICIPANT` -> 403
* `MATCH_NOT_ACTIVE` -> 403
* `MESSAGE_EMPTY` -> 400
* `IMAGE_NOT_SUPPORTED` -> 400
* `INVALID_CURSOR` -> 400
* `NOT_IMPLEMENTED` -> 501

## 6. TEST PLAN
* `chat.e2e-spec.ts`:
  * **Send Happy-path**: Gửi tin thành công.
  * **Send Validation**: Empty body, quá 1000 chars, `messageType=IMAGE` đều ném exception tương ứng.
  * **List Pagination**: Test cursor composite `{createdAt, id}` phân trang đúng logic, đủ phần tử.
  * **Inbox Set-based & NULL Sorting**: Match không có tin rớt xuống dưới, inbox loại bỏ triệt để các Match có status `!= ACTIVE`.
  * **Mark-read Race**: Đảm bảo tin xen ngang không bị set 0 (nuốt tin).
  * **Unmatch & Ghost Data**: Unmatch -> Chat API lập tức từ chối gửi tin và giấu khỏi inbox.
* `match.e2e-spec.ts` (Migrated):
  * **Get Match Validation**: Cặp đôi Swipe nhau tạo Match -> `GET /matches` TRẢ ĐÚNG DỮ LIỆU TỪ POSTGRES (Nghiệm thu D4 hoàn thành).
  * **Authz**: Non-participant 403.
  * **Rematch Disabled**: 501 Not Implemented.

## 7. DOCS
* **README.md**: Đánh dấu "Chat Persistence" -> DONE trong bảng Implemented.
* **CLAUDE.md**: Cập nhật Chat boundaries và xóa cảnh báo mock `MatchRepository` khỏi Known Gaps.

## 8. SEQUENCING
1. **Bước 1**: Tạo `match.types.ts`, `MatchReadRepository` và migrate MatchService + Controller. Đổi type và dọn dẹp import. Chạy Test của Match để pass.
2. **Bước 2**: Khởi tạo `ChatModule`, `ChatException`, DTOs, Utils.
3. **Bước 3**: Viết `MessageRepository` (Send & Query messages) và `ChatInboxRepository` (SQL LATERAL + Keyset).
4. **Bước 4**: Viết `ChatService` (Transactions, Race-safe logic) và `ChatController`.
5. **Bước 5**: Viết E2E Test và Unit Test để fix triệt để mọi race condition.
6. **Bước 6**: Update `README.md` & `CLAUDE.md`.
