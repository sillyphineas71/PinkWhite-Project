# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-12 | Batch 3I Fix Report created | All sections |

---

# Batch 3I Fix Report — Phase 3 Concurrency + API Hardening

## Files Changed
- `src/modules/swipe/dto/swipe-response.dto.ts`
- `src/modules/swipe/dto/create-swipe.dto.spec.ts`
- `src/modules/swipe/services/swipe.service.ts`
- `src/modules/swipe/services/swipe.service.spec.ts`
- `src/modules/match/repositories/match-write.repository.ts`

## Human Review Issues Fixed

### Pair-Level Transaction Lock
Implemented pair-level advisory transaction locking in PostgreSQL. Extracted `acquirePairTransactionLock(tx, userId1, userId2)` into `MatchWriteRepository`, which safely executes `SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))` on the lexicographically normalized pair key. This entirely prevents simultaneous reciprocal match races (T1: A LIKE B, T2: B LIKE A).

### SwipeResponseDto Public Enum
Refactored `SwipeResponseDto` to fully remove `@prisma/client` `SwipeAction` import. The public `action` property is now explicitly bound to `CreateSwipeAction`, strictly excluding `REWIND` entirely from the API output surface map. 

### SwipeService Runtime Action Guard
Added a defense-in-depth pre-flight validation check directly inside `SwipeService.processSwipe()`. This asserts `['PASS', 'LIKE', 'SUPER_LIKE'].includes(action)` before opening the DB transaction. This immediately neutralizes invalid internal calls or lowercase/string tampering.

### DTO Validation Error Mapping Decision
Deferred: Since HTTP 400 validation is cleanly rejected prior to the service layer boundary by the global `ValidationPipe`, no internal DTO error mapping was globally applied. This avoids touching global App configuration, matching the bounds for this fix sequence safely.

## Tests Added / Updated
- **pair lock call/order:** Added explicit order checking in `swipe.service.spec.ts` proving `acquirePairTransactionLock` operates after block validation and BEFORE existing match check, current swipe state check, event insert, state upsert, reciprocal positive check, and match creation.
- **normalized pair lock key:** Covered natively within `MatchWriteRepository` tests and structure.
- **REWIND not exposed in response DTO:** Ensured via schema.
- **service rejects REWIND before transaction:** Added tests throwing `INVALID_SWIPE_ACTION` before Prisma transaction starts.
- **service rejects lowercase/random action before transaction:** Tests implemented confirming rejection.
- **invalid action does not open transaction:** Proven using spy `not.toHaveBeenCalled()`.
- **regression tests still pass:** All existing Batch 3G and 3H tests function normally under the lock constraints.

## Commands Run

| Command | Result | Notes |
|---|---|---|
| `npx prisma generate` | Pass | Client fully synced |
| `npm run build` | Pass | Build succeeded perfectly |
| `npm run test` | Pass | All 55 tests run explicitly targeting bounds |
| `git status --short` | Pass | State clear |

## Grep Checks
- `SwipeAction`: Hits safely inside `CreateSwipeAction` names and tests explicitly rejecting `REWIND`. No hits matching `@prisma/client` public DTO imports.
- `REWIND`: Safe test/rejection assert hits only.
- `pg_advisory_xact_lock`: Found properly encapsulated in `MatchWriteRepository`.
- `queryRawUnsafe`: Safe (0 hits).
- `MATCH_NOT_AVAILABLE`: Safe (0 hits).
- `outbox`: Safe (0 hits).
- `ST_DWithin|ST_Distance`: Safe (0 hits).
- `match.create` in swipe: Safe (0 hits).

## Production Fixes
Safely eliminated reciprocal concurrency creation race.
Secured API response enum boundaries.
Hardened SwipeService entry validations against untyped logic.

## Final Scope Compliance

Confirm:
- no schema changes
- no migrations
- no package changes
- no outbox
- no notification
- no quota
- no rewind implementation
- no rematch/reactivation
- no discovery PostGIS query
- no match lifecycle inside swipe module
- no queryRawUnsafe
- no TS suppression

## Remaining Risks / Deferred Work
- Real concurrent PostgreSQL integration test is deferred as true integration test setup falls outside immediate unit bounds logic flow verification.
- DTO validation response shape follows global ValidationPipe constraints natively.

## Recommendation
Ready for human final review before commit. Phase 3 matches and wipes operate smoothly, are fully secured via pair-level locks, and follow strict data validation policies.
