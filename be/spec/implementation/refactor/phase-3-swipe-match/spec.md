# Phase 3 Swipe + Match Spec

## 1. Goal
Define the business rules, data model interactions, and technical semantics for the core swipe and match functionality (Phase 3). Establish the precise boundaries for swiping candidates, capturing the intent (PASS, LIKE, SUPER_LIKE), and atomically materializing reciprocal matches while ensuring robust error handling and strict data privacy.

## 2. In Scope
- Core user swipe actions (`PASS`, `LIKE`, `SUPER_LIKE`).
- API specifications for `POST /swipes`.
- Validation of requester eligibility (account status, onboarding, location readiness, visibility).
- Validation of target eligibility (profile validity, active status, block exclusions, photo validation).
- Management of `swipe_events` (immutable append-only history).
- Management of `swipe_states` (upserting current mutual direction intent).
- Match creation (`matches` table) triggered by reciprocal positive intents (`LIKE` or `SUPER_LIKE`).
- Definition of transaction bounds and concurrency guards.

## 3. Out of Scope
- **Discovery feed query logic** (already built in Phase 2).
- **Chat/message sending** (handled in future messaging phase).
- **Notification delivery** (e.g., Push/WebSocket).
- **Payment, premium entitlements, and SUPER_LIKE quotas** (except asserting SUPER_LIKE acts as a positive match trigger; quota/paywall constraints are deferred).
- **Boost**.
- **Passport/travel location behaviors**.
- **Admin moderation interfaces**.
- **Report handling beyond existing block logic**.
- **New Prisma schema additions or migrations**.
- **Frontend integration**.
- **Advanced recommendation/ML ranking**.
- **POST /swipes/rewind** (Rewind is not implemented in Phase 3. Rewind is deferred work. When implemented, only the latest PASS can be rewound. LIKE/SUPER_LIKE rewinding remains out of scope).
- **Match Reactivation** (UNMATCHED rematch behavior is deferred).
- **Quotas and Entitlements** (SUPER_LIKE limits and daily quotas are deferred).

## 4. Actors
- **Requester (Swiper):** The active user submitting the `POST /swipes` request.
- **Target (Candidate):** The user being evaluated and targeted by the swipe action.

## 5. API Contract

### 5.1 POST /swipes
**Request:**
```json
{
  "targetUserId": "uuid",
  "action": "PASS | LIKE | SUPER_LIKE"
}
```

**Response:**
```json
{
  "action": "LIKE",
  "targetUserId": "uuid",
  "matched": true,
  "matchId": "uuid | null"
}
```



## 6. Requester Eligibility Rules
The requester can only perform a swipe if ALL of the following hold true:
- `account_status = 'ACTIVE'`
- `deleted_at` is null.
- `email_verified_at` is not null.
- `onboarding_status = 'COMPLETED'`
- Has initialized `user_privacy_settings`.
- `user_privacy_settings.is_hidden = false`.
- Has an active real location (`active_location_mode = 'REAL'` and `real_location` is present).
- Has defined `discovery_preferences`.

If ineligible, the system returns a mapped domain error (e.g. `ACCOUNT_NOT_ACTIVE`, `ONBOARDING_INCOMPLETE`, `LOCATION_REQUIRED`).

## 7. Target Eligibility Rules
The target can only be swiped if ALL of the following hold true:
- User exists in the database.
- Target is not the requester (No self-swiping).
- Target `account_status = 'ACTIVE'` and `deleted_at` is null.
- Target `email_verified_at` is not null and `onboarding_status = 'COMPLETED'`.
- Target has `user_privacy_settings` and `is_hidden = false`.
- Target possesses a valid Profile record.
- Target possesses at least one approved, confirmed, non-deleted public photo with a valid `publicUrl`.
- Target has not blocked the requester.
- Requester has not blocked the target.
- No existing match record exists between the requester and target in Phase 3. Existing `ACTIVE` match returns `ALREADY_MATCHED`. Existing non-active match returns `TARGET_NOT_AVAILABLE` or `MATCH_NOT_AVAILABLE` because rematch/reactivation is deferred.

