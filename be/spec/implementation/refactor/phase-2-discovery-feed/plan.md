# Phase 2 Discovery Feed Plan

## 1. Current State
Phase 1 Auth/Profile persistence has been committed and finalized. The core models (users, profiles, profile_photos, locations, preferences, privacy, swipe states, matches, blocks, reports) exist. The Phase 2 discovery specification is fully approved and unambiguous.

## 2. Target Outcome
Implement the `GET /discovery/feed` endpoint efficiently and securely, ensuring exact adherence to the specification. This entails executing a robust PostGIS distance query, filtering candidates based on requester preferences, privacy settings, and exclusion rules (blocks, recent/specific swipes, matches), while completely shielding sensitive candidate data from the requester.

## 3. Files To Create
- `src/modules/discovery/dto/get-discovery-feed.dto.ts`
- `src/modules/discovery/dto/discovery-feed-response.dto.ts`
- `src/modules/discovery/repositories/discovery-feed.repository.ts`

## 4. Files To Modify
- `src/modules/discovery/discovery.module.ts`
- `src/modules/discovery/services/discovery.service.ts`
- `src/modules/discovery/controllers/discovery.controller.ts`

## 5. Architecture Decision

### 5.1 Query Strategy
Use a hybrid approach:
- Prisma ORM for normal CRUD-style lookups (e.g., fetching full profile/photo data after filtering, and requester readiness checks).
- Prisma raw SQL for the PostGIS candidate query.
**Reason:** PostGIS `ST_DWithin` and `ST_Distance` are clearer, safer, and perform more optimally through raw SQL than trying to force them through Prisma ORM abstractions.

### 5.2 Repository Responsibility
Create a new `DiscoveryFeedRepository` (`src/modules/discovery/repositories/discovery-feed.repository.ts`).
This repository should own:
- The raw SQL candidate query.
- PostGIS distance filtering (`ST_DWithin`, `ST_Distance`).
- Block exclusion.
- Swipe exclusion.
- Match exclusion.
- Approved photo existence check (at least one approved, confirmed, non-deleted photo).
- Stable cursor pagination condition (`distance_meters` + `candidate_user_id`).

### 5.3 Service Responsibility
The `DiscoveryService` should own:
- Requester readiness validation (querying existing repos).
- Query parameter validation.
- Cursor encode/decode orchestration.
- Response mapping.
- Error category selection.

### 5.4 Controller / DTO Responsibility
- Controller routes `GET /discovery/feed` and extracts `@CurrentUser()` and `@Query()`.
- DTOs enforce `limit` validation (default 20, max 50, min 1) and optional `cursor` passing.

## 6. Requester Readiness Plan
The service will sequentially check the requester's state before executing any feed queries.
Requester must have:
- `account_status = ACTIVE`, `deleted_at IS NULL`
- `email_verified_at IS NOT NULL`
- `onboarding_status = COMPLETED`
- `user_privacy_settings` exists, `is_hidden = false`
- `discovery_preferences` exists
- `real_location` exists, `active_location_mode = REAL`

Failures will throw controlled, generalized error categories: `ACCOUNT_NOT_ACTIVE`, `EMAIL_NOT_VERIFIED`, `ONBOARDING_INCOMPLETE`, `HIDDEN_FROM_DISCOVERY`, `LOCATION_REQUIRED`, `PREFERENCES_REQUIRED`, or `DISCOVERY_NOT_READY`. No candidate-side exclusion reasons will be exposed.

## 7. Candidate Query Plan
The raw SQL query will ensure the candidate satisfies:
- User is active, verified, completed onboarding, not deleted, and not the requester.
- Privacy `is_hidden = false`.
- Active real location exists.
- Valid profile row exists.
- Has at least one approved, confirmed, non-deleted photo.
- Gender and age preference matches.
- Within `max_distance_km`.
- No block in either direction.
- No existing match.
- No `LIKE`/`SUPER_LIKE` swipe by requester.
- No `PASS` swipe within the last 30 days (`PASS` older than 30 days can reappear).

## 8. PostGIS Query Plan
The candidate query will heavily utilize PostGIS directly:
- Pre-calculate maximum distance in meters: `requester.max_distance_km * 1000`.
- Filter: `ST_DWithin(candidate.real_location, requester.real_location, max_distance_meters)`.
- Sort/Compute: `ST_Distance(candidate.real_location, requester.real_location)`.
- Use the calculated distance for cursor sorting and response mapping.

