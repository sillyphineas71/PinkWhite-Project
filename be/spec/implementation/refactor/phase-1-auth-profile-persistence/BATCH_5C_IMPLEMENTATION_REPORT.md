# Batch 5C Implementation Report — Onboarding Completion Persistence Flow

## Files Changed

- `src/modules/profile/services/profile.service.ts`: Added `evaluateOnboarding` method and integrated it into profile mutations.
- `src/modules/profile/services/photo.service.ts`: Integrated `evaluateOnboarding` into `confirmUpload`.
- `src/modules/profile/services/location.service.ts`: Integrated `evaluateOnboarding` into `updateRealGPS`.
- `spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md`: Updated task T-021 to Completed.

## Onboarding Requirements Implemented

- Profile exists.
- Profile `display_name` is set and not blank.
- Profile `dob` is set and calculated age is >= 18.
- Profile `gender` is set.
- Profile `relationship_goal` is set.
- Active real location exists (`active_location_mode = REAL` and `real_location` is not null).
- Approved, confirmed, and non-deleted photo exists.
- Discovery preferences row exists.
- User privacy settings row exists.
- Evaluator skips recalculating if user is already marked as `COMPLETED`.

## Status Update Behavior

- Upgrades `onboarding_status` to `COMPLETED` when all conditions are met.
- Sets `onboarding_completed_at` to the current timestamp upon completion.
- Does not downgrade an already `COMPLETED` user.
- Leaves status as-is if conditions are incomplete.

## Trigger Points

- Added trigger at the end of `ProfileService.createProfile`.
- Added trigger at the end of `ProfileService.updateBasicInfo`.
- Added trigger at the end of `ProfileService.updateBioInterests`.
- Added trigger at the end of `ProfileService.updateEducationJob`.
- Added trigger at the end of `PhotoService.confirmUpload`.
- Added trigger at the end of `LocationService.updateRealGPS`.
- *Note:* Triggers for preference and privacy updates are deferred to avoid circular dependencies between the profile and discovery modules, as permitted by the instructions.

## Age Calculation

- Date-aware age calculation implemented considering both the year and the month/day of the user's birthdate against the current date.

## Location Requirement

- Enforces that `active_location_mode` is `REAL`.
- Checks for the existence of `real_location` using a targeted raw SQL query against `user_locations` to safely verify the PostGIS field presence.
- Does not expose or extract the exact coordinates.

## Photo Requirement

- Verifies that at least one photo exists in the user's photos array with `uploadStatus = 'CONFIRMED'`, `moderationStatus = 'APPROVED'`, and `deletedAt = null` via Prisma include conditions.

## What Did Not Change

- Auth flows not changed
- Email verification not required for onboarding completion
- Discovery feed not implemented
- Discoverability filtering not implemented
- Binary upload/S3 not implemented
- Prisma schema not changed
- Migrations not changed

## Commands Run

| Command | Result | Notes |
|---|---|---|
| `npx prisma generate` | Pass | Client generated. |
| `npm run build` | Pass | Compiled successfully. |
| `npm run test` | Pass | Test suites executed successfully. |
| `git status --short` | Pass | Files updated per specification. |

## Git Status

```text
 M spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md
 M src/modules/profile/services/location.service.ts
 M src/modules/profile/services/photo.service.ts
 M src/modules/profile/services/profile.service.ts
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_4A_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_4B_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_4C_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_5A_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_5B_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_5C_IMPLEMENTATION_REPORT.md
?? src/modules/profile/repositories/user-privacy-settings.repository.ts
```

## Scope Compliance

- Adhered strictly to implementation bounds without altering the auth modules or database schema.
- Kept the implementation isolated from Discovery logic to prevent deep refactoring and circular dependencies.

## Known Issues / Deferred Work

- Triggers from `DiscoveryService` for preference/privacy updates are deferred. Onboarding evaluates during the next profile/photo/location action if a user finishes preferences last.
- Real location presence is checked via Prisma `$queryRaw` due to Prisma's limited PostGIS select capabilities, which is robust but not fully strongly typed.

## Next Step

Batch 6A — Final Phase 1 auth/profile persistence review.
