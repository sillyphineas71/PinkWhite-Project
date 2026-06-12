# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-12 | Patched transaction boundary, target eligibility, schema-field usage, match delegation API, and outbox scope after human review | Sections 5, 9, 10, 12, 14, 20, 21 |
| 2026-06-12 | Patched transaction boundary, eligibility scope, schema mapping, batch breakdown, and response mapping after human plan review | Sections 5, 9, 10, 12, 17, 19 |
| 2026-06-12 | Initial Phase 3 Swipe + Match implementation plan created from approved spec | All sections |

---

# Phase 3 Swipe + Match Plan

## 1. Overview
This plan details the implementation strategy for Phase 3: Swipe and Match logic. It strictly adheres to global module boundaries where `swipe` orchestrates the swipe events and states, and `match` owns the match lifecycle creation. A strict transaction boundary manages the complex state transitions during concurrent swipes to prevent data corruption and enforce pair unicity.

## 2. Compliance With Global Rules
- CLAUDE.md read: Yes
- AGENTS.md read: Yes
- spec/global read: Yes
- Module boundary checked: Yes
- Changelog rule applied to plan.md: Yes
- Code changes made: No
- Prisma schema changes made: No
- Migration changes made: No
- Package changes made: No

Missing Docs / Compliance Notes: None. All required files were verified.

## 3. Source of Truth
1. Latest direct user instruction in the prompt
2. Approved Phase 3 spec (`spec/implementation/refactor/phase-3-swipe-match/spec.md`)
3. Approved database/schema decisions (`prisma/schema.prisma`)
4. Global rules (`spec/global/*`)
5. Module definitions (`spec/modules/swipe`, `spec/modules/match`)

## 4. Confirmed Decisions
- Phase 3 implements `POST /swipes` only.
- `POST /swipes/rewind` is deferred.
- `swipe_events` are append-only. Every non-idempotent swipe creates exactly one `swipe_event`.
- Identical repeated swipe is an idempotent no-op: no new event, no state update, no `last_swiped_at` update.
- Action change is allowed only if no existing match record exists.
- If ANY match record already exists:
  - `ACTIVE` -> `ALREADY_MATCHED`
  - non-active -> `TARGET_NOT_AVAILABLE`
  - Do not create `swipe_event`
  - Do not update `swipe_state`
  - Do not reactivate / insert duplicate match
- Match creation only inserts a new match when no match record exists.
- Match pair must always be ordered:
  - `user_a_id = min(requesterId, targetUserId)`
  - `user_b_id = max(requesterId, targetUserId)`
- Quotas and `SUPER_LIKE` entitlement checks are deferred.
- Full discovery PostGIS/distance/preference query is not rerun during swipe.
- Non-active existing match must use `TARGET_NOT_AVAILABLE`. Do not introduce `MATCH_NOT_AVAILABLE`.

## 5. Existing Schema Mapping
The implementation must use these exact Prisma model and field names to avoid guessing:
- **User** (`users`):
  - `id` -> `id`
  - `accountStatus` -> `account_status`
  - `onboardingStatus` -> `onboarding_status`
  - `deletedAt` -> `deleted_at`
  - `emailVerifiedAt` -> `email_verified_at`

- **ProfilePhoto** (`profile_photos`):
  - `publicUrl` -> `public_url`
  - `deletedAt` -> `deleted_at`
  - `uploadStatus` -> `upload_status`
  - `moderationStatus` -> `moderation_status`

- **UserLocation** (`user_locations`):
  - `activeLocationMode` -> `active_location_mode`
  - `realLocation` -> `real_location`

- **SwipeEvent** (`swipe_events`):
  - `id` -> `id`
  - `swiperId` -> `swiper_id`
  - `targetUserId` -> `target_user_id`
  - `action` -> `action`
  - `status` -> `status`
  - `createdAt` -> `created_at`

- **SwipeState** (`swipe_states`):
  - `swiperId` -> `swiper_id`
  - `targetUserId` -> `target_user_id`
  - `currentAction` -> `current_action`
  - `lastSwipedAt` -> `last_swiped_at`
  - `lastSwipeEventId` -> `last_swipe_event_id`

