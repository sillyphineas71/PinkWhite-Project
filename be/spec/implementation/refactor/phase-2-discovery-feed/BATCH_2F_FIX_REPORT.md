# Batch 2F Fix Report — Discovery Feed Final Fixes

## Files Changed
- `src/modules/discovery/services/discovery.service.ts`
- `src/modules/discovery/services/discovery.service.spec.ts`
- `src/modules/discovery/repositories/discovery-feed.repository.ts`
- `spec/implementation/refactor/phase-2-discovery-feed/tasks.md`
- `spec/implementation/refactor/phase-2-discovery-feed/BATCH_2F_FIX_REPORT.md`

## Fixes Applied

### Gender Preference Normalization
Refactored `DiscoveryService.getFeed` to normalize candidate preferred genders down to database-safe lowercase enums. Uppercase values are cleanly translated and `ALL` safely expands to `['male', 'female', 'non_binary', 'other']` ensuring exact PostGIS raw enum match capability.

### Preferred Genders Semantics
Removed reliance on collapsed `PreferenceEntity` helper maps which were lossy for multiple concrete arrays. Overrode readiness extraction directly utilizing Prisma raw output over `discovery_preferences` ensuring multi-gender configurations like `['male', 'non_binary']` no longer destructively map into a singular `ALL` value before hitting the SQL query.

### Safe Public Photo URL Only
Updated `DiscoveryFeedRepository.findCandidates` internal `EXISTS` check on photos to explicitly enforce `pp.public_url IS NOT NULL AND pp.public_url != ''`. In `DiscoveryService`, refined hydration mapping to strip out any photo missing a valid `publicUrl`. Removed the `storageKey` fallback outright. If a candidate ends up with 0 safe public photos after trimming, they are safely omitted.

### Location Readiness Without 0/0 Sentinel
Removed artificial `latitude/longitude === 0` sentinel conditions from the readiness checker. Now queries the `user_locations` table using `$queryRaw` to accurately read `active_location_mode` against the exact value `real` and explicitly verifies `real_location` points presence, maintaining strict compliance with the Phase 1 spec location boundary logic.

### Date-Aware Age Calculation
Stripped old Math logic for UTC trick calculations and deployed strict date-aware calculation tracking exact Month/Day progression bounds preventing candidates from registering incorrect birthday year drifts.

### Bug-Specific Tests
Added exhaustive unit tests covering edge cases around:
- **Birthday Drifts:** Confirmed safe translation between people who have and have not had a birthday this year.
- **Leaking `storageKey`:** Enforced tests where injected mock objects leak storage keys, confirming they are comprehensively stripped out of the mapped JSON strings.
- **Null `publicUrl` Exclusions:** Verified specific photo instances lacking URLs are truncated. Added exclusion test to verify entire candidates are gracefully dropped if zero approved non-empty URLs exist.

## Commands Run

| Command | Result | Notes |
|---|---|---|
| `npx prisma generate` | Pass | Typings accurately synced. |
| `npm run build` | Pass | Backend logic transpiled completely clean. |
| `npm run test` | Pass | All newly added fix/edge-case tests passed cleanly over `discovery.service.spec.ts`. |
| `git status --short` | Pass | Files tracked accurately. |

## Grep Checks

- `storageKey`: Handful of hits verifying schema and mappings, but removed strictly from `url` assignments in service mappings.
- `publicUrl ||`: Flagged hit for `!photo.publicUrl || photo.publicUrl.trim() === ''` which is safe usage checking for falsy attributes, not fallback exposure.
- `0/0 location`: Safely clean.
- `old age`: Safely clean.
- `uppercase gender`: Mapped correctly at source before repository layer insertion.
- `OFFSET`: Pass (Zero Hits).
- `queryRawUnsafe`: Pass (Zero Hits).
- `TS suppression`: Pass (Zero Hits in new/modified).
- `swipe/match mutation`: Pass (Zero Hits).
- `sensitive field grep`: Safely bounded internal logic checks only; removed explicitly from any output variables.

## Privacy Boundary

Confirmed:
- `storageKey` never returned (No fallback assignment logic left).
- `dob` never returned (Safely transformed inside internal `let age` mapping algorithm).
- `email` never returned (Stripped tightly inside Service payload assignments).
- `raw location` never returned (Internal check logic correctly bounds out of mapper).

## Manual Review Checklist
1. DiscoveryFeedRepository receives DB-normalized gender values. **(Pass)**
2. DiscoveryFeedRepository raw SQL uses only parameterized values. **(Pass)**
3. Approved-photo existence requires safe public URL. **(Pass)**
4. Service photo fetch excludes photos with missing publicUrl. **(Pass)**
5. Response mapper never uses storageKey. **(Pass)**
6. Requester readiness checks real_location presence and active_location_mode, not latitude/longitude 0. **(Pass)**
7. Response age uses date-aware helper. **(Pass)**
8. Existing cursor/limit/privacy/pagination tests still pass. **(Pass)**
9. New bug-specific tests pass. **(Pass)**
10. No schema/migration/package changes. **(Pass)**

## Scope Compliance
Strictly restricted bounds. Did not invoke mutation/state behavior outside of strictly mapped GET behavior. Database schemas untouched.

## Recommendation
**Phase 2 is READY for final human review before commit.** All discovery logic blockers are resolved and mapped back into tests guaranteeing regression prevention.
