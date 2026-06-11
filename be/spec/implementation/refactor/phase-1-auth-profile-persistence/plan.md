# Phase 1 — Auth/Profile Persistence Plan

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial Phase 1 architecture plan | Entire file |

---

## 1. Phase Overview

Refactor Auth and Profile repositories from in-memory Map-based mocks to Prisma-backed persistence. This phase does NOT change the Prisma schema or run migrations. The existing 21-model Prisma schema is the target persistence layer.

**CRITICAL: Implementation MUST be done in small batches, not the whole phase at once. Each batch must pass build and tests before the next batch begins. No batch may be skipped. This plan defines 7 sequential batches.**

## 2. Current State Analysis

| Aspect | Current State |
|---|---|
| Auth repositories | 4 files: UserRepository (Map), SessionRepository (Map), VerificationTokenRepository (Map), ResetPasswordTokenRepository (Map). AuthIdentityRepository and SecurityTokenRepository exist as stubs. |
| Profile repositories | 4 files: ProfileRepository (Map), PhotoRepository (Map), LocationRepository (Map), UserPrivacySettingsRepository (empty stub). |
| Token payload | { sub, email } — no session_id, no token_type, no jti. |
| Session model | No refresh_token_family_id, no session_status, no rotation logic. |
| PrismaService | Catches DB failure and silently falls back to mock data. |
| Route order | @Get(':id') before static routes in ProfileController. |
| Legacy fields | UserEntity uses isEmailVerified, isOnboarded, isBanned, isPremium, isHidden. |

## 3. Target State

| Aspect | Target State |
|---|---|
| Auth repositories | All 6 repositories use Prisma for persistence. |
| Profile repositories | All 4 repositories use Prisma for persistence. |
| Token payload | Access: { sub, session_id, token_type }. Refresh: { sub, session_id, jti, token_type }. |
| Session model | Supports active/revoked/expired/compromised status and refresh token rotation. Full refresh token reuse detection across token families remains out of scope for Phase 1. |
| PrismaService | Fail-fast: throw on DB connection failure, no mock fallback. |
| Route order | Static routes declared before dynamic :id. |
| Legacy fields | Removed from code; use Prisma column mapping instead. |

## 4. In Scope

As defined by spec.md UC-AUTH-001 through UC-AUTH-009 and UC-PROFILE-001 through UC-PROFILE-006.

## 5. Out of Scope

As defined by spec.md section 6. No Discovery/Swipe/Match/Chat/Payment work. No passport_location runtime behavior (existing route may remain baseline). No schema changes.

## 6. Source of Truth

- spec/database/DATABASE_SOURCE_OF_TRUTH.md — Table specifications, business rules
- spec/database/POSTGRESQL_SCHEMA_V1.md — Logical PostgreSQL schema
- prisma/schema.prisma — Prisma mapping (21 models)
- spec/global/business-rules.md — BR-01 (auth), BR-02 (onboarding)
- spec/global/privacy-rules.md — Data visibility matrix
- spec/global/security.md — Token/cookie/session security
- spec/modules/auth/module.md — Auth module boundary
- spec/modules/profile/module.md — Profile module boundary
- BATCH_0_BASELINE_INSPECTION.md — Baseline findings, legacy fields, route collision

## 7. Affected Modules

