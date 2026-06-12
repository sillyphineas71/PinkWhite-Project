# Phase 2 Discovery Feed Tasks

## Status
- Batch 2B completed
- Batch 2C completed
- Batch 2D completed
- Batch 2E completed
- Batch 2F completed
- Batch 2G cleanup completed only if build/test pass

## Batch 2B — DTOs, Cursor Helper, Requester Readiness

### Goal
Implement foundation pieces for the discovery feed: DTOs, cursor encode/decode helper, limit validation, and the requester readiness validation skeleton in DiscoveryService. No raw SQL candidate query yet.

### Allowed Files
- `src/modules/discovery/dto/get-discovery-feed.dto.ts`
- `src/modules/discovery/dto/discovery-feed-response.dto.ts`
- `src/modules/discovery/utils/discovery-cursor.util.ts`
- `src/modules/discovery/services/discovery.service.ts`
- `src/modules/discovery/discovery.module.ts`

### Forbidden Files
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/modules/discovery/repositories/discovery-feed.repository.ts`

### Implementation Steps
1. Create `GetDiscoveryFeedQueryDto` with optional `limit` and `cursor`.
2. Implement limit validation helper (min 1, max 50, default 20) in DTO or util.
3. Create cursor encode/decode helper in `discovery-cursor.util.ts`.
4. Create response DTO interfaces/classes.
5. Implement requester readiness validation in `DiscoveryService`. Check for ACTIVE status, verified email, completed onboarding, non-hidden privacy, active real location, and preferences.

### Acceptance Criteria
- Invalid limit rejected.
- Missing/invalid cursor rejected.
- Cursor helper round-trip works.
- Requester readiness returns controlled error categories.
- No candidate feed query yet.
- Build passes.

### Required Commands
```bash
npx prisma generate
npm run build
```

### Grep / Manual Checks
```bash
grep -R "OFFSET" -n src/modules/discovery || true
grep -R "\$queryRawUnsafe" -n src/modules/discovery || true
grep -R "real_location\|realLocation\|latitude\|longitude\|dob\|email" -n src/modules/discovery || true
grep -R "create.*swipe\|swipe.*create\|match.*create" -n src/modules/discovery src/modules/swipe src/modules/match || true
grep -R "@ts-nocheck\|@ts-ignore\|@ts-expect-error" -n src || true
```

### Stop Conditions
Stop when all acceptance criteria are met, build passes, and no forbidden changes are made.

---

## Batch 2C — DiscoveryFeedRepository PostGIS Candidate Query

### Goal
Implement `DiscoveryFeedRepository` with the raw SQL candidate query utilizing PostGIS for distance calculation and strict exclusion rules.

### Allowed Files
- `src/modules/discovery/repositories/discovery-feed.repository.ts`
- `src/modules/discovery/discovery.module.ts` (to export repository if needed)

### Forbidden Files
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/modules/discovery/controllers/discovery.controller.ts`

### Implementation Steps
1. Inspect `prisma/schema.prisma` to use correct table, column, and enum names.
2. Implement `DiscoveryFeedRepository` with a method using `Prisma.sql` / parameterized `$queryRaw`.
3. Construct SQL to query candidates ensuring they are active, verified, completed onboarding, not deleted, not hidden, have active real location, valid profile, and approved photos.
4. Add gender, min_age, and max_age preferences filtering.
5. Use `ST_DWithin` for distance filtering and `ST_Distance` to compute `distance_meters`.
6. Exclude requester, bidirectional blocks, existing matches, and LIKE/SUPER_LIKE swipes. Exclude PASS swipes newer than 30 days.
7. Apply cursor condition: `distance_meters > cursor.distanceMeters OR (distance_meters = cursor.distanceMeters AND candidate_user_id > cursor.candidateUserId)`.
8. Order results and fetch `limit + 1`.

### Acceptance Criteria
- Repository compiles.
- No OFFSET used in pagination.
- No string concatenation in SQL (must be fully parameterized).
- No raw location, DOB, or email returned from query.

### Required Commands
```bash
npm run build
```