*(Decision: Swipe does not rerun expensive PostGIS/distance/preference discovery query. Swipe revalidates core safety only: active/not deleted/not banned, email verified, onboarding completed, not hidden, has valid profile, has at least one approved confirmed public photo, no block either direction, and no active match).*

## 8. Swipe Action Semantics

### 8.1 PASS
- Creates a new immutable row in `swipe_events` with `action = PASS`.
- Upserts the row in `swipe_states` for the `(requester -> target)` pair setting `current_action = PASS`.
- The target can reappear in the requester's discovery feed only after the recycle window expires (30 days logic defined in Phase 2).
- Does **not** trigger any match evaluation.

### 8.2 LIKE
- Creates a new immutable row in `swipe_events` with `action = LIKE`.
- Upserts the row in `swipe_states` for the `(requester -> target)` pair setting `current_action = LIKE`.
- Evaluates if the target has an existing reciprocal positive `swipe_states` record (`LIKE` or `SUPER_LIKE`) toward the requester.
- If reciprocal intent exists, triggers match creation.

### 8.3 SUPER_LIKE
- Creates a new immutable row in `swipe_events` with `action = SUPER_LIKE`.
- Upserts the row in `swipe_states` for the `(requester -> target)` pair setting `current_action = SUPER_LIKE`.
- Evaluates if the target has an existing reciprocal positive `swipe_states` record (`LIKE` or `SUPER_LIKE`) toward the requester.
- If reciprocal intent exists, triggers match creation.

## 9. Swipe Events vs Swipe States

### 9.1 swipe_events
- **Purpose:** Immutable append-only audit trail and event history.
- **Behavior:** Append-only. Every non-idempotent swipe creates exactly one `swipe_event`. Revert/rewind metadata is deferred.

### 9.2 swipe_states
- **Purpose:** Current materialized intent for an ordered pair (`swiper_id` -> `target_user_id`).
- **Behavior:** Upserted based on the latest swipe event. Overrides any previous state.
- **Repeated Swipes:** If the requested swipe action exactly equals the `current_action` in `swipe_states`, the server treats the request as an **idempotent no-op**: it returns success, does not create a new `swipe_event`, does not update `swipe_state`, and does not update `last_swiped_at`.
- **Action Changes:** If the current `swipe_state` differs from the requested action (e.g. `PASS` -> `LIKE`, `PASS` -> `SUPER_LIKE`), the change is allowed if no `ACTIVE` match exists. The system creates a new `swipe_event`, updates the `swipe_state` to the new action, and updates `last_swiped_at`. (Note: `LIKE`/`SUPER_LIKE` -> `PASS` allowed only if no active match exists).

## 10. Match Creation Rules
A new match is inserted only when reciprocal positive swipe exists AND no existing match record exists for the unordered pair:
1. The requester executes a `LIKE` or `SUPER_LIKE`.
2. The target currently holds a `swipe_states` action of `LIKE` or `SUPER_LIKE` pointing back at the requester.
3. Neither user has blocked the other.
4. Neither user is deleted, banned, or hidden.

**Rules:**
- A match is an unordered pair stored in ordered columns: `user_a_id = min(requesterId, targetUserId)` and `user_b_id = max(requesterId, targetUserId)`. This guarantees the DB unique constraint on `(user_a_id, user_b_id)`.
- If an `ACTIVE` match already exists between requester and target: reject with `ALREADY_MATCHED`, do not create `swipe_event`, do not update `swipe_state`, and do not create duplicate match. Do not return 200 matched true for this case in Phase 3.
- If a non-active match record exists (such as `UNMATCHED`/`BLOCKED`): reject with `TARGET_NOT_AVAILABLE` or `MATCH_NOT_AVAILABLE`, do not create `swipe_event`, do not update `swipe_state`, do not reactivate old match, and do not insert duplicate match.