- **Match** (`matches`):
  - `id` -> `id`
  - `userAId` -> `user_a_id`
  - `userBId` -> `user_b_id`
  - `status` -> `status`
  - `matchedAt` -> `matched_at`
  - `createdAt` -> `created_at`

- **UserBlock** (`user_blocks`):
  - `id` -> `id`
  - `blockerId` -> `blocker_id`
  - `blockedUserId` -> `blocked_user_id`
  - `status` -> `status`

## 6. Module Boundary Plan
- **Swipe Module (`src/modules/swipe`)**: Owns `POST /swipes` handling, payload validation, `swipe_events` insertion, `swipe_states` upsertion, idempotency tracking, and eligibility validation.
- **Match Module (`src/modules/match`)**: Owns Match lifecycle. Exposes a creation service (`MatchCreationService`) that the `SwipeService` can invoke. The Match module securely manages the `matches` table insertion.

## 7. Module/File Plan
**Swipe-Owned Files:**
- `src/modules/swipe/swipe.module.ts`: Wires controllers and services. Imports `MatchModule`.
- `src/modules/swipe/controllers/swipe.controller.ts`: Defines `POST /swipes`.
- `src/modules/swipe/services/swipe.service.ts`: Orchestrates eligibility, transaction boundaries, and state mutations.
- `src/modules/swipe/dto/create-swipe.dto.ts`: Payload validation (`targetUserId`, `action`).
- `src/modules/swipe/dto/swipe-response.dto.ts`: Response formatting.
- `src/modules/swipe/repositories/swipe-write.repository.ts`: Handles Prisma transactional updates for events and states.
- `src/modules/swipe/repositories/swipe-read.repository.ts`: Handles state reads and eligibility queries.
- `src/modules/swipe/swipe.types.ts`: Local interfaces.
- `src/modules/swipe/services/swipe.service.spec.ts`: Unit tests.

**Match-Owned Files:**
- `src/modules/match/match.module.ts`: Exports `MatchCreationService`.
- `src/modules/match/services/match-creation.service.ts`: Dedicated logic for match instantiation.
- `src/modules/match/repositories/match-write.repository.ts`: Manages `matches` table persistence.
- `src/modules/match/match.types.ts`: Match DTOs/interfaces.
- `src/modules/match/services/match-creation.service.spec.ts`: Unit tests.

## 8. API/DTO Plan
**POST /swipes**
`CreateSwipeDto`:
```typescript
@IsUUID() targetUserId: string;
@IsEnum(SwipeAction) action: SwipeAction;
```
`SwipeResponseDto`:
```typescript
action: string;
targetUserId: string;
matched: boolean;
matchId: string | null;
```

## 9. Service Flow
`POST /swipes` uses one Prisma transaction.
Inside the transaction:
1. Reject self swipe if not already rejected by cheap precheck.
2. Validate requester eligibility.
3. Validate target eligibility.
4. Normalize pair `user_a_id` / `user_b_id`.
5. Check any existing match record.
   - `ACTIVE` -> `ALREADY_MATCHED`
   - non-active -> `TARGET_NOT_AVAILABLE`
6. Check current `swipe_state`.
7. If identical action: return idempotent no-op.
8. Insert `swipe_event` for non-idempotent action.
9. Upsert `swipe_state`.
10. For `PASS`: return matched false.
11. For `LIKE`/`SUPER_LIKE`: check reciprocal positive `swipe_state`.
12. If reciprocal positive: delegate match creation to match-owned service/repository inside the same transaction.

Important:
Existing match check must happen inside the transaction.
Idempotency check must happen inside the transaction.
Swipe event/state writes must happen inside the transaction.
Match creation must happen inside the same transaction.
No `swipe_event` or `swipe_state` update may happen before the existing match record check.

## 10. Transaction Boundary
The `SwipeService` will utilize the `PrismaService.$transaction` scope. The `MatchCreationService.createMatch` method will accept a `Prisma.TransactionClient` to ensure the match creation and swipe mutations are safely committed atomically. 