### Grep / Manual Checks
```bash
grep -R "OFFSET" -n src/modules/discovery || true
grep -R "\$queryRawUnsafe" -n src/modules/discovery || true
```

### Stop Conditions
Stop when raw SQL logic meets criteria without exposing sensitive data or using unsafe query execution.

---

## Batch 2D — Service Mapping + Controller Endpoint

### Goal
Wire the `GET /discovery/feed` endpoint, map candidates safely, compute distanceKm, and formulate the response.

### Allowed Files
- `src/modules/discovery/controllers/discovery.controller.ts`
- `src/modules/discovery/services/discovery.service.ts`

### Forbidden Files
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/modules/discovery/repositories/discovery-feed.repository.ts` (should be complete)

### Implementation Steps
1. Implement the controller endpoint `GET /discovery/feed` utilizing the DTO.
2. Orchestrate in `DiscoveryService`: invoke readiness check, call repository for candidate IDs + distance.
3. Fetch public profile and photos using Prisma ORM with candidate IDs.
4. Filter photos to only include confirmed and approved ones.
5. Map results into safe response DTOs preserving raw SQL order.
6. Compute `distanceKm` securely (coarse rounding).
7. Compute `nextCursor` and `hasMore` logic (do not return the `limit + 1` item).

### Acceptance Criteria
- Endpoint compiles.
- Pending/rejected/unconfirmed photos are not returned.
- Ordering preserved.
- `nextCursor` uses last returned item.
- `hasMore` is true only when extra item exists.
- Response must not include dob, email, raw location, auth data, or internal states.

### Required Commands
```bash
npm run build
```

### Grep / Manual Checks
```bash
grep -R "real_location\|realLocation\|latitude\|longitude\|dob\|email" -n src/modules/discovery || true
```

### Stop Conditions
Stop when the API responds according to spec and mapper logic guarantees no sensitive data leakage.

---

## Batch 2E — Unit Tests + Build/Test

### Goal
Add focused unit tests to verify cursor logic, limits, readiness branching, and safe response mapping.

### Allowed Files
- `src/modules/discovery/**/*.spec.ts`

### Forbidden Files
- Source logic files (unless minor bug fixes).
- `prisma/schema.prisma`
- `prisma/migrations/*`

### Implementation Steps
1. Write cursor encode/decode round trip unit tests.
2. Write tests for invalid cursor throwing controlled errors.
3. Write limit validation tests (min, max, default).
4. Write response mapper tests explicitly verifying dob/email/raw location/internal fields are not exposed.
5. Verify `distanceKm` is integer-only.
6. Optionally write requester readiness branch tests if setup permits.

### Acceptance Criteria
- Unit tests pass.
- Mapper securely proven not to leak data.
- Build and global test suites pass.

### Required Commands
```bash
npx prisma generate
npm run build
npm run test
git status --short
```

### Grep / Manual Checks
```bash
npm run test
```

### Stop Conditions
Stop when all newly added tests are successfully passing and provide confidence in privacy rules.

---

## Batch 2F — Final Review/Fix

### Goal
Final comprehensive review verifying adherence to all principles and zero regression.

### Allowed Files
- Minimal bug fixes in previously touched Phase 2 files.

### Forbidden Files
- New feature files.
- `prisma/schema.prisma`
- `prisma/migrations/*`

### Review Checklist
- Build and tests pass.
- No Prisma schema changes.
- No migrations.
- No package changes unless justified.
- No OFFSET pagination.
- No raw location returned.
- No DOB/email returned.
- No unparameterized SQL (`$queryRawUnsafe`).
- No swipe/match mutations added.

### Required Commands
```bash
npm run build
npm run test
```

### Stop Conditions
Stop when the Phase 2 implementation is completely ready for a PR without structural or privacy flaws.

---

## Deferred Work
- Swipe mutations and match creation.
- Premium ranking and travel locations.
- Advanced ML filtering or full-text search.
- Report/moderation impacts beyond blocks and photo states.

## Notes
- Some grep hits may be legitimate in SQL filters or internal mapper code. The implementation report must explicitly explain why any hit is safe.
