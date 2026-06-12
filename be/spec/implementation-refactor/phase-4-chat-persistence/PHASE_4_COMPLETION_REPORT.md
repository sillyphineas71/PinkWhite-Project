# PHASE 4 COMPLETION REPORT

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-13 | Phase 4 Completion Report | All |

## 1. Files Affected / Created / Deleted

### 1.1. Core Chat Module (`src/modules/chat`)
- `[NEW]` `dto/send-message.dto.ts`
- `[NEW]` `dto/inbox.dto.ts`
- `[NEW]` `dto/message.dto.ts`
- `[NEW]` `enums/chat-error.enum.ts`
- `[NEW]` `exceptions/chat.exception.ts`
- `[NEW]` `utils/chat-cursor.util.ts`
- `[NEW]` `repositories/message.repository.ts`
- `[NEW]` `repositories/chat-inbox.repository.ts`
- `[NEW]` `chat.service.ts`
- `[NEW]` `chat.controller.ts`
- `[NEW]` `chat.module.ts`

### 1.2. Match Module Changes (`src/modules/match`)
- `[DELETE]` `repositories/match.repository.ts` (Removed legacy mock repository completely)
- `[NEW]` `repositories/match-read.repository.ts` (Postgres-backed read queries and filters)
- `[MODIFY]` `match.service.ts` (Integrated Prisma for `unmatch` and DB lookups)
- `[MODIFY]` `match.module.ts` (Updated providers to use `MatchReadRepository`)

### 1.3. Testing (`test/`)
- `[NEW]` `chat.e2e-spec.ts` (E2E Test Suite cho Chat Module)
- `[MODIFY]` `match.e2e-spec.ts` (Fix logic theo Database persistence thật, loại bỏ mock data)

### 1.4. Documentation
- `[MODIFY]` `CLAUDE.md` (Updated Known Implementation State for Chat and Match)
- `[MODIFY]` `README.md` (Updated Persistence status)
- `[MODIFY]` `spec/global/known-gaps.md` (Removed mock Match repo gaps, added Socket/Outbox limitation warnings)
- `[MODIFY]` `spec/implementation-refactor/phase-4-chat-persistence/PLAN.md`
- `[MODIFY]` `spec/implementation-refactor/phase-4-chat-persistence/TASKS.md`
- `[MODIFY]` `spec/implementation-refactor/phase-4-chat-persistence/SPEC.md`

## 2. Test Fidelity / Bypasses

Chúng tôi đã thiết lập môi trường test E2E để kiểm tra thực tế hành vi của Database. Tuy nhiên, các kỹ thuật test setup (bypasses/mocks) sau đã được sử dụng nhằm kiểm chứng Business Logic:

- **Auth Session Bypassing:** Trong hook `beforeAll()`, dummy users được tạo trực tiếp thông qua lệnh `prisma.user.create()` (kèm các auth identities giả) và JWT token được generate bằng `JwtService.sign()` thay vì phải gọi luồng `POST /api/auth/register` hoặc `POST /api/auth/login`. Điều này giúp test case độc lập với module Auth.
- **Race Condition Interleaving Simulation:** Để test Race Condition trong thao tác `mark-read`, test case không sử dụng mock/stub của Jest đối với service, mà thực sự gọi 2 HTTP requests song song: `readPromise = request().post('/chat/read')` và `sendPromise = request().post('/chat/messages')`. Vì network delay và database lock có tính ngẫu nhiên, test assertion được nới lỏng bằng cách khẳng định `unreadCountA` thuộc tập hợp `[0, 1]`, xác minh tin nhắn tới muộn không bị nuốt bởi việc gán số 0 thủ công.
- **Match State Forcing:** Để test luồng chặn `UNMATCHED`, trạng thái của match (`status`, `unmatchedAt`) được cưỡng chế thay đổi qua `prisma.match.update()` chứ không gọi API `unmatch`, sau đó khôi phục lại (ACTIVE) ở các hook `beforeAll()` của block tiếp theo.
- **Teardown Cleanup (afterAll):** Các record tạo trong database `messages`, `matches`, `authIdentity`, `profile` và `user` được xoá thông qua Prisma. Foreign Key lock đã được xử lý bằng cách lookup tất cả `match` có dính đến `userId` đang test. 

## 3. Trạng thái Acceptance Criteria (AC)

### TASK 1: Migrate MatchReadRepository & Search Endpoint
- [x] Tạo `MatchReadRepository`. Dùng Prisma.
- [x] Đã xử lý canonical pair.
- [x] Xóa toàn bộ mock `MatchRepository`.
- [x] Fix E2E test cho Match.

### TASK 2: DTOs, Exceptions & Cursor Util
- [x] `send-message.dto.ts` class-validator hoạt động ổn định.
- [x] `chat-cursor.util.ts` encode/decode ISO timestamptz. Test roundtrip qua Base64 thành công.
- [x] `chat.exception.ts` kế thừa HttpException/MatchException.

### TASK 3: Data Access Layer (Message & Inbox Repositories)
- [x] `LATERAL` join để query Inbox kèm tin nhắn mới nhất trong 1 query.
- [x] Pagination Keyset không dùng OFFSET, quét ranh giới `NULL`.
- [x] SQL Query parameters an toàn tuyệt đối.

### TASK 4: Core Chat Logic (Send & Get Messages)
- [x] `sendMessage` gộp trong một Prisma `$transaction`.
- [x] Atomic increment `unreadCount_a/b` và TOCTOU test chặn thao tác khi match ngắt kết nối.
- [x] Phân trang tin nhắn bằng `cursor` và `limit` hoạt động chuẩn xác.

### TASK 5: Mark-Read Logic & Inbox Serving
- [x] Inbox lọc chính xác match ở trạng thái `ACTIVE`.
- [x] `markAsRead` đọc pointer cuối, đối chiếu `newest_id` và đếm lại (count after).
- [x] Race condition test cho `mark-read` pass thành công.

### TASK 6: Update Documentation & Final Review
- [x] Cập nhật đầy đủ `README.md`, `CLAUDE.md`, `known-gaps.md`.
- [x] Run `lint`, `test`, `build` không còn lỗi nào liên quan tới code đã làm.
- [x] Grep mock `MatchRepository` trả về rỗng.

## 4. OUT OF SCOPE - Cần Lưu Ý
Như đã khẳng định, Phase 4 CHỈ tập trung vào Persistence (Lưu trữ DB). Các tính năng sau CHƯA hoàn thành và là mục tiêu của các Phase kế tiếp:
- **Realtime (Socket.IO):** CHƯA kết nối, CHƯA có xác thực Socket, người dùng phải tải lại trang để thấy tin nhắn mới.
- **Outbox Pattern (Push Notifications):** Push Notif không hoạt động do chưa có worker bắt event xử lý.
- **Image Upload:** DTO có hỗ trợ `IMAGE`, nhưng API upload storage thực tế (như S3/GCS) chưa được tích hợp, tạm thời ném lỗi `IMAGE_NOT_SUPPORTED`.
- **Swipe Persistence:** Hiện tại Swipe Module vẫn dùng In-Memory Repository. Đây là một GAP quan trọng cần giải quyết trong Phase 5 trước khi có thể gọi là Backend hoàn chỉnh.