## 9. Age Filtering Plan
Age calculation will be done dynamically within the SQL query using Postgres date functions (e.g., `EXTRACT(YEAR FROM age(CURRENT_DATE, dob))`) to ensure robust filtering by the requester's `min_age` and `max_age` preferences without ever fetching the `dob` into the application layer for filtering.

## 10. Swipe / Pass Recycle Plan
Exclude candidates with active relevant swipes via a `NOT EXISTS` or `LEFT JOIN` subquery.
- Exclude if `swipe_type IN ('LIKE', 'SUPER_LIKE')`.
- Exclude if `swipe_type = 'PASS'` AND `created_at > NOW() - INTERVAL '30 days'`.

## 11. Block / Match Exclusion Plan
- **Block**: Exclude candidates using a bidirectional `NOT EXISTS` check against `user_blocks` (where requester blocked candidate OR candidate blocked requester).
- **Match**: Exclude candidates using a bidirectional `NOT EXISTS` check against `matches` table.

## 12. Photo Fetching Plan
Photos will be fetched in a hybrid manner to avoid overfetching and complex JSON aggregation in the raw SQL:
1. The raw SQL returns a list of matching `candidate_user_id`s and their computed `distance_meters`.
2. The service performs a second Prisma query to fetch the full public profiles and photos for these `candidate_user_id`s, explicitly filtering for `upload_status = CONFIRMED`, `moderation_status = APPROVED`, and `deleted_at IS NULL`.
3. The Prisma result is zipped back with the `distance_meters` from the SQL query, preserving the cursor ordering.

## 13. Cursor Pagination Plan
- Limit: `default = 20`, `max = 50`, `min = 1`.
- The repository fetches `limit + 1` rows to calculate `hasMore`.
- The cursor is an opaque base64-encoded JSON string containing `distanceMeters` and `candidateUserId`.
- To avoid floating point issues, `distance_meters` will be rounded to the nearest integer in the SQL projection before sorting.
- The query resumes using SQL logic: `distance_meters > cursor.distanceMeters OR (distance_meters = cursor.distanceMeters AND candidate_user_id > cursor.candidateUserId)`.

## 14. Response Mapping Plan
The service will strictly map the hybrid result set into a safe response DTO.
- **Includes**: `userId`, `displayName`, `age`, `gender`, `relationshipGoal`, `bio`, `photos[]`, `distanceKm` (coarsely rounded).
- **Never Includes**: `dob`, `email`, raw location/PostGIS points, account status, internal flags, block/swipe details.

## 15. Error Handling Plan
All internal errors and validation failures will be mapped to domain-specific error constants defined in the spec. Candidate exclusion is silent and returns no error, simply omitting the candidate from the feed.

## 16. Test Plan
- Unit tests for cursor encoding/decoding helper logic.
- Unit tests for limit and parameter validation on DTOs.
- Unit tests for requester readiness decision branching in the service.
- Service-level unit tests for the response mapper to assert strict privacy boundary enforcement (no DOB, email, etc. leakage).

## 17. Implementation Batches Preview
- **Batch 2B** — DTOs, cursor helper, requester readiness service logic.
- **Batch 2C** — DiscoveryFeedRepository raw SQL candidate query.
- **Batch 2D** — Service response mapping + controller endpoint.
- **Batch 2E** — Unit tests + build/test.
- **Batch 2F** — Final review/fix.

## 18. Risks and Mitigations
- **PostGIS raw SQL field-name mismatch risk**: Use `Prisma.sql` strictly and verify against DB schema casing.
- **Prisma enum name mismatch risk**: Cast enums explicitly in the SQL (e.g., `::"SwipeType"`).
- **Cursor sorting with floating distance risk**: Mitigation is to map `ST_Distance` to `ROUND(ST_Distance(...))` in the sort key calculation.
- **Overfetch / N+1 photo loading risk**: Mitigate using a single `in: [...]` query for photos via Prisma after the SQL IDs are resolved.
- **Privacy leak risk from mapping too many fields**: Mitigate via a strict `DiscoveryCandidateDto` mapper that cherry-picks fields.
- **Low test coverage risk**: Add targeted unit tests for the complex response mapper and cursor helper.

## 19. Deferred Work
- Relationship goal filtering (currently only returning the field).
- Admin moderation / User Reports filtering.
- Swipe mutations and match creation.
- S3 photo upload / external ML recommendation integrations.