- src/database/prisma.service.ts (fail-fast)
- src/modules/auth/repositories/* (all 6 files)
- src/modules/auth/services/token.service.ts (payload redesign)
- src/modules/auth/services/auth.service.ts (Prisma calls)
- src/modules/auth/strategies/jwt-access.strategy.ts (payload type)
- src/modules/auth/decorators/current-user.decorator.ts (type alignment)
- src/modules/auth/controllers/auth.controller.ts (no changes expected)
- src/modules/auth/auth.module.ts (provider registration)
- src/modules/profile/repositories/* (all 4 files)
- src/modules/profile/services/* (Prisma calls)
- src/modules/profile/controllers/profile.controller.ts (route ordering)

## 8. Proposed Architecture

### Repository Pattern (unchanged — swap implementation only)

`
Controller → Service → Repository (Prisma-backed)
`

Each repository receives PrismaService (or Prisma.TransactionClient for transactional operations) via constructor injection.

### Transaction Management

- **Controller** does NOT manage transactions.
- **Service layer** manages transactions using PrismaService.$transaction()
- **Repository** provides two overloads: one receiving PrismaService, one receiving Prisma.TransactionClient.
- Prisma.TransactionClient is typed and forwarded through repository methods.

### Dependency Injection

`
PrismaService (global)
    ↓
AuthService → UserRepository, SessionRepository, AuthIdentityRepository,
              VerificationTokenRepository, ResetPasswordTokenRepository
    ↓
AuthController
`

`
PrismaService (global)
    ↓
ProfileService → ProfileRepository
PhotoService → PhotoRepository
LocationService → LocationRepository
    ↓
ProfileController
`

## 9. Repository Refactor Strategy

Each repository swaps Map<String, Entity> for PrismaService calls:

| Current | Target |
|---|---|
| UserRepository | Prisma users table |
| AuthIdentityRepository | Prisma auth_identities table |
| SessionRepository | Prisma user_sessions table |
| VerificationTokenRepository | Prisma security_tokens table (token_type = email_verification) |
| ResetPasswordTokenRepository | Prisma security_tokens table (token_type = password_reset) |
| SecurityTokenRepository | Prisma security_tokens table (generic) |
| ProfileRepository | Prisma profiles table |
| PhotoRepository | Prisma profile_photos table |
| LocationRepository | Prisma user_locations table with PostGIS raw SQL |
| UserPrivacySettingsRepository | Prisma user_privacy_settings table |

### Legacy Field Mapping

| Legacy Field | Prisma Equivalent |
|---|---|
| isEmailVerified | email_verified_at IS NOT NULL |
| isOnboarded | onboarding_status = completed |
| isBanned | account_status = banned |
| isHidden | user_privacy_settings.is_hidden |
| isPremium | Future entitlement — do not fake |

## 10. Auth Flow Changes

### Token Payload Redesign

**Access Token:**
`ypescript
interface AccessTokenPayload {
  sub: string;        // user_id
  session_id: string; // session UUID
  token_type: 'access';
}
`

**Refresh Token:**
`ypescript
interface RefreshTokenPayload {
  sub: string;        // user_id
  session_id: string; // session UUID
  jti: string;        // unique token ID
  token_type: 'refresh';
}
`

Remove email from both token payloads.

### Session Management

- Login: create user_sessions row with refresh_token_hash, refresh_token_family_id, session_status = active, expires_at.
- Refresh: lookup session by session_id, compare hash, rotate hash, update last_used_at.
- Logout: set session_status = revoked, revoked_reason = logout.
- Logout all: batch-update all active sessions to revoked.

## 11. Profile Flow Changes

- ProfileRepository uses Prisma profiles table, maps displayName to display_name.
- PhotoRepository uses Prisma profile_photos table, maps metadata fields.
- LocationRepository uses parameterized raw SQL for PostGIS geography(Point, 4326) inserts/updates. No string concatenation of lat/lng.
- UserPrivacySettingsRepository uses Prisma user_privacy_settings table.
- discovery_preferences table is used by a dedicated repository (to be created or added to existing scope).

## 12. Transaction Boundaries

### UC-AUTH-001 (Register)

`
prisma.$transaction([
  users.create,
  auth_identities.create,
  discovery_preferences.create,
  user_privacy_settings.create,
  security_tokens.create (email_verification),
])
`

Email sending happens AFTER transaction commits (outside).

### UC-AUTH-006 (Verify Email)

`
prisma.$transaction([
  security_tokens.update (set used_at),
  users.update (set email_verified_at, possibly account_status),
])
`

### UC-AUTH-008 (Reset Password)

`
prisma.$transaction([
  security_tokens.update (set used_at),
  auth_identities.updateMany (password_hash by user_id + provider=email),
  user_sessions.updateMany (revoke all for user),
])
`

### UC-PROFILE-002/003

Minimal transaction scope around profile upsert + optional onboarding status update.

## 13. Security & Privacy Requirements

- Token payload must not contain email, password_hash, or role details.
- No sensitive data logged: tokens, passwords, password hashes, raw lat/lng.
- Forgot password: identical response regardless of whether email exists.
- Logout does not delete session — only revokes (audit trail).
- Exact location stored in DB but never exposed to other users.
- PostGIS queries use parameterized SQL, never string interpolation.

## 14. Route Collision Fix

Reorder ProfileController decorators so that @Get(':id') is the LAST declared route:

```ts
@Post('onboarding')
@Get('me')
@Patch('basic-info')
@Patch('bio-interests')
@Patch('education-job')
@Post('photos/presigned')
@Post('photos/confirm')
@Put('photos/reorder')
@Delete('photos/:photoId')
@Patch('location')
@Get('location/active')
@Patch('passport') // existing route — no new passport_location runtime logic in Phase 1
@Get(':id') // dynamic param LAST
```

## 15. Mock Fallback Removal

src/database/prisma.service.ts: remove try-catch that swallows DB connection errors. If $connect() fails, the exception propagates. This is done in Batch 1 before any repository swap.

## 16. Session Identification Strategy

- Access token embeds session_id at signing time.
- Controllers extract session_id from CurrentUser decorator (which decodes the access token).
- AuthService receives session_id from AuthController (extracted from access token payload).
- Logout: service uses session_id to identify which session to revoke.

## 17. Testing Strategy

### Unit Tests
- Repository unit tests: mock PrismaService, verify correct Prisma calls.
- Service unit tests: mock repositories, verify business logic.
- Token service: verify payload structure, signing, verification.

### Integration Tests
- Auth flow: register → verify → login → refresh → logout → logout-all.
- Profile flow: create → read → update.

### E2E Tests
- Existing 5 e2e test suites must continue to pass.
- Auth e2e tests cover cookie behavior.

## 18. Manual Verification Plan

After Batch 3 (token/session/login/logout):
- Start server, verify cookies set on login.
- Verify refresh token rotation by inspecting DB sessions.
- Verify logout revokes session.

After Batch 4 (register/verify/reset):
- Register user, confirm DB records.
- Verify email, confirm status change in DB.
- Reset password, confirm hash change in DB.

After Batch 5-7:
- Create profile, confirm DB row.
- Upload photo metadata, confirm DB row.
- Update location, confirm PostGIS point in DB.

## 19. Risks

| Risk | Mitigation |
|---|---|
| Build breaks mid-batch | Each batch must pass build before proceeding |
| E2E tests fail | Run after each batch; fix before proceeding |
| PostGIS raw SQL errors | Parameterized queries, test with real DB |
| Token payload change breaks existing tokens | Short access token TTL (15m); refresh tokens rotate |
| Transaction complexity in register | Keep transaction scope minimal, email outside |
| Legacy field mapping errors | Explicit mapping documented in code comments |

## 20. Open Questions

1. **CSRF strategy:** Double Submit Cookie vs custom header? Not in Phase 1 scope — defer.
2. **Account status guard enhancement:** Not in Phase 1 scope — defer to later phase.
3. **DiscoveryPreferencesRepository:** Create as new file or add existing? Decision: create discovery-preferences.repository.ts within profile module in Batch 6.

## 21. User Review Required

Before each batch proceeds, reviewer must approve:
- Batch spec compliance
- Build/test results
- No scope creep

## 22. CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial Phase 1 plan | Entire file |
