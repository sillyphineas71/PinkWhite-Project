# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-12 | Initial Phase 3 Swipe + Match implementation tasks created from approved spec and plan | All sections |

---

# Phase 3 Swipe + Match Tasks

## 1. Overview
This document breaks down the implementation of Phase 3 Swipe and Match features into actionable, boundary-compliant tasks. It uses `POST /swipes` orchestrating through a single Prisma transaction, verifying strictly scoped eligibilities, handling idempotency, and securely delegating match creation to the match module.

## 2. Compliance With Global Rules
- CLAUDE.md read: Yes
- AGENTS.md read: Yes
- spec/global read: Yes
- Module boundary checked: Yes
- Missing Docs / Compliance Notes: None

## 3. Source of Truth
1. Latest direct user instruction in this prompt
2. Approved Phase 3 plan: `spec/implementation/refactor/phase-3-swipe-match/plan.md`
3. Approved Phase 3 spec: `spec/implementation/refactor/phase-3-swipe-match/spec.md`
4. CLAUDE.md / AGENTS.md
5. spec/global/*
6. spec/modules/*
7. prisma/schema.prisma
8. Current source code

## 4. Schema Verification Checklist
User:
- accountStatus: Present
- onboardingStatus: Present
- deletedAt: Present
- emailVerifiedAt: Present

Profile:
- userId: Present
- displayName: Present
- dob: Present
- gender: Present
- relationshipGoal: Present

ProfilePhoto:
- publicUrl: Present
- deletedAt: Present
- uploadStatus: Present
- moderationStatus: Present

UserPrivacySetting (Schema Model: UserPrivacySettings):
- userId: Present
- isHidden: Present

UserLocation:
- userId: Present
- activeLocationMode: Present
- realLocation: Present

DiscoveryPreference:
- userId: Present

SwipeEvent:
- id: Present
- swiperId: Present
- targetUserId: Present
- action: Present
- status: Present
- createdAt: Present

SwipeState:
- swiperId: Present
- targetUserId: Present
- currentAction: Present
- lastSwipedAt: Present
- lastSwipeEventId: Present

Match:
- id: Present
- userAId: Present
- userBId: Present
- status: Present
- matchedAt if exists: Present
- createdAt if exists: Present

UserBlock:
- blockerId: Present
- blockedUserId: Present
- status: Present

## 5. Approved Scope
Phase 3 implements only: `POST /swipes`

Phase 3 does NOT implement:
- POST /swipes/rewind
- quota / daily limit
- SUPER_LIKE entitlement
- payment, boost, passport/travel location
- discovery feed query
- PostGIS distance/preference validation during swipe
- chat, notifications, outbox_events
- match reactivation / rematch
- schema changes, migrations, frontend

## 6. Critical Business Rules
- `swipe_events` are append-only.
- Every non-idempotent swipe creates exactly one `swipe_event`.
- Identical repeated swipe is a true no-op: no `swipe_event` insert, no `swipe_state` update, no `last_swiped_at` update, no match creation.
- Action change is allowed only if no existing match record exists.
- If ANY match record already exists:
  - ACTIVE -> `ALREADY_MATCHED`
  - non-active -> `TARGET_NOT_AVAILABLE`
  - do not create `swipe_event`, `swipe_state`, do not reactivate, do not insert duplicate match.
- Match creation only inserts a new match when no match record exists.
- Match pair must always be ordered: `user_a_id = min(requesterId, targetUserId)`, `user_b_id = max(requesterId, targetUserId)`.
- Non-active existing match must use `TARGET_NOT_AVAILABLE`. Do not introduce `MATCH_NOT_AVAILABLE`.

## 7. Module Boundary Rules
Swipe module owns:
- POST /swipes controller, DTOs
- `swipe_events`, `swipe_states`
- idempotency, swipe orchestration

Match module owns:
- match lifecycle, match creation, match write repository
- match pair normalization, match unique conflict handling

Allowed orchestration:
- SwipeService may orchestrate the transaction.
- SwipeService may call MatchCreationService inside the same Prisma transaction.
- MatchCreationService and MatchWriteRepository must accept a Prisma transaction client.

Forbidden:
- Do not put permanent match lifecycle ownership inside swipe module.
- Do not create `src/modules/swipe/repositories/match-write.repository.ts`.
- Do not treat mock/in-memory match behavior as production truth.

## 8. Transaction Rules
`POST /swipes` executes DB-sensitive logic inside one Prisma transaction. Inside the transaction:
1. Reject self swipe if not already rejected by cheap precheck.
2. Validate requester eligibility.
3. Validate target eligibility.
4. Normalize match pair `userAId`/`userBId` according to DB order rule.
5. Check any existing match record.
   - ACTIVE -> `ALREADY_MATCHED`
   - non-active -> `TARGET_NOT_AVAILABLE`
6. Check current `swipe_state` requester -> target.
7. If identical action:
   - return idempotent no-op (no event insert, no state update, no `last_swiped_at` update, no match creation)
8. Insert `swipe_event`.
9. Upsert `swipe_state`.
10. If PASS: return matched false.
11. If LIKE/SUPER_LIKE: check reciprocal positive `swipe_state`.
12. If reciprocal positive: call `MatchCreationService` inside same transaction, insert new match only if no existing match record exists, handle unique conflict safely.

Important:
- Existing match check must happen before `swipe_event` insert and before `swipe_state` update.
- Idempotency check must happen inside transaction.
- Match creation must happen inside same transaction.
- No outbox write.

## 9. Eligibility Rules
**Requester eligibility:**
- `accountStatus` ACTIVE
- `deletedAt` null
- `emailVerifiedAt` not null
- `onboardingStatus` COMPLETED
- privacy row exists
- `isHidden` false
- active real location exists: `activeLocationMode` REAL, `realLocation` not null
- `discoveryPreferences` exists

**Target eligibility:**
- target exists
- target != requester
- `accountStatus` ACTIVE
- `deletedAt` null
- `emailVerifiedAt` not null
- `onboardingStatus` COMPLETED
- privacy row exists
- `isHidden` false
- profile exists and required profile fields exist
- at least one approved confirmed non-deleted public photo with non-empty publicUrl
- no block either direction
- no existing match record

Target eligibility must NOT require:
- active real location, `realLocation` not null
- `discoveryPreferences`
- distance filter, ST_DWithin, ST_Distance, requester preference overlap

## 10. Error Mapping
- invalid action -> `INVALID_SWIPE_ACTION`
- self swipe -> `SELF_SWIPE_NOT_ALLOWED`
- requester ineligible -> `SWIPE_NOT_ALLOWED`
- target unavailable -> `TARGET_NOT_AVAILABLE`
- block either direction -> `TARGET_NOT_AVAILABLE`
- active existing match -> `ALREADY_MATCHED`
- non-active existing match -> `TARGET_NOT_AVAILABLE`

Do not expose: target blocked requester, requester blocked target, target hidden, target deleted, target banned, target has non-active previous match.

## 11. Response Privacy Rules
Allowed response fields only: `targetUserId`, `action`, `matched`, `matchId`.
No sensitive fields: email, dob, raw location, latitude, longitude, block reason, target private status, reciprocal state details, swipe internals, moderation internals, storageKey.

## 12. Batch 3B — DTOs, Module Boundary Skeleton, Error Categories
**Status:** Completed.

Goal: Create module skeleton and DTOs only. No business logic yet.
Allowed files:
- `src/modules/swipe/swipe.module.ts`
- `src/modules/swipe/controllers/swipe.controller.ts`
- `src/modules/swipe/dto/create-swipe.dto.ts`
- `src/modules/swipe/dto/swipe-response.dto.ts`
- `src/modules/swipe/swipe.types.ts`
- `src/modules/match/match.module.ts`
- `src/modules/match/match.types.ts`
- `src/modules/swipe/**/*.spec.ts` if DTO tests are added

Forbidden files: `prisma/schema.prisma`, `prisma/migrations/`, `package.json`, `package-lock.json`, `src/modules/discovery/`, `src/modules/payment/`, `src/modules/chat/`
Exit criteria:
- DTO validates `targetUserId`/`action`.
- Controller route exists but may delegate to placeholder service only if needed for build.
- No DB writes. No match creation. No schema/package changes.
- `npm run build` passes.

## 13. Batch 3C — Swipe + Match Repositories Skeleton
**Status:** Completed.

Goal: Create transaction-ready repository methods without wiring full business flow.
Allowed files:
- `src/modules/swipe/repositories/swipe-read.repository.ts`
- `src/modules/swipe/repositories/swipe-write.repository.ts`
- `src/modules/match/repositories/match-write.repository.ts`
- `src/modules/match/services/match-creation.service.ts`
- `src/modules/swipe/swipe.module.ts`
- `src/modules/match/match.module.ts`

Required repository methods to task:
SwipeReadRepository:
- `findRequesterEligibility(tx, requesterId)`
- `findTargetEligibility(tx, targetUserId)`
- `findCurrentSwipeState(tx, requesterId, targetUserId)`
- `findReciprocalPositiveState(tx, requesterId, targetUserId)`
- `findBlockEitherDirection(tx, requesterId, targetUserId)`

SwipeWriteRepository:
- `createSwipeEvent(tx, requesterId, targetUserId, action, now)`
- `upsertSwipeState(tx, requesterId, targetUserId, action, swipeEventId, now)`

MatchWriteRepository:
- `normalizePair(userId1, userId2)`
- `findMatchByPair(tx, userId1, userId2)`
- `createActiveMatch(tx, userId1, userId2, now)`

Exit criteria:
- All repository methods accept Prisma transaction client where DB access is needed.
- Match write repository belongs to match module.
- No business orchestration yet.
- `npm run build` passes.

## 14. Batch 3D — Transaction Service Flow + Eligibility Validation
**Status:** Completed.

Goal: Implement SwipeService transaction shell and eligibility validation.
Allowed files:
- `src/modules/swipe/services/swipe.service.ts`
- `src/modules/swipe/controllers/swipe.controller.ts`
- `src/modules/swipe/repositories/swipe-read.repository.ts`
- `src/modules/swipe/swipe.types.ts`

Required behavior:
- `POST /swipes` calls SwipeService.
- SwipeService opens Prisma transaction.
- Inside transaction: self swipe check, requester eligibility, target eligibility, block check, existing match check before any event/state write.
- Existing ACTIVE match -> `ALREADY_MATCHED`.
- Existing non-active match -> `TARGET_NOT_AVAILABLE`.
- Ineligible requester -> `SWIPE_NOT_ALLOWED`.
- Unavailable target -> `TARGET_NOT_AVAILABLE`.

Exit criteria:
- No event/state write before existing match check.
- No match creation yet.
- `npm run build` passes.

## 15. Batch 3E — Swipe Event/State Idempotency Semantics
**Status:** Completed.

Goal: Implement identical repeated swipe as no-op, non-idempotent event insert, and state upsert.
Allowed files:
- `src/modules/swipe/services/swipe.service.ts`
- `src/modules/swipe/repositories/swipe-write.repository.ts`
- `src/modules/swipe/repositories/swipe-read.repository.ts`
- `src/modules/swipe/dto/swipe-response.dto.ts`

Required behavior:
- Identical repeated swipe returns success no-op.
- Identical repeated swipe creates no `swipe_event`, does not update `swipe_state`, does not update `lastSwipedAt`.
- Non-idempotent swipe creates `swipe_event`, upserts `swipe_state`.
- PASS returns matched false / matchId null.
- LIKE/SUPER_LIKE without reciprocal positive returns matched false / matchId null.

Exit criteria: No match creation yet, `npm run build` passes.

## 16. Batch 3F — Reciprocal Positive + Match Creation Delegation
**Status:** Completed.

Goal: Create matches when positive swipe intersects reciprocal positive state.
Allowed files:
- `src/modules/swipe/services/swipe.service.ts`
- `src/modules/match/services/match-creation.service.ts`
- `src/modules/match/repositories/match-write.repository.ts`
- `src/modules/match/match.types.ts`
- `src/modules/swipe/dto/swipe-response.dto.ts`

Required behavior:
- LIKE/SUPER_LIKE checks reciprocal LIKE/SUPER_LIKE.
- If reciprocal positive exists, call MatchCreationService within same transaction.
- MatchCreationService normalizes pair, creates ACTIVE match only when no existing match exists.
- Unique conflict P2002 on `uq_matches_user_pair` is handled safely.
- matched true returns matchId.
- No outbox write. No notification.

Exit criteria: Match lifecycle logic remains in match module, swipe module only orchestrates. `npm run build` passes.

## 17. Batch 3G — Swipe + Match Tests + Final Verification
**Status:** Completed.

Goal: Add focused unit tests for Phase 3 Swipe + Match behavior and run final verification.
Allowed files: `src/modules/swipe/**/*.spec.ts`, `src/modules/match/**/*.spec.ts`
Required tests:
- invalid action rejected
- target unavailable cases covered
- existing active/non-active match cases covered
- identical swipe idempotency covered
- non-identical state changes covered
- reciprocal positive match creation covered
- missing parameters map to exactly defined Phase 3 SwipeErrorCodes
- no block reason exposed
- no raw location exposed

Exit criteria: Tests pass, `npx prisma generate`, `npm run build` pass, final grep verification clear.

## 18. Batch 3H — Phase 3 Swipe + Match Final Fix-Only
**Status:** Completed.

Goal: Fix 5 human review blockers.
- Rejected REWIND
- Checked real_location IS NOT NULL
- Target photo requires non-empty publicUrl
- SwipeException mapped to HttpException
- Safe Match P2002 recovery avoiding transaction aborts

## 19. Batch 3I — Phase 3 Final Concurrency + API Hardening Fix
**Status:** Completed.

Goal: Prevent missed match race conditions and secure action enums.
- Added pair-level advisory transaction lock in PostgreSQL
- Fully decoupled SwipeResponseDto from Prisma SwipeAction
- Added defense-in-depth Runtime action guard to SwipeService
- block either direction -> `TARGET_NOT_AVAILABLE`
- existing ACTIVE match -> `ALREADY_MATCHED` and no event/state write
- existing non-active match -> `TARGET_NOT_AVAILABLE` and no event/state write
- identical repeated swipe no-op: no event insert, no state update, no `lastSwipedAt` update
- PASS creates event/state and no match
- LIKE without reciprocal positive creates event/state but no match
- SUPER_LIKE without reciprocal positive creates event/state but no match
- reciprocal LIKE creates match via MatchCreationService
- reciprocal SUPER_LIKE/LIKE creates match via MatchCreationService
- match pair ordering userAId/userBId maps to `user_a_id`/`user_b_id` rule
- P2002 match unique conflict handled safely
- response contains only targetUserId/action/matched/matchId
- no sensitive fields in response
- no outbox write
- swipe module does not own match lifecycle persistence

Exit criteria: `npm run build` passes, `npm run test` passes, grep checks pass.

## 18. Final Verification Commands
```bash
grep -R "outbox" -n src/modules/swipe src/modules/match || true
grep -R "ST_DWithin\|ST_Distance" -n src/modules/swipe src/modules/match || true
grep -R "MATCH_NOT_AVAILABLE" -n src || true
grep -R "storageKey\|email\|dob\|latitude\|longitude\|realLocation\|real_location" -n src/modules/swipe src/modules/match || true
grep -R "@ts-nocheck\|@ts-ignore\|@ts-expect-error" -n src || true
grep -R "\$queryRawUnsafe" -n src/modules/swipe src/modules/match || true
```
Safe hits must be explained in the final report.

## 19. Risks / Gaps
- Schema differences handled in section 4.

## 20. Stop Conditions
Stop implementation and report if:
- schema field required by tasks is absent
- repository needs schema change
- migration seems required
- package dependency seems required
- match lifecycle would need to live in swipe module
- existing global docs conflict with approved spec/plan
- implementation would require outbox write
- implementation would require discovery PostGIS query
- implementation would require quota/payment logic

## 21. Human Gate
Request human review and wait for approval before moving to Batch 3B implementation.