## 11. Repository Plan
- `SwipeReadRepository.validateEligibility`: Uses `findUnique` and `findFirst` to enforce strict target/requester prerequisites.
- `SwipeWriteRepository.upsertSwipeState`: Manages `swipe_states` inside `$transaction`.
- `SwipeWriteRepository.insertSwipeEvent`: Manages `swipe_events` inside `$transaction`.
- `MatchWriteRepository.insertNewMatch`: Enforces `user_a_id < user_b_id` via unique indexing handling.

## 12. Eligibility Validation Plan
**Requester**:
- `accountStatus` === `ACTIVE`
- `deletedAt` === `null`
- `emailVerifiedAt` !== `null`
- `onboardingStatus` === `COMPLETED`
- privacy row exists
- `isHidden` === `false`
- active real location exists:
  `activeLocationMode` === `REAL`
  `realLocation` !== `null`
- `discoveryPreferences` exists

**Target**:
- target exists
- target != requester
- `accountStatus` === `ACTIVE`
- `deletedAt` === `null`
- `emailVerifiedAt` !== `null`
- `onboardingStatus` === `COMPLETED`
- privacy row exists
- `isHidden` === `false`
- profile exists and required profile fields exist
- at least one approved confirmed non-deleted public photo with non-empty `publicUrl`/`public_url`
- no block either direction
- no existing match record

Target eligibility must NOT require in Phase 3:
- active real location
- `realLocation` not null
- `discoveryPreferences`
- distance filter
- `ST_DWithin`
- `ST_Distance`
- requester preference overlap

## 13. Swipe Event/State Plan
- Fetch `swipe_states` (`swiperId`, `targetUserId`).
- If `currentAction === requestedAction`: Return early (Idempotent 200 OK).
- If changed: Insert new `swipe_event`.
- Upsert `swipe_states` with new action, mapped `lastSwipeEventId`, and `lastSwipedAt: now()`.

## 14. Match Creation Delegation Plan
- `SwipeService` identifies positive reciprocity.
- Invokes `MatchCreationService.createMatchPair(tx, { requesterId, targetUserId, occurredAt: now })`.
- The `MatchCreationService` sorts `requesterId` and `targetUserId` lexicographically to map to `user_a_id` and `user_b_id`.
- The service verifies no existing match record inside transaction or relies on caller check plus unique constraint.
- Inserts `Match` with `status: ACTIVE` and `matchedAt: now()` (and `createdAt: now()`).

## 15. Concurrency Plan
- The database enforces `@@unique([userAId, userBId])`.
- If two users swipe each other at the exact same millisecond, the `$transaction` will experience a `Prisma.PrismaClientKnownRequestError` (`P2002`).
- The repository intercepts `P2002` on `uq_matches_user_pair`, queries the newly created match, and safely returns it to fulfill the reciprocal match criteria without throwing a 500 error.

## 16. Error Handling Plan
- **Target == Requester**: HTTP 400 `SELF_SWIPE_NOT_ALLOWED`
- **Invalid Action**: HTTP 400 `INVALID_SWIPE_ACTION`
- **Requester fails eligibility**: HTTP 403 `SWIPE_NOT_ALLOWED`
- **Target blocked, hidden, banned, deleted, or lacks photos**: HTTP 404 `TARGET_NOT_AVAILABLE`
- **Target already has ACTIVE match**: HTTP 400 `ALREADY_MATCHED`
- **Target has NON-ACTIVE match**: HTTP 404 `TARGET_NOT_AVAILABLE`

## 17. Response Mapping Plan
- The controller formats domain structures into minimalistic JSON.
- `matchId` is only populated when `matched` is true and a new match was created.
- The response must explicitly allow only `targetUserId`, `action`, `matched`, and `matchId`.
- Absolutely no database internals or sensitive target metrics will be returned.

