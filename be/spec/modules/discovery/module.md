# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial discovery module spec | Toàn bộ file |

---

# Discovery Module

## Goal
Generate discovery feed — danh sách candidates phù hợp để user swipe. Áp dụng tất cả eligibility filters, privacy rules và preference filtering.

## Responsibilities
- CRUD discovery preferences (age range, gender, max distance).
- Generate discovery feed với full eligibility filtering.
- Tính khoảng cách giữa requester và candidates (Sử dụng PostGIS).
- Mask sensitive data trong response (không trả DOB, không trả exact location).
- Exclude ineligible candidates (banned, hidden, not onboarded, etc.).
- Exclude blocked users (cả 2 chiều).
- Exclude already-swiped users.
- Paginate feed (cursor-based preferred).

## Out of Scope
- Swipe action (→ `swipe` module).
- Profile mutation (→ `profile` module).
- Advanced filters / Premium filtering (Future Improvement).
- AI/ML ranking (Future Improvement).
- Passport / fake location (Schema hỗ trợ `active_location_mode = passport`, nhưng runtime feature implement ở phase sau).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-06.

Discovery eligibility filter (TẤT CẢ phải thỏa):
1. `target.accountActive`
2. `target.isOnboarded`
3. `target.isEmailVerified`
4. `!target.isHidden`
5. `target.hasApprovedPhoto`
6. `target.hasActiveLocation`
7. `!block(requester → target)`
8. `!block(target → requester)`
9. `!alreadySwiped(requester → target)` (trừ recycle rule nếu có)
10. `target fits requester's preferences` (age, gender, distance)
11. `target != requester`

## Privacy / Security Notes
- Response KHÔNG được chứa `dob` — chỉ trả `age`.
- Response KHÔNG được chứa `latitude` / `longitude` — chỉ trả `distanceLabel` hoặc `distanceKm` (rounded).
- Response KHÔNG nên expose `userId` trực tiếp nếu có risk enumeration (Open Question — xem OQ-02-07).
- User phải `onboarded` mới được nhận feed.

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/discovery/feed | User (onboarded) | Lấy discovery feed |
| GET | /api/discovery/preferences | User | Xem preferences |
| POST | /api/discovery/preferences | User | Tạo preferences (lần đầu) |
| PUT | /api/discovery/preferences | User | Cập nhật preferences |

## Data Model Requirements
*(Concept only)*

**Preference entity (`discovery_preferences`):**
- `id` (UUIDv7)
- `user_id` (FK → User, unique)
- `min_age` (integer, default 18)
- `max_age` (integer, default 100)
- `preferred_genders` (array of enum: male, female, non_binary, other)
- `max_distance_km` (integer, default 50)
- `created_at`, `updated_at`

**User Location entity (`user_locations`):**
- `id` (UUIDv7)
- `user_id` (FK → User, unique)
- `real_location` (geography(Point,4326))
- `passport_location` (geography(Point,4326), nullable)
- `active_location_mode` (enum: real, passport)
- `updated_at`

## Events
*(None for discovery — discovery is read-only)*

## Logging / Audit
- Feed request: log userId, result count (không log individual candidates).

## Testing Notes
- Integration: feed MUST NOT return banned/hidden/unverified/not-onboarded users.
- Integration: feed MUST NOT return users that requester blocked.
- Integration: feed MUST NOT return users that blocked requester.
- Privacy: response must have `age` not `dob`, must have `distanceLabel` not `lat/lng`.

## Known Implementation Gaps
- **GAP-01:** In-memory repositories.
- **GAP-16:** Block filter không được apply (safety module chưa tồn tại).
- Distance calculation cần verify (PostGIS `ST_DWithin` và `ST_Distance`).
- Mutual preference filtering chưa có.

## Open Questions
- Mutual preference filtering: cần không? (xem OQ-01-05)
- Ranking algorithm: random hay có scoring? (xem OQ-01-07)
- UserId exposure: expose trực tiếp hay dùng opaque handle? (xem OQ-02-07)
- Default preferences nếu user chưa set?
