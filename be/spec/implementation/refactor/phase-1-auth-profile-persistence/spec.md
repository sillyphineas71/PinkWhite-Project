# Phase 1 — Auth/Profile Persistence Specification

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial Phase 1 spec — Auth/Profile persistence refactor | Entire file |

---

## 1. Context & Goal

The current codebase uses in-memory mock repositories (Map<String, Entity>) for all Auth and Profile data. Build and e2e tests now pass at baseline, but no data survives process restart, and mock behavior differs from production Prisma-backed logic.

**Goal:** Replace in-memory Auth and Profile repositories with Prisma-backed persistence, without changing the Prisma schema or running new migrations. The database baseline (21 models, PostgreSQL + PostGIS) is already applied.

Phase 1 is strictly Auth + Profile persistence. Modules outside Auth/Profile must not be touched.

## 2. Module Scope

### In Scope

| Module | Scope |
|---|---|
| Auth | User, auth identity, session, security token persistence. Token payload redesign. Refresh token rotation. Login/logout/register/verify/reset flows use DB. |
| Profile | Profile, photo metadata, location, privacy settings, discovery preferences persistence. Onboarding evaluator uses DB. |
| Common | PrismaService fail-fast. CurrentUser decorator type consistency. |

### Out of Scope

- Discovery/Swipe/Match/Chat/Payment business logic.
- passport_location runtime behavior.
- Photo binary upload infrastructure.
- Email delivery infrastructure.
- AuditLogService (no fake runtime implementation).
- CSRF protection.
- Account status guard enhancements.
- Redis integration.
- Schema changes or new migrations.
- Admin/moderator features.

## 3. Use Case Specifications

### UC-AUTH-001 — Register

**Actor:** Unauthenticated user.

**Functional Requirements:**

THE system SHALL accept email and password from registration form.

THE system SHALL normalize email (lowercase, trim).

THE system SHALL reject registration IF email already exists.

THE system SHALL hash password with bcrypt before storage.

THE system SHALL create the following records in a single DB transaction:
- users record with account_status = pending_email_verification, onboarding_status = not_started, user_role = user
- auth_identities record with provider = email, password_hash
- discovery_preferences record with default values
- user_privacy_settings record with default values
- security_tokens record with token_type = email_verification

THE system SHALL send verification email AFTER the DB transaction commits (not inside transaction).

THE system SHALL return user id and masked email on success.

**Error Handling:**
- Duplicate email: 409 Conflict
- Invalid email format: 400 Bad Request
- Weak password: 400 Bad Request

### UC-AUTH-002 — Login

**Actor:** Registered user (any account_status except suspended/banned/deleted).

**Functional Requirements:**

THE system SHALL accept email and password.

THE system SHALL normalize email.

THE system SHALL lookup auth_identities by provider=email + normalized email.

THE system SHALL compare password against stored bcrypt hash.

IF password does not match, THE system SHALL return generic error without revealing which field is wrong.

THE system SHALL reject login IF user account_status is suspended, banned, or deleted.

THE system SHALL create a new user_sessions record with refresh token hash.

THE system SHALL sign access token with payload: sub (user_id), session_id, token_type = access.

THE system SHALL sign refresh token with payload: sub (user_id), session_id, jti, token_type = refresh.

THE system SHALL set HTTP-only cookies for both tokens.

THE system SHALL update last_login_at on users table.

**Error Handling:**
- Invalid credentials or account not allowed to login: 401 Unauthorized (generic response — does not reveal whether email exists, password is wrong, or account is blocked)

### UC-AUTH-003 — Refresh Token

**Actor:** User with valid refresh token cookie.

**Functional Requirements:**

THE system SHALL extract refresh token from HTTP-only cookie.

THE system SHALL verify JWT signature and expiry.

THE system SHALL extract session_id and jti from payload.

THE system SHALL lookup user_sessions by session_id with session_status = active.

THE system SHALL compare token hash against stored refresh_token_hash.

WHEN token hash matches and session is active, THE system SHALL:
- Generate new refresh token hash
- Update refresh_token_hash and last_used_at on the session record
- Revoke old refresh token hash
- Sign new access token
- Sign new refresh token
- Set new cookies

IF token hash does not match, THE system SHALL mark session as compromised.

IF session is not found or not active, THE system SHALL clear cookies and return 401.

**Error Handling:**
- Invalid/expired refresh token: 401 Unauthorized
- Session compromised: 401 Unauthorized + clear cookies
- Session revoked/expired: 401 Unauthorized

### UC-AUTH-004 — Logout

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL identify current session from access token's session_id.

THE system SHALL update session session_status = revoked, revoked_at = now, revoked_reason = logout.

THE system SHALL clear access_token and refresh_token cookies.

THE system SHALL NOT delete the session record.

**Error Handling:**
- No valid session: 401 Unauthorized

### UC-AUTH-005 — Get Current User

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL extract user_id from access token.

THE system SHALL query users by id.

THE system SHALL return user id, email, account_status, onboarding_status, email_verified_at, last_login_at, created_at.

THE system SHALL NOT expose password_hash, sensitive tokens.

### UC-AUTH-006 — Verify Email

**Actor:** User with verification token.

**Functional Requirements:**

THE system SHALL accept token string.

THE system SHALL hash the token and look up security_tokens by hash + token_type = email_verification.

THE system SHALL reject IF token is expired (expires_at < now).

