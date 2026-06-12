# Phase 2 Discovery Feed Spec

## 1. Goal
Define the business and technical specification for the `GET /discovery/feed` API endpoint. This endpoint is responsible for returning safe, public candidate profiles that the requesting user is allowed to discover, strictly adhering to privacy, distance, age, gender, block, and swipe/pass recycle rules.

## 2. In Scope
- Specification of the `GET /discovery/feed` API contract.
- Business rules for requester discovery readiness.
- Business rules for candidate discoverability.
- Preference filtering rules (gender, age, distance).
- Block rules (mutual exclusion).
- Swipe exclusion rules (likes, super likes, recent passes).
- Pass recycle rule (30 days).
- Match exclusion rule.
- Location / PostGIS rules (secure distance calculation).
- Cursor-based pagination rules.
- Stable ordering rules.
- Error handling specific to this endpoint.
- Security and privacy requirements.
- Concrete and testable acceptance criteria.

## 3. Out of Scope
- swipe mutation
- match creation
- chat
- payment / premium ranking
- boost
- passport/travel location
- S3 upload
- photo moderation workflow
- admin moderation
- ML recommendation
- full-text search
- new Prisma schema
- migration
- frontend work

## 4. Actors
- **Requester**: The authenticated user calling the discovery feed endpoint.
- **Candidate**: The user profile potentially returned in the discovery feed.

## 5. API Contract

### 5.1 GET /discovery/feed
Retrieves a paginated list of candidate profiles matching the requester's discovery preferences and passing all exclusion/privacy checks.

### 5.2 Query Parameters
- `limit` (optional): Number of candidates to return per page. Phase 2 default = 20, max = 50, min = 1. Invalid limit must return a controlled validation error.
- `cursor` (optional): Opaque string used for pagination to fetch the next set of results.

### 5.3 Response Body
```json
{
  "candidates": [
    {
      "userId": "uuid",
      "displayName": "string",
      "age": 25,
      "gender": "string",
      "relationshipGoal": "string",
      "bio": "string | null",
      "photos": [
        {
          "photoId": "uuid",
          "url": "string",
          "displayOrder": 1
        }
      ],
      "distanceKm": 12
    }
  ],
  "nextCursor": "string | null",
  "hasMore": true
}
```

### 5.4 Candidate Response Fields
- `userId`: Unique identifier of the candidate.
- `displayName`: Candidate's public display name.
- `age`: Date-aware calculated age in years.
- `gender`: Candidate's gender identity.
- `relationshipGoal`: Candidate's stated relationship goal.
- `bio`: Candidate's biography text (nullable).
- `photos`: Array of approved public photos, sorted by `displayOrder`. (Pending, rejected, deleted, or unconfirmed photos must never be returned).
- `distanceKm`: Coarsely rounded distance between requester and candidate in kilometers.

### 5.5 Fields That Must Never Be Exposed
- email
- phone
- dob
- exact latitude
- exact longitude
- raw PostGIS location
- account_status
- email_verified_at
- deleted_at
- deletion_scheduled_at
- auth identity data
- session data
- raw moderation fields
- internal audit fields
- raw swipe state
- raw block/report data

## 6. Requester Discovery Readiness Rules
The requesting user can use discovery only if all conditions are true:
- requester account_status = ACTIVE
- requester deleted_at is null
- requester email_verified_at is not null
- requester onboarding_status = COMPLETED
- requester has user_privacy_settings
- requester user_privacy_settings.is_hidden = false
- requester has discovery_preferences
- requester has active real location
- requester active_location_mode = REAL
- requester real_location is not null

## 7. Candidate Discoverability Rules
A candidate can appear in discovery only if all conditions are true:
- candidate user account_status = ACTIVE
- candidate deleted_at is null
- candidate email_verified_at is not null
- candidate onboarding_status = COMPLETED
- candidate is not the requester
- candidate has a valid profile row containing displayName, dob, gender, and relationshipGoal
- candidate has user_privacy_settings
- candidate user_privacy_settings.is_hidden = false
- candidate has active real location
- candidate active_location_mode = REAL
- candidate real_location is not null
- candidate has at least one profile photo:
  - deleted_at is null
  - upload_status = CONFIRMED
  - moderation_status = APPROVED
- candidate matches requester's discovery preferences
- candidate is within requester's max_distance_km
- candidate has not blocked requester
- requester has not blocked candidate
- candidate has not already been swiped by requester, except PASS recycle after 30 days

