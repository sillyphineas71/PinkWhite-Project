# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial swipe module spec | Toàn bộ file |

---

# Swipe Module

## Goal
Xử lý swipe actions (like/pass/super like) — hành động cốt lõi của dating app. Quản lý swipe quota và kiểm tra mutual like để trigger match creation.

## Responsibilities
- Like / Pass / Super Like một user.
- Validate swipe eligibility (requester + target).
- Enforce like quota và super like quota.
- Swipe idempotency handling.
- Rewind last swipe (condition-based).
- Check mutual like sau khi swipe.
- Trigger match creation khi có mutual like.
- "Who liked me" (limited visibility — count + blurred for free users).

## Out of Scope
- Match persistence (→ `match` module — swipe chỉ trigger).
- Discovery feed generation (→ `discovery` module).
- Chat (→ `chat` module).
- Premium subscription management (Out of Scope).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-07.

Key rules:
- Không được swipe chính mình.
- Requester phải `active` + `onboarded`.
- Target phải eligible (xem BR-06-01).
- Swipe idempotency: Database đã có `swipe_states` upsert.
- Like quota: Tính theo rolling 24h.
- Super like có quota riêng nhỏ hơn.
- Rewind chỉ áp dụng cho lượt swipe cuối cùng và bắt buộc đó phải là PASS.
- Target architecture: swipe → insert `swipe_events` + upsert `swipe_states` + insert `outbox_events` → worker xử lý match.

## Privacy / Security Notes
- "Who liked me" free tier: chỉ count + blurred, không trả userId/real photo.
- Response khi target not eligible phải generic (không tiết lộ tại sao bị filter).

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/swipes/like | User (onboarded) | Like một user |
| POST | /api/swipes/pass | User (onboarded) | Pass một user |
| POST | /api/swipes/super-like | User (onboarded) | Super Like |
| DELETE | /api/swipes/last | User (onboarded) | Rewind last swipe |
| GET | /api/swipes/quota | User | Remaining likes + super likes |
| GET | /api/swipes/who-liked-me | User | Who liked me (free: count + blurred) |

## Data Model Requirements
*(Concept only)*

**Swipe State (`swipe_states` - current state):**
- `user_id`
- `target_id`
- `action` (LIKE, PASS, SUPER_LIKE)
- `created_at`
- `updated_at`

**Swipe Event (`swipe_events` - append-only log):**
- `id` (UUIDv7)
- `user_id`
- `target_id`
- `action`
- `created_at`

**LikeQuota entity (nếu cần separate tracking):**
- `userId`
- `periodStart` (datetime)
- `likesUsed` (integer)
- `superLikesUsed` (integer)

## Events
*(Target architecture)*

| Event | Trigger | Consumer |
|---|---|---|
| `SWIPE_CREATED` | Any swipe | Match processor |

## Logging / Audit
- Log swipeType, requesterId, targetId (không log target profile data).
- Log match result (matched: true/false, matchId nếu có).

## Testing Notes
- Unit: swipe eligibility validation, quota check, idempotency.
- Integration: like + mutual like → match created. Duplicate swipe handling.
- Privacy: who-liked-me response must not expose userId/photo for free users.

## Known Implementation Gaps
- **GAP-01:** In-memory repositories đang không tách `swipe_events` và `swipe_states`.
- **GAP-16:** Target eligibility check không verify block filter.

## Open Questions
- Pass recycle: Recycle tự động ở query discovery sau 30 ngày (schema support).
- Super Like quota free tier là bao nhiêu? (xem OQ-01-02)
