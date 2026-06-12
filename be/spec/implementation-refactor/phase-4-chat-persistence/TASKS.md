| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-13 | Code review fixes: delete mock file, fix inbox cursor, deterministic race test, MatchCreationService e2e | Tasks 1, 5, 6 |
| 2026-06-12 | Applied D7 + FIX round | Tasks 1, 2, 3, 6 |
| 2026-06-12 | Initial TASKS generation from PLAN | All |

# Phase 4 Technical Tasks Checklist

## Phase 4 Definition of Done (DoD)
* Build (`npm run build`), Lint (`npm run lint`), và Test (`npm run test`, `npm run test:e2e`) đều Pass xanh 100%.
* Codebase vắng bóng hoàn toàn mock `MatchRepository` (kết quả `grep` bằng rỗng).
* Toàn bộ tài liệu (README.md, CLAUDE.md, spec/global/known-gaps.md) được cập nhật phản ánh đúng thực tế.
* Các tiêu chí Acceptance Criteria (AC) của từng task được pass qua integration test / e2e test.

---

## [x] TASK 1: Migrate MatchReadRepository & Xóa Mock
* **Tiêu đề**: Thay thế hoàn toàn Mock MatchRepository bằng PostgreSQL và dọn dẹp import.
* **Files Affected**:
  * `src/modules/match/match.module.ts`
  * `src/modules/match/repositories/match.repository.ts` (Delete)
  * `src/modules/match/repositories/match-read.repository.ts` (New)
  * `src/modules/match/types/match.types.ts` (New)
  * `src/modules/match/services/match.service.ts`
  * `src/modules/match/controllers/match.controller.ts`
  * `test/match.e2e-spec.ts`
* **Dependencies**: None. Phải làm ĐẦU TIÊN để đảm bảo an toàn.
* **Acceptance Criteria**:
  * `[x]` File mock `match.repository.ts` bị xóa hoàn toàn. Lệnh `grep -r "MatchRepository" src/` không trả về bất kỳ kết quả nào.
  * `[x]` Tính năng Search: `GET /api/matches/search` được migrate lên Postgres qua `MatchReadRepository`, bổ sung logic filter `ILIKE` trên tên đối phương (`profile.display_name`) và Authz participant-only. Test search filter pass.
  * `[x]` `GET /api/matches` trả về đúng match thật từ PostgreSQL (Đã migration).
  * `[x]` Chặn Authz: Truy cập API match mà không phải participant trả về `403 Forbidden` (`NOT_PARTICIPANT`).
  * `[x]` Tính năng Rematch: `POST /api/matches/:id/rematch` trả về HTTP `501 Not Implemented`.
  * `[x]` Endpoint `PATCH /api/matches/:id/read` cũ bị xóa.
  * `[x]` TẤT CẢ unit test và e2e test của MatchModule hiện tại Pass xanh.
  * `[x]` E2E test `MatchCreationService integration`: tạo match qua MatchCreationService, assert `GET /matches` trả về đúng match đó.

## [x] TASK 2: Khởi tạo Chat Infrastructure (DTOs, Exceptions, Utils)
* **Tiêu đề**: Xây dựng cấu trúc nền tảng cho Chat Module (không đụng DB).
* **Files Affected**:
  * `src/modules/chat/chat.module.ts`
  * `src/modules/chat/exceptions/chat.exception.ts`
  * `src/modules/chat/enums/chat-error.enum.ts`
  * `src/modules/chat/utils/chat-cursor.util.ts`
  * `src/modules/chat/dto/send-message.dto.ts`
  * `src/modules/chat/dto/message.dto.ts`
  * `src/modules/chat/dto/inbox.dto.ts`
* **Dependencies**: Task 1.
* **Acceptance Criteria**:
  * `[x]` `ChatException` thừa kế logic filter HTTP status CÙNG cơ chế với `SwipeException`/`MatchException` (vd: kế thừa `HttpException` gốc hoặc dùng custom filter đã có). 
  * `[x]` Viết test chứng minh exception mapping: `INVALID_CURSOR` -> 400, `MATCH_NOT_ACTIVE` -> 403.
  * `[x]` `send-message.dto.ts` sử dụng `class-validator` chạy TRƯỚC transaction: Validate length (1..1000), `trim()`, chặn chuỗi rỗng/chỉ-whitespace, và chặn `messageType=IMAGE`. Test bắt buộc.
  * `[x]` `chat-cursor.util.ts` thiết kế timestamp dạng ISO/chuỗi timestamptz gốc (KHÔNG ép về kiểu JS Date để tránh mất millisecond precision).
  * `[x]` Test cursor round-trip thành công thuần túy (mã hóa JSON ra Base64 rồi giải mã giữ nguyên kiểu).