## 18. Test Plan
Unit tests using mocked Prisma Clients spanning:
- Rejection of invalid payload properties (DTO validation).
- Rejection of self-swiping.
- Hard failures for ineligible requesters (hidden, banned, missing location).
- requester still requires active real location and discovery preferences.
- target does not require active real location in Phase 3.
- target does not require discovery preferences in Phase 3.
- DB validations happen inside transaction.
- existing match check happens before event/state writes inside transaction.
- no outbox write is planned.
- Safe obfuscation (`TARGET_NOT_AVAILABLE`) for targets that are blocked/hidden/non-active match.
- Prevention of duplicate event generation via idempotency verification.
- Proper transaction chaining for `PASS` -> `LIKE` state mutation.
- Lexicographical sorting assurance on Match pair generation.
- Graceful recovery on `P2002` match concurrency conflict.
- Separation of concerns verified (Swipe module correctly delegates to Match module).

## 19. Batch Breakdown
**Batch 3B — DTOs, Module Boundary Skeleton, Error Categories**
- Allowed files: DTOs, module files, custom exceptions.
- Forbidden files: Controllers, services, repositories.
- Exit criteria: DTOs validate correctly, errors mapped.
- Commands: `npm run build`
- Report file: `BATCH_3B_REPORT.md`

**Batch 3C — Swipe Repositories + Match-Owned Creation Skeleton**
- Allowed files: Swipe Read/Write repos, Match Write repo, Match Creation service interface.
- Forbidden files: Swipe service logic, controllers.
- Exit criteria: Repositories export correct transaction-ready methods.
- Commands: `npm run build`
- Report file: `BATCH_3C_REPORT.md`

**Batch 3D — Transaction Service Flow + Eligibility Validation**
- Allowed files: `swipe.service.ts`
- Forbidden files: Match module logic.
- Exit criteria: Eligibility is validated inside `$transaction` effectively stopping invalid flows.
- Commands: `npm run build`
- Report file: `BATCH_3D_REPORT.md`

**Batch 3E — Swipe Event/State Idempotency Semantics**
- Allowed files: `swipe.service.ts`
- Forbidden files: Match module logic.
- Exit criteria: Idempotent identical swipes are true no-ops, events saved appropriately.
- Commands: `npm run build`
- Report file: `BATCH_3E_REPORT.md`

**Batch 3F — Reciprocal Positive + Match Creation Delegation**
- Allowed files: `swipe.service.ts`, `match-creation.service.ts`
- Forbidden files: None in scope.
- Exit criteria: Match creation correctly delegated, unique constraints handled safely.
- Commands: `npm run build`
- Report file: `BATCH_3F_REPORT.md`

**Batch 3G — Tests + Final Review**
- Allowed files: `*.spec.ts`
- Forbidden files: Production code changes.
- Exit criteria: All tests pass covering edge cases, 100% boundary compliance.
- Commands: `npm run test`
- Report file: `BATCH_3G_REPORT.md`

## 20. Risks, Gaps, and Mitigations
- **Risk**: Prisma `$transaction` timeouts under high swipe load.
  **Mitigation**: Keeping transaction boundaries tight, limited to only primary key operations.
- **Risk**: Missing `user_a_id < user_b_id` validation.
  **Mitigation**: Enforce lexicographical sorting dynamically in TypeScript before attempting Prisma insert.

## 21. Out of Scope
- `outbox_events`, notification events, push notifications, websocket events, and async match-created events are deferred.
- Do not plan any outbox write in Phase 3.
- Full Discovery / Distance querying.
- `POST /swipes/rewind` implementation.
- `UNMATCHED`/`BLOCKED` match reactivation.
- Chat/Messaging limits.
- SUPER_LIKE payment validation and daily quotas.
- Schema migrations.

## 22. Plan Acceptance Criteria
- File is fully readable, starts with a CHANGELOG.
- Correctly limits scope to Phase 3 requirements.
- Strictly adheres to the global rules provided in `CLAUDE.md` and `AGENTS.md`.
- Does not assign match lifecycle persistence to the Swipe module.
- Effectively outlines the transaction workflow protecting concurrency.
