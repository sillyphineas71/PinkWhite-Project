# Phase 1 — Requirements Checklist

## CHANGELOG & REVISION HISTORY

| Date       | Change Summary                         | Sections Changed |
| ---------- | -------------------------------------- | ---------------- |
| 2026-06-11 | Initial Phase 1 requirements checklist | Entire file      |

---

> Note: In this checklist, `[x]` means the requirement is covered by the Phase 1 planning docs, not that the implementation has already been completed. Implementation progress is tracked in `tasks.md` batch status and reviewer gates.

## 1. Source of Truth Checklist

- [x] CLAUDE.md read and aligned.
- [x] AGENTS.md read and aligned.
- [x] spec/README.md read and aligned.
- [x] spec/database/DATABASE_SOURCE_OF_TRUTH.md read.
- [x] spec/database/POSTGRESQL_SCHEMA_V1.md read.
- [x] prisma/schema.prisma read.
- [x] spec/global/business-rules.md read.
- [x] spec/global/privacy-rules.md read.
- [x] spec/global/security.md read.
- [x] spec/modules/auth/module.md read.
- [x] spec/modules/profile/module.md read.
- [x] BATCH_0_BASELINE_INSPECTION.md read and findings incorporated.
- [x] All source of truth files are present and non-empty.

## 2. Scope Checklist

- [x] Phase 1 scope is limited to Auth and Profile modules.
- [x] Out of Scope items are explicitly documented in spec.md.
- [x] No Discovery/Swipe/Match/Chat/Payment work is Planned.
- [x] No Prisma schema changes.
- [x] No migration changes.
- [x] No passport_location runtime logic (existing route may remain baseline or return Not Implemented).
- [x] No binary photo upload infrastructure.
- [x] No CSRF protection in Phase 1.
- [x] No audit service runtime implementation.

## 3. Auth Business Rules Checklist

- [x] New user account_status = pending_email_verification.
- [x] New user onboarding_status = not_started.
- [x] Pending email verification user CAN login.
- [x] Pending email verification user CAN onboard.
- [x] Pending email verification user is NOT discoverable.
- [x] Login does NOT block due to unverified email alone.
- [x] Suspended/banned/deleted user blocked from login.
- [x] Forgot password returns generic response regardless of email existence.
- [x] Forgot password only eligible for active or pending_email_verification accounts.
- [x] Reset password updates auth_identities by user_id + provider = email.

## 4. Register Transaction Checklist

- [x] Register creates in a single DB transaction:
  - [x] users record
  - [x] auth_identities record
  - [x] discovery_preferences record with defaults
  - [x] user_privacy_settings record with defaults
  - [x] security_tokens record for email verification
- [x] Email sending happens OUTSIDE the transaction.
- [x] Duplicate email returns 409 Conflict.
- [x] Invalid email format returns 400 Bad Request.
- [x] Weak password returns 400 Bad Request.

## 5. Login Behavior Checklist

- [x] Login looks up auth_identities by provider = email + normalized email.
- [x] Password compared against bcrypt hash.
- [x] Generic error for wrong email OR wrong password (same message).
- [x] Account status check: suspended/banned/deleted rejected.
- [x] Creates user_sessions record with hash and family_id.
- [x] Access token payload: sub, session_id, token_type = access.
- [x] Refresh token payload: sub, session_id, jti, token_type = refresh.
- [x] HTTP-only cookies set with correct path/secure/samesite.
- [x] last_login_at updated on users table.

## 6. Refresh/Logout Session Checklist

- [x] Refresh validates refresh token JWT.
- [x] Refresh extracts session_id and jti from payload.
- [x] Refresh looks up session by session_id with session_status = active.
- [x] Refresh compares stored refresh_token_hash against token hash.
- [x] Hash match: rotate hash, update last_used_at, issue new tokens.
- [x] Hash mismatch: mark session as compromised.
- [x] Logout revokes current session (not delete).
- [x] Logout all revokes all active sessions.
- [x] Logout clears cookies.

## 7. Security Token Checklist

- [x] Security tokens store hash only (never raw token).
- [ ] token_type distinguishes email_verification, password_reset, account_restore.
- [x] expires_at is checked before validation.
- [x] used_at prevents reuse of consumed tokens.
- [x] Verify email sets used_at, email_verified_at, updates account_status.
- [x] Reset password marks token used, updates password_hash, revokes sessions.