## 8. Preference Filtering Rules
Requester preferences applied to candidates:
- **preferred gender(s)**: Candidate's gender must match one of the requester's preferred genders.
- **min_age**: Candidate's calculated age >= requester's `min_age`.
- **max_age**: Candidate's calculated age <= requester's `max_age`.
- **max_distance_km**: Distance between real locations <= requester's `max_distance_km`.
*Note: relationshipGoal is returned as a public profile field but is NOT used as a discovery filter in Phase 2.*
*Age must be calculated dynamically from candidate DOB using date-aware age calculation. Do not expose candidate DOB.*
*If preference data is missing, requester is not discovery-ready.*

## 9. Block Rules
Mutual exclusion applies:
- If requester blocked candidate -> candidate excluded.
- If candidate blocked requester -> candidate excluded.

## 9.5 Reports Rule
`user_reports` are not part of Phase 2 discovery filtering. Report/moderation behavior is deferred to a later phase.

## 10. Swipe Exclusion Rules
Candidate must be excluded if requester already has an active/relevant swipe state against the candidate (LIKE, SUPER_LIKE, or recent PASS).

## 11. Pass Recycle Rule
- If the previous swipe is PASS, the candidate is excluded *unless* the pass recycle window has passed.
- Phase 2 pass recycle rule: PASS can reappear after 30 days.

## 12. Match Exclusion Rule
If any match record already exists between requester and candidate, the candidate must be excluded from Phase 2 discovery feed. This avoids rematch/unmatch complexity in Phase 2.

## 13. Location / PostGIS Rules
Use PostGIS functions for distance queries:
- Must use `ST_DWithin(requester.real_location, candidate.real_location, max_distance_meters)` for filtering.
- Must use `ST_Distance(requester.real_location, candidate.real_location)` for computation.
- Output `distanceKm` must be safely rounded to a coarse integer kilometer value (e.g., `Math.round(distanceMeters / 1000)`).
- Minimum displayed distance should be `1` when the candidate is within 1km but distance is greater than 0.
- Never return meters or decimal distance.
- Exact latitude/longitude and raw PostGIS points must never be returned.

## 14. Pagination Rules
- The discovery feed must use cursor-based pagination. OFFSET pagination is not allowed.
- The cursor must be opaque to clients (e.g., base64 encoded).
- Conceptually, the cursor encodes: `{"distanceMeters": 12345, "candidateUserId": "uuid"}`.
- When fetching the next page, the query must resume after the last item using logic equivalent to:
  `distance_meters > cursor.distance_meters OR (distance_meters = cursor.distance_meters AND candidate_user_id > cursor.candidate_user_id)`
- The client must not rely on cursor internals.

## 15. Ordering Rules
Ordering must be stable.
- Primary Sort: distance ascending.
- Secondary Sort (Tie-breaker): candidate user ID (or another stable unique identifier).

## 16. Error Handling
Requester discovery readiness errors should use controlled error categories. Allowed categories:
- `DISCOVERY_NOT_READY`
- `ACCOUNT_NOT_ACTIVE`
- `EMAIL_NOT_VERIFIED`
- `ONBOARDING_INCOMPLETE`
- `HIDDEN_FROM_DISCOVERY`
- `LOCATION_REQUIRED`
- `PREFERENCES_REQUIRED`
- `INVALID_LIMIT`
- `INVALID_CURSOR`

Errors must not expose sensitive candidate-side exclusion reasons (e.g., block, swipe state, distance, or hidden profile).

## 17. Security and Privacy Requirements
- Enforce strict exclusion of sensitive data fields (DOB, email, raw location, auth data).
- Ensure DB queries inherently filter out soft-deleted, unverified, or non-active accounts before application logic processing.
- Prevent exposing the exact reason *why* a candidate is excluded to either party (e.g., block vs. age filter).

## 18. Acceptance Criteria
- Hidden users do not appear in feed.
- Unverified users do not appear in feed.
- Incomplete onboarding users do not appear in feed.
- Users without approved photos do not appear in feed.
- Blocked users are mutually excluded.
- Already LIKE/SUPER_LIKE swiped candidates do not reappear.
- PASS candidates reappear only after 30 days.
- Candidates outside max_distance_km do not appear.
- Exact location is never returned.
- DOB is never returned.
- Cursor pagination returns stable nextCursor.
- Requester missing preferences receives a controlled error.
- Requester missing location receives a controlled error.

## 19. Open Questions
- None at this time. All initial Phase 2 open questions have been resolved.
