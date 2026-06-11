# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial match module spec | Toàn bộ file |

---

# Match Module

## Goal
Quản lý match lifecycle: tạo match từ mutual like (idempotent), liệt kê matches, xem match profile, unmatch.

## Responsibilities
- Tạo match khi có mutual like (triggered từ swipe hoặc event).
- Đảm bảo match creation idempotent.
- Liệt kê active matches của user.
- Xem limited profile của matched user (privacy-aware).
- Unmatch.
- Mark match conversation as read.
- Search matches theo tên.

## Out of Scope
- Swipe logic (→ `swipe` module — match là consumer).
- Chat persistence (→ `chat` module — match chỉ cấp permission).
- Rematch (Future Improvement - Sẽ reuse existing match record).
- Premium features.

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-08.

Key rules:
- Một cặp user chỉ có **một lifetime match record**.
- Rematch reuse existing match record.
- Match creation phải idempotent (nếu worker xử lý 2 lần → không duplicate).
- DB đã có unique(user_a_id, user_b_id).
- DB đã có check constraint user_a_id < user_b_id.
- DB-level idempotency constraint đã sẵn sàng.
- Unmatch: data không bị hard delete, chỉ soft-inactive.
- `hasActiveMatch` vs `hasEverMatched` phải phân biệt rõ.

## Privacy / Security Notes
- `GET /api/matches/:matchId/profile` chỉ trả limited profile (no DOB, no exact location).
- User chỉ access match của chính mình — phải verify participant.
- Match profile KHÔNG giống như unrestricted profile lookup.

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/matches | User | Danh sách active matches |
| GET | /api/matches/:matchId | User | Chi tiết một match |
| GET | /api/matches/:matchId/profile | User | Profile của matched user (limited) |
| POST | /api/matches/:matchId/unmatch | User | Unmatch |
| PATCH | /api/matches/:matchId/read | User | Mark as read |
| GET | /api/matches/search?name=... | User | Tìm kiếm match theo tên |

**Internal (not user-facing):**
- `createMatch(userIdA, userIdB)` — called by swipe service hoặc event worker.

## Data Model Requirements
*(Concept only)*

**Match entity (`matches`):**
- `id` (UUIDv7)
- `user_a_id` (FK → User)
- `user_b_id` (FK → User)
- `status` (enum: active, unmatched, blocked)
- `matched_at` (datetime)
- `unmatched_at` (datetime, nullable)
- `unmatched_by_user_id` (FK → User, nullable)
- `blocked_by_user_id` (FK → User, nullable)
- `last_message_at` (datetime, nullable)
- `last_interaction_at` (datetime, nullable)
- `unread_count_a` (integer)
- `unread_count_b` (integer)
- `last_read_message_id_a` (FK → Message, nullable)
- `last_read_message_id_b` (FK → Message, nullable)
- `created_from_swipe_event_id` (FK → SwipeEvent)
- `created_at`
- `updated_at`

**Constraint:** DB đã có `UNIQUE(user_a_id, user_b_id)` và `CHECK(user_a_id < user_b_id)`.

## Events
*(Target)*

| Event | Trigger | Consumer |
|---|---|---|
| `MATCH_CREATED` | Match created | Notification, Realtime |
| `MATCH_UNMATCHED` | User unmatch | Chat (disable), Notification (suppress) |

## Logging / Audit
- `MATCH.CREATED` — log matchId, userIdA, userIdB.
- `MATCH.UNMATCHED` — log matchId, initiatorId.

## Testing Notes
- Unit: match creation idempotency.
- Integration: mutual like → match created. Second call with same pair → existing match returned, not duplicate.
- Privacy: match profile response must not expose DOB or exact location.
- Integration: unmatch → chat disabled.

## Known Implementation Gaps
- **GAP-01:** In-memory repositories.
- Runtime worker/service chưa implement idempotent match processor.
- Race condition protection cho match creation cần verify ở runtime.

## Open Questions
- Rematch sau unmatch: có scope không? Mutual consent hay auto? (xem OQ: Rematch rule)
- Khi 2 swipes arrive simultaneously, transaction isolation level nào cần?