## 8. Profile Privacy Checklist

- [x] Self profile returns full data including DOB and exact location.
- [x] Public/discovery/match profile view is NOT in Phase 1 scope.
- [x] profiles.dob never exposed to other users.
- [x] Real location stored in DB but never exposed to other users.
- [x] display_name maps to Prisma display_name, not fullName.

## 9. Onboarding Completion Checklist

- [x] Onboarding evaluator checks ALL conditions:
  - [x] Age >= 18
  - [x] Profile has display_name, dob, gender
  - [x] At least 1 approved photo (confirmed upload, approved moderation, not deleted)
  - [x] active real location exists
  - [x] Discovery preferences exist
  - [x] User privacy settings exist
  - [x] Account status not banned/suspended/deleted
- [x] Email verification is NOT required for onboarding completion.
- [x] onboarding_status = completed and onboarding_completed_at set when all conditions met.

## 10. Profile Photo Checklist

- [x] Photo metadata persisted: storage_provider, storage_key, public_url, mime_type, size_bytes, sort_order, is_avatar, upload_status, moderation_status.
- [x] Soft delete supported (deleted_at).
- [x] Max photos config check preserved.
- [x] Unique user_id + sort_order constraint for non-deleted photos.

## 11. Location Persistence Checklist

- [x] real_location stored as PostGIS geography(Point, 4326).
- [x] Parameterized raw SQL used (no string concatenation of lat/lng).
- [x] active_location_mode = real for Phase 1.
- [x] No passport_location runtime logic (existing route may remain baseline or return Not Implemented).

## 12. Preferences/Privacy Checklist

- [x] discovery_preferences upsert works (min_age, max_age, max_distance_km, preferred_genders).
- [x] user_privacy_settings upsert works (is_hidden, show_distance, show_online_status, show_last_active).
- [x] Default preferences created on register.

## 13. Route Collision Checklist

- [x] @Get(':id') is the LAST declared route in ProfileController.
- [x] All static routes resolve correctly (e.g., GET /profile/location/active).
- [x] Dynamic :id does not capture static route paths.

## 14. Mock Fallback Checklist

- [x] PrismaService does NOT catch and silently swallow DB connection errors.
- [x] No runtime mock data fallback paths remain in Auth repositories.
- [x] No runtime mock data fallback paths remain in Profile repositories.

## 15. Error Handling Checklist

- [x] Duplicate email: 409 Conflict.
- [x] Invalid credentials or account not allowed to login: 401 Unauthorized (generic response).
- [x] Invalid token (verify/reset): 400 Bad Request.
- [x] Expired token: 410 Gone.
- [x] Already verified: 409 Conflict.

- [x] Forgot password: always returns same generic success message.
- [x] Validation errors: 400 Bad Request.
- [x] No sensitive data leaked in error responses.

## 16. Out-of-Scope Protection Checklist

- [x] No Discovery/Swipe/Match/Chat/Payment work.
- [x] No passport_location runtime.
- [x] No binary photo upload flow.
- [x] No fake AuditLogService.
- [x] No fake EmailService (use existing service).
- [x] No CSRF protection implementation.
- [x] No schema or migration changes.
- [x] No @ts-nocheck / @ts-ignore / @ts-expect-error.
- [x] No regex fix scripts.

## 17. Batch Implementation Checklist

- [ ] Batch 1 — PrismaService fail-fast only (T-001).
- [ ] Batch 2 — Auth repository base (T-002 through T-006).
- [ ] Batch 3 — Token/session/login/logout (T-007 through T-011).
- [ ] Batch 4 — Register + security token flows (T-012 through T-014).
- [ ] Batch 5 — Profile base (T-015, T-016).
- [ ] Batch 6 — Photo/location/preferences (T-017 through T-020).
- [ ] Batch 7 — Onboarding + route collision + cleanup (T-021 through T-023).
- [ ] Build passes after each batch.
- [ ] Unit tests pass after each batch.
- [ ] E2E tests pass after each batch.

## 18. User Review Gate

- [ ] spec.md reviewed and approved.
- [ ] plan.md reviewed and approved.
- [ ] tasks.md reviewed and approved.
- [ ] checklists/requirements.md reviewed and approved.
- [ ] Batch 1 ready for implementation.
- [ ] Batch gates enforced: each batch requires review before next batch begins.