## 11. Transaction and Concurrency Requirements
Swiping is a high-concurrency action requiring strict transactional safety (`$transaction`).
1. Lock or validate the current pair state to prevent race conditions.
2. Verify Target and Requester eligibility (Blocks, Active status).
3. Insert `swipe_events` (if non-idempotent).
4. Upsert `swipe_states`.
5. Check reciprocal `swipe_states`.
6. Insert a new match if positive reciprocity exists and no existing match record exists.
- Do not update/reactivate existing non-active match records in Phase 3.
- The `matches` table enforces a unique constraint `uq_matches_user_pair` on `(user_a_id, user_b_id)`.
- The transaction must catch `UniqueConstraintViolation` gracefully if two users match each other at the exact same millisecond, returning the already-created match safely.

## 12. Block / Deleted / Hidden Rules
- If either the requester or target is blocked, deleted, or hidden at the time of the swipe request, the request is actively rejected.
- **Error Obfuscation:** To prevent exposing the target's hidden/blocked status, the server returns a generic `SWIPE_NOT_ALLOWED` or `TARGET_NOT_AVAILABLE` error without revealing the exact constraint.

## 13. Quota / Rate Limit Rules
- Deferred. No SUPER_LIKE entitlement/quota enforcement in Phase 3.

## 14. Response Contract
The response guarantees strict privacy by returning a minimalistic payload:
- Target's `userId`.
- The `action` processed.
- A `matched` boolean flag.
- The `matchId` if a new match was successfully created.
- **Forbidden:** No emails, DOBs, raw geographic coordinates, block reasons, or internal states are returned.

## 15. Error Handling
The API must return standardized HTTP 400/403 Exceptions including:
- `INVALID_SWIPE_ACTION`: Malformed payload action.
- `SWIPE_NOT_ALLOWED`: Requester is not eligible to swipe (unverified, hidden, incomplete).
- `TARGET_NOT_AVAILABLE`: Target is deleted, banned, hidden, or lacks safe photos.
- `SELF_SWIPE_NOT_ALLOWED`: Target ID equals Requester ID.
- `ALREADY_MATCHED`: A match currently exists and is active.

## 16. Security and Privacy Requirements
- Enforce strict Auth JWT token validation.
- Validate that the user extracting the swipe token is identically the `swiper_id`.
- Maintain strict obfuscation on Target state exclusions (do not leak that the target blocked the swiper vs the target deleted their app).

## 17. Acceptance Criteria
- `PASS` creates a state and event, but never creates a match.
- `LIKE` and `SUPER_LIKE` create states and events.
- Reciprocal `LIKE` + `LIKE` or `LIKE` + `SUPER_LIKE` executes match creation.
- Pre-existing `ACTIVE` matches block duplicate match insertions.
- Identical repeated swipe is idempotent no-op.
- Identical repeated swipe does not create `swipe_event`.
- Identical repeated swipe does not update `last_swiped_at`.
- `PASS` -> `LIKE` creates a new event and updates state.
- If any existing match record exists, Phase 3 does not create a new match.
- Existing `ACTIVE` match returns `ALREADY_MATCHED`.
- Existing non-active match is not reactivated in Phase 3.
- Existing non-active match does not create `swipe_event` or update `swipe_state`.
- Match pair is always ordered as `user_a_id < user_b_id`.
- Self-swiping is hard-rejected.
- Hidden, blocked, and inactive targets are rejected seamlessly.
- Matches are transacted securely enforcing unique constraints without crashing the backend on race conditions.
- Output JSON guarantees zero sensitive field leakage.

## 18. Risks
- **Concurrency & Deadlocks:** Swiping transactions modifying multiple tables (`swipe_events`, `swipe_states`, `matches`) simultaneously could trigger DB deadlocks under high load. Lexicographical locking ordering of user IDs might be required.

## 19. Open Questions
*(None for Phase 3A - all ambiguous behavior moved to Deferred Work)*