THE system SHALL reject IF token already used (used_at IS NOT NULL).

WHEN token is valid, THE system SHALL:
- Set security_tokens.used_at = now
- Set users.email_verified_at = now
- IF users.account_status = pending_email_verification, set account_status = active

**Error Handling:**
- Invalid token: 400 Bad Request
- Expired token: 410 Gone
- Already verified: 409 Conflict

### UC-AUTH-007 — Forgot Password

**Actor:** Unauthenticated user.

**Functional Requirements:**

THE system SHALL accept email.

THE system SHALL normalize email.

THE system SHALL look up user by email.

IF user exists AND account_status is active or pending_email_verification, THE system SHALL:
- Invalidate existing password reset tokens for this user
- Create new security_tokens record with token_type = password_reset
- Send password reset email (outside DB transaction)

IF user does not exist or account_status is suspended/banned/deleted, THE system SHALL return the same generic response as success case to prevent enumeration.

THE system SHALL always return: "If the email exists, a password reset link has been sent."

### UC-AUTH-008 — Reset Password

**Actor:** User with valid reset token.

**Functional Requirements:**

THE system SHALL accept token string and new password.

THE system SHALL hash the token and look up security_tokens by hash + token_type = password_reset.

THE system SHALL reject IF token expired or already used.

WHEN token is valid, THE system SHALL in a transaction:
- Mark security_tokens.used_at = now
- Update auth_identities.password_hash WHERE user_id = token's user AND provider = email (using updateMany, not update by id)
- Revoke all active user_sessions for this user with revoked_reason = password_reset

**Error Handling:**
- Invalid/expired token: 400 Bad Request

### UC-AUTH-009 — Logout All Devices

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL identify user_id from access token.

THE system SHALL update ALL active sessions for this user to session_status = revoked, revoked_reason = logout_all.

THE system SHALL clear cookies.

### UC-PROFILE-001 — Read Self Profile

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL query profiles by user_id from access token.

THE system SHALL return full profile including DOB and exact real_location for self only.

### UC-PROFILE-002 — Update Basic Profile

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL accept display_name, dob, gender, bio, job_title, company, school, height_cm, relationship_goal, lifestyle_json, interests_json.

THE system SHALL upsert profiles record.

THE system SHALL set dob_updated_at and gender_updated_at IF those fields change.

### UC-PROFILE-003 — Onboarding Persistence

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL evaluate onboarding eligibility against DB data:
- age >= 18
- profile has display_name, dob, gender
- at least 1 profile_photo with upload_status=confirmed AND moderation_status=approved AND deleted_at IS NULL
- user_locations has active real_location
- discovery_preferences exists
- user_privacy_settings exists
- account_status is not banned/suspended/deleted

IF all conditions met, THE system SHALL set users.onboarding_status = completed and onboarding_completed_at = now.

Email verification is NOT required for onboarding completion.

### UC-PROFILE-004 — Profile Photo Metadata Persistence

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL persist photo metadata (storage_provider, storage_key, public_url, mime_type, size_bytes, sort_order, is_avatar, upload_status, moderation_status).

THE system SHALL support soft delete (set deleted_at).

THE system SHALL NOT handle binary upload or storage infrastructure.

### UC-PROFILE-005 — Location Persistence

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL persist real_location as PostGIS geography(Point, 4326) via parameterized raw SQL.

THE system SHALL set active_location_mode = real.

THE system SHALL NOT implement passport_location runtime.

### UC-PROFILE-006 — Preferences/Privacy Persistence

**Actor:** Authenticated user.

**Functional Requirements:**

THE system SHALL upsert discovery_preferences (min_age, max_age, max_distance_km, preferred_genders).

THE system SHALL upsert user_privacy_settings (is_hidden, show_distance, show_online_status, show_last_active).

## 4. Route Constraints

ProfileController route ordering AFTER fix:
1. POST /profile/onboarding
2. GET /profile/me
3. PATCH /profile/basic-info
4. PATCH /profile/bio-interests
5. PATCH /profile/education-job
6. POST /profile/photos/presigned
7. POST /profile/photos/confirm
8. PUT /profile/photos/reorder
9. DELETE /profile/photos/:photoId
10. PATCH /profile/location
11. GET /profile/location/active
12. PATCH /profile/passport (existing route only — passport_location runtime behavior is out of scope; no new persistence logic)
13. GET /profile/:id (dynamic route MUST be last)

## 5. Clarifications

No open clarifications. All decisions are recorded in the plan.md Open Questions section if any remain.

## 6. Out of Scope

- Binary photo upload infrastructure
- Passport/fake location (existing route may remain baseline or return Not Implemented; no new persistence)
- Email sending implementation (assume EmailService exists)
- AuditLogService runtime
- Account status guard enforcement
- Discovery/Swipe/Match/Chat/Payment
- Schema changes
- Migration management
- Redis session storage
- CSRF protection
- Admin/moderator features

## 7. Acceptance Criteria

- [ ] Phase 1 spec is approved by reviewer.
- [ ] Build passes after each batch.
- [ ] Unit tests pass after each batch.
- [ ] E2E tests pass after each batch.
- [ ] No source-of-truth mismatch between code and spec.
- [ ] No legacy mock fields leak into Prisma-backed implementation.
- [ ] Auth flows persist to DB and survive restart.
- [ ] Profile flows persist to DB and survive restart.