## [x] TASK 3: Data Access Layer (Message & Inbox Repositories)
* **Tiêu đề**: Viết RAW SQL Queries và Prisma logic cho kho lưu trữ dữ liệu Chat.
* **Files Affected**:
  * `src/modules/chat/repositories/message.repository.ts`
  * `src/modules/chat/repositories/chat-inbox.repository.ts`
* **Dependencies**: Task 2.
* **Acceptance Criteria**:
  * `[x]` `chat-inbox.repository.ts` sử dụng `LATERAL` join (hoặc Window Function) đúng cú pháp, lấy profile đối phương + tin nhắn mới nhất chỉ bằng 1 câu truy vấn (SET-BASED, khẳng định không N+1).
  * `[x]` Áp dụng chính xác 3 nhánh Keyset Pagination của Inbox (xử lý `lastMessageAt` IS NULL) mà KHÔNG dùng OFFSET.
  * `[x]` Test phân trang quét qua ranh giới `NULL` của inbox (từ match có tin nhắn vắt sang match chưa có tin nhắn) thành công.
  * `[x]` Viết Unit Test / E2E Test cho repository để kiểm chứng logic generate SQL parameters không bị lỗi cú pháp.

## [x] TASK 4: Core Chat Logic (Send & Get Messages)
* **Tiêu đề**: Ghép nối Transaction logic cho tính năng Gửi tin và Đọc lịch sử.
* **Files Affected**:
  * `src/modules/chat/services/chat.service.ts`
  * `src/modules/chat/controllers/chat.controller.ts`
  * `test/chat.e2e-spec.ts`
* **Dependencies**: Task 3.
* **Acceptance Criteria**:
  * `[x]` Transaction Send: `insert message` + `atomic increment` unread + update `last_message_at` được gộp chặt trong 1 `$transaction`.
  * `[x]` **TOCTOU Test**: Viết test mô phỏng gửi tin, nhưng chèn xen ngang 1 event làm Match chuyển sang `UNMATCHED`. Đảm bảo verify ACTIVE nằm TRONG transaction và throw `MATCH_NOT_ACTIVE`, không sinh ra tin nhắn lọt lưới.
  * `[x]` Lấy lịch sử nhắn tin (`GET /messages`) sort đúng thứ tự bằng composite cursor.

## [x] TASK 5: Mark-Read Logic & Inbox Serving
* **Tiêu đề**: Hoàn thiện tính năng Inbox list và thuật toán Mark-read Race-safe.
* **Files Affected**:
  * `src/modules/chat/services/chat.service.ts`
  * `src/modules/chat/controllers/chat.controller.ts`
  * `test/chat.e2e-spec.ts`
* **Dependencies**: Task 4.
* **Acceptance Criteria**:
  * `[x]` API Inbox chỉ trả về các match có status `ACTIVE`.
  * `[x]` Logic Mark-read (UC-CHAT-004) lock row match bằng `FOR UPDATE`. Update dùng phép COUNT lại dựa trên pointer dịch tiến (`newest_id > last_read_message_id`).
  * `[x]` **Race Test**: E2E Test DETERMINISTIC — đọc read xong rồi send, assert message tồn tại trong DB, unreadCountA=1 sau send, mark-read lần nữa -> 0. Test có khả năng FAIL nếu code set unread=0 mù.

## [x] TASK 6: Update Documentation & Final Review
* **Tiêu đề**: Dọn dẹp tài liệu và đóng Phase.
* **Files Affected**:
  * `README.md`
  * `CLAUDE.md`
  * `spec/global/known-gaps.md`
* **Dependencies**: Task 5.
* **Acceptance Criteria**:
  * `[x]` Cập nhật file `spec/global/known-gaps.md` bằng cách xóa cảnh báo liên quan đến việc sử dụng mock `MatchRepository`.
  * `[x]` Cập nhật bảng "KNOWN IMPLEMENTATION STATE" trong `CLAUDE.md` (xác nhận Chat và Match đều Postgres-backed).
  * `[x]` Bảng Feature Checklist trong `README.md` đánh dấu hoàn thành cho Chat Persistence.
  * `[x]` Verify toàn bộ Definition of Done của Phase Pass 100%.
