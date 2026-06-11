# Phase 1 — Auth/Profile Persistence Tasks

## CHANGELOG & REVISION HISTORY

| Date       | Change Summary                 | Sections Changed |
| ---------- | ------------------------------ | ---------------- |
| 2026-06-11 | Initial Phase 1 task breakdown | Entire file      |

---

## Global Constraints

All tasks in this phase MUST follow these constraints:

- No Prisma schema changes.
- No migration changes.
- Do not run prisma migrate.
- No Discovery/Swipe/Match/Chat/Payment work.
- No passport_location runtime behavior.
- No new binary upload flow.
- No fake runtime EmailService.
- No fake AuditLogService.
- No @ts-nocheck / @ts-ignore / @ts-expect-error.
- No regex fix scripts.
- Do not alter files outside the listed scope.

---

## Batch 1 — PrismaService Fail-Fast

### T-001 — Make PrismaService fail-fast on DB connection failure

**Related UC:**

- None (infrastructure)

**Status:** Completed
**Priority:** P0
**Risk:** Low
**Depends on:** None

**Files likely changed:**

- src/database/prisma.service.ts

**Goal:**
Remove the silent catch that allows the app to continue with mock data when DB connection fails. Replace with fail-fast behavior.

**Implementation notes:**

- Remove the try-catch wrapping this.$connect() in onModuleInit.
- Let $connect() throw naturally if DB is unreachable.
- Keep the existing log line for successful connection.
- Do not change any other behavior.

**Acceptance criteria:**

- [ ] prisma.service.ts no longer catches DB connection errors.
- [ ] App fails to start if DB is unreachable (NestJS lifecycle prevents boot).
- [ ] Build passes.
- [ ] Unit tests pass.
- [ ] E2E tests pass.

**Verification:**

- Start app without DB → must crash on startup.
- Start app with DB → must start normally.

---

## Batch 2 — Auth Repository Base

### T-002 — Implement UserRepository with Prisma

**Related UC:**

- UC-AUTH-001, UC-AUTH-002, UC-AUTH-005

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-001

**Files likely changed:**

- src/modules/auth/repositories/user.repository.ts

**Goal:**
Replace in-memory Map storage with Prisma users table. Remove legacy fields (isEmailVerified, isOnboarded, isBanned, isPremium, isHidden). Map to Prisma columns via helper methods.

**Implementation notes:**

- Inject PrismaService via constructor.
- Implement findByEmail, findById, create, updateAccountStatus, setEmailVerified, setOnboardingCompleted.
- Use helper methods to convert between Prisma users and service-facing DTOs.
- Legacy field mapping: isEmailVerified → email_verified_at != null, isOnboarded → onboarding_status == completed, isBanned → account_status == banned, isHidden → user_privacy_settings.is_hidden.
- Do NOT implement isPremium — it has no Prisma equivalent.

**Acceptance criteria:**

- [ ] UserRepository uses Prisma, not Map.
- [ ] All existing method signatures preserved.
- [ ] Build passes.
- [ ] Tests pass (existing unit/e2e).

**Verification:**

- Build passes.
- E2E tests that transitively use auth still pass.

### T-003 — Implement AuthIdentityRepository with Prisma

**Related UC:**

- UC-AUTH-001, UC-AUTH-002, UC-AUTH-008

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-001

**Files likely changed:**

- src/modules/auth/repositories/auth-identity.repository.ts

**Goal:**
Replace empty stub with Prisma-backed repository for auth_identities table.

**Implementation notes:**

- Inject PrismaService.
- Implement create, findByProvider, findByUserId, updatePasswordHash, deleteByUserId.
- updatePasswordHash must update by user_id + provider = email using updateMany and verify affected count.

**Acceptance criteria:**

- [ ] AuthIdentityRepository uses Prisma.
- [ ] Build passes.

**Verification:**

- Build passes.

### T-004 — Implement SessionRepository with Prisma

**Related UC:**

- UC-AUTH-002, UC-AUTH-003, UC-AUTH-004, UC-AUTH-009

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-001

**Files likely changed:**

- src/modules/auth/repositories/session.repository.ts

**Goal:**
Replace in-memory Map with Prisma-backed user_sessions table. Add proper session lifecycle fields.

**Implementation notes:**

- Implement create, findById, findByUserId, updateTokenHash,
  evokeById,
  evokeAllByUserId, markCompromised.
- Session status enum: active, revoked, expired, compromised.
- On create: generate
  refresh_token_family_id, store hash, set session_status = active.

**Acceptance criteria:**

- [ ] SessionRepository uses Prisma.
- [ ] Build passes.

**Verification:**

- Build passes.

### T-005 — Implement SecurityTokenRepository with Prisma

**Related UC:**

- UC-AUTH-006, UC-AUTH-007, UC-AUTH-008

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-001

**Files likely changed:**

- src/modules/auth/repositories/security-token.repository.ts

**Goal:**
Replace empty stub with Prisma-backed repository for security_tokens table. The VerificationTokenRepository and ResetPasswordTokenRepository will be refactored to use this common repository, or merged.

**Implementation notes:**

- Implement create, findByTokenHash, findByUserIdAndType, markUsed, deleteAllByUserId.
- token_type identifies purpose: email_verification, password_reset, account_restore.

**Acceptance criteria:**

- [ ] SecurityTokenRepository uses Prisma.
- [ ] Build passes.

**Verification:**

- Build passes.

### T-006 — Refactor VerificationTokenRepository / ResetPasswordTokenRepository

**Related UC:**

- UC-AUTH-006, UC-AUTH-007, UC-AUTH-008

**Status:** Completed
**Priority:** P0
**Risk:** Low
**Depends on:** T-005

**Files likely changed:**

- src/modules/auth/repositories/verification-token.repository.ts
- src/modules/auth/repositories/reset-password-token.repository.ts

**Goal:**
These two repositories currently work as wrappers around a Map. Refactor them to delegate to SecurityTokenRepository (Prisma), or convert them to use Prisma directly if they serve distinct queries.

**Acceptance criteria:**

- [ ] Both repositories delegate to SecurityTokenRepository (or use Prisma directly).
- [ ] Build passes.

**Verification:**

- Build passes.

---

## Batch 3 — Token/Session/Login/Logout

### T-007 — Redesign TokenService payload

**Related UC:**

- UC-AUTH-002, UC-AUTH-003, UC-AUTH-004, UC-AUTH-009

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-004

**Files likely changed:**

- src/modules/auth/services/token.service.ts
- src/modules/auth/strategies/jwt-access.strategy.ts
- src/modules/auth/decorators/current-user.decorator.ts

**Goal:**
Change token payload from { sub, email } to new format. Access token: { sub, session_id, token_type }. Refresh token: { sub, session_id, jti, token_type }.

**Implementation notes:**

- Remove email from payload (security improvement).
- Add session_id field. Login flow must create session first, then sign tokens with the session_id.
- Add jti to refresh token for replay detection.
- Update JwtAccessStrategy to validate new payload shape.
- Update CurrentUser decorator and AuthUser type to expose session_id.

**Acceptance criteria:**

- [x] Access token payload contains sub, session_id, token_type.
- [x] Refresh token payload contains sub, session_id, jti, token_type.
- [x] Email may remain in token payload temporarily for legacy compatibility; session_id and token_type are now present.
- [x] Build passes.

**Verification:**

- Build passes (Batch 3A).
- Integration: decode tokens after login, verify payload shape.

### T-008 — Implement login with session creation

**Related UC:**

- UC-AUTH-002

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-002, T-003, T-004, T-007

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Update login flow to use Prisma-backed repositories and create a proper user_sessions record with refresh token hash.

**Implementation notes:**

- Look up user via UserRepository (Prisma).
- Validate password.
- Check account_status: reject suspended/banned/deleted with generic failure.
- Allow pending_email_verification users (do not block by email verification).
- Create session via SessionRepository.create() with placeholder hash.
- Generate jti with crypto.randomUUID().
- Sign access token with session_id and token_type.
- Sign refresh token with session_id, jti, and token_type.
- Hash actual refresh token and update session with real hash.
- Set HTTP-only cookies.

**Acceptance criteria:**

- [x] Login creates user_sessions record in DB.
- [x] Session has refresh_token_hash (SHA-256 hash, not raw token).
- [x] Access token includes session_id.
- [x] Refresh token includes session_id and jti.
- [x] Login blocked for banned/suspended/deleted with generic error.
- [x] Login allowed for pending_email_verification.
- [x] Cookies set correctly.
- [x] Build passes, tests pass.

**Verification:**

- Manual: login via API, check DB for session row (Batch 3B completed).
- Decode tokens and verify session_id and jti present.

### T-009 — Implement logout (revoke current session)

**Related UC:**

- UC-AUTH-004

**Status:** Completed
**Priority:** P0
**Risk:** Low
**Depends on:** T-008

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Update logout flow to revoke the current session (identified by session_id from access token) rather than delete it.

**Implementation notes:**

- Extract session_id from CurrentUser decorator.
- Call SessionRepository.revokeById() with revoked_reason = logout.
- Clear cookies.

**Acceptance criteria:**

- [x] Logout sets session_status = revoked in DB.
- [x] Session record is not deleted.
- [x] Build passes, tests pass.

### T-010 — Implement logout all devices

**Related UC:**

- UC-AUTH-009

**Status:** Completed
**Priority:** P0
**Risk:** Low
**Depends on:** T-008

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Revoke all active sessions for current user.

**Implementation notes:**

- Extract user_id from access token.
- Call SessionRepository.revokeAllByUserId() with revoked_reason = logout_all.

**Acceptance criteria:**

- [x] All user sessions set to revoked in DB.
- [x] Build passes, tests pass.

### T-011 — Implement refresh token rotation

**Related UC:**

- UC-AUTH-003

**Status:** Completed
**Priority:** P0
**Risk:** High
**Depends on:** T-004, T-007

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Implement secure refresh token rotation: verify old token, rotate hash, issue new tokens.

**Implementation notes:**

- Extract session_id and jti from refresh token payload.
- Look up session by session_id.
- Compare old refresh token hash against refresh_token_hash.
- If match: generate new hash, update refresh_token_hash and last_used_at.
- If no match: mark session as compromised (full family detection is out of scope for Phase 1).
- Sign new access and refresh tokens.

**Acceptance criteria:**

- [x] Refresh endpoint validates old token hash.
- [x] Refresh endpoint updates hash in DB.
- [x] Token replay detected → session marked compromised (deferred to Phase 3D/family detection - currently rejects with generic error).
- [x] Build passes, tests pass.

**Verification:**

- Manual: refresh token, verify new hash in DB. Use old token again → session compromised.

---

## Batch 4 — Register + Verify/Reset

### T-012 — Implement register transaction

**Related UC:**

- UC-AUTH-001

**Status:** Completed
**Priority:** P0
**Risk:** High
**Depends on:** T-002, T-003, T-005

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Update register flow to create all initial records in a single DB transaction.

**Implementation notes:**

- Use PrismaService.$transaction() to create: users, auth_identities, discovery_preferences, user_privacy_settings, security_tokens (email_verification).
- Email sending must happen OUTSIDE the transaction, after commit.
- Handle ConflictException for duplicate email from Prisma unique constraint.
- Map auth_identities.provider_user_id = normalized email.

**Acceptance criteria:**

- [x] Register creates 5 DB records in a transaction.
- [x] Transaction rolls back on any failure.
- [x] Build passes, tests pass.

**Verification:**

- Manual: register, verify all 5 rows in DB. Kill connection mid-transaction → verify no partial insert.

### T-013 — Implement verify email

**Related UC:**

- UC-AUTH-006

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-005

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Update verify email flow to use Prisma-backed SecurityTokenRepository and update user status in a transaction.

**Implementation notes:**

- Hash input token, look up in security_tokens by hash + type.
- Check expires_at and used_at.
- In transaction: set used_at, update email_verified_at, update account_status if pending.

**Acceptance criteria:**

- [x] Verify email marks token used, sets email_verified_at, updates account_status.
- [x] Build passes, tests pass.

### T-014 — Implement forgot/reset password

**Related UC:**

- UC-AUTH-007, UC-AUTH-008

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-002, T-003, T-005

**Files likely changed:**

- src/modules/auth/services/auth.service.ts

**Goal:**
Update forgot and reset password flows to use Prisma repositories.

**Implementation notes:**

- Forgot: look up user, invalidate old reset tokens, create new security token, send email.
- Reset: hash token, validate, in transaction mark token used, update auth_identities.password_hash by user_id + provider = email using updateMany.
- Revoke all sessions after password reset.

**Acceptance criteria:**

- [x] Forgot password creates security_token in DB.
- [x] Reset password updates correct auth_identity row.
- [x] Reset password revokes all sessions.
- [x] Build passes, tests pass.

---

## Batch 5 — Profile Base

### T-015 — Implement ProfileRepository with Prisma

**Related UC:**

- UC-PROFILE-001, UC-PROFILE-002

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-001

**Files likely changed:**

- src/modules/profile/repositories/profile.repository.ts
- src/modules/profile/dto/profile.dto.ts (if type alignment needed)

**Goal:**
Replace in-memory Map with Prisma profiles table. Map fullName to display_name.

**Implementation notes:**

- Inject PrismaService.
- Implement findByUserId, create, update.
- Map fullName → display_name in create/update.
- Profile service already uses these methods; ensure backward compatibility.

**Acceptance criteria:**

- [x] ProfileRepository uses Prisma.
- [x] Build passes.

### T-016 — Update ProfileService for Prisma reads

**Related UC:**

- UC-PROFILE-001, UC-PROFILE-002

**Status:** Completed
**Priority:** P0
**Risk:** Low
**Depends on:** T-015

**Files likely changed:**

- src/modules/profile/services/profile.service.ts

**Goal:**
Ensure ProfileService calls align with Prisma-backed repository. No behavior change.

**Acceptance criteria:**

- [x] ProfileService reads/writes through Prisma.
- [x] Build passes, e2e passes.

---

## Batch 6 — Photo/Location/Preferences

### T-017 — Implement PhotoRepository with Prisma

**Related UC:**

- UC-PROFILE-004

**Status:** Completed
**Priority:** P1
**Risk:** Medium
**Depends on:** T-001

**Files likely changed:**

- src/modules/profile/repositories/photo.repository.ts

**Goal:**
Replace in-memory Map with Prisma profile_photos table. Support metadata persistence, soft delete, ordering.

**Implementation notes:**

- Implement create, ffindByUserId, updateOrder, softDelete, setAvatar.
- Map existing entity fields to Prisma columns.
- Keep existing service interface compatible.

**Acceptance criteria:**

- [x] PhotoRepository uses Prisma.
- [x] Build passes.

### T-018 — Implement LocationRepository with Prisma + PostGIS

**Related UC:**

- UC-PROFILE-005

**Status:** Completed
**Priority:** P1
**Risk:** High
**Depends on:** T-001

**Files likely changed:**

- src/modules/profile/repositories/location.repository.ts

**Goal:**
Replace in-memory Map with Prisma user_locations table using PostGIS geography(Point, 4326) via parameterized raw SQL.

**Implementation notes:**

- Use PrismaService.$transaction() or $executeRawUnsafe() with parameterized values.
- PostGIS SQL pattern: ST_SetSRID(ST_MakePoint(, ), 4326)::geography(Point, 4326).
- Never concatenate lat/lng into SQL strings.
- active_location_mode = real for Phase 1.
- Do NOT implement passport_location runtime logic (existing route may remain baseline).

**Acceptance criteria:**

- [x] LocationRepository uses Prisma + PostGIS.
- [x] No string concatenation of lat/lng.
- [x] Build passes.

**Verification:**

- Manual: call location update, verify geography point in DB via ST_AsText().

### T-019 — Implement DiscoveryPreferencesRepository with Prisma

**Related UC:**

- UC-PROFILE-006

**Status:** Completed
**Priority:** P1
**Risk:** Low
**Depends on:** T-001

**Files likely changed:**

- src/modules/profile/repositories/discovery-preferences.repository.ts (new file)

**Goal:**
Create Prisma-backed repository for discovery_preferences table.

**Implementation notes:**

- Inject PrismaService.
- Implement findByUserId, upsert.

**Acceptance criteria:**

- [x] DiscoveryPreferencesRepository uses Prisma.
- [x] Build passes.

### T-020 — Implement UserPrivacySettingsRepository with Prisma

**Related UC:**

- UC-PROFILE-006

**Status:** Completed
**Priority:** P1
**Risk:** Low
**Depends on:** T-001

**Files likely changed:**

- src/modules/profile/repositories/user-privacy-settings.repository.ts

**Goal:**
Replace empty stub with Prisma-backed repository for user_privacy_settings table.

**Implementation notes:**

- Implement findByUserId, upsert.

**Acceptance criteria:**

- [x] UserPrivacySettingsRepository uses Prisma.
- [x] Build passes.

---

## Batch 7 — Onboarding + Route Collision + Cleanup

### T-021 — Implement onboarding evaluator using DB

**Related UC:**

- UC-PROFILE-003

**Status:** Completed
**Priority:** P0
**Risk:** Medium
**Depends on:** T-015, T-017, T-018, T-019, T-020

**Files likely changed:**

- src/modules/profile/services/profile.service.ts

**Goal:**
Update onboarding evaluator to check all conditions against Prisma-backed data.

**Implementation notes:**

- Check: age >= 18 (from profiles.dob), profile exists, at least one approved photo, active real location exists, discovery_preferences exists, user_privacy_settings exists, account_status is not banned/suspended/deleted.
- Email verification is NOT required for onboarding.
- Set users.onboarding_status = completed + onboarding_completed_at if all conditions met.

**Acceptance criteria:**

- [x] Onboarding evaluator checks all conditions via DB.
- [x] Onboarding sets correct fields when all conditions met.
- [x] Build passes, tests pass.

### T-022 — Fix ProfileController route ordering

**Related UC:**

- None (bug fix)

**Status:** Planned
**Priority:** P0
**Risk:** Low
**Depends on:** T-015

**Files likely changed:**

- src/modules/profile/controllers/profile.controller.ts

**Goal:**
Reorder route decorators so static routes are declared before dynamic @Get(':id').

**Implementation notes:**

- Move @Get(':id') to the bottom of the controller.
- Ensure existing interceptors/guards still apply.

**Acceptance criteria:**

- [ ] GET /profile/location/active resolves correctly.
- [ ] GET /profile/:id only captures after all static routes.
- [ ] Build passes, e2e passes.

### T-023 — Clean up legacy mock leftovers from Auth and Profile

**Related UC:**

- None (cleanup)

**Status:** Planned
**Priority:** P1
**Risk:** Low
**Depends on:** T-002, T-003, T-004, T-005, T-015, T-017, T-018, T-019, T-020

**Files likely changed:**

- Various in src/modules/auth/ and src/modules/profile/

**Goal:**
Remove any runtime mock leftovers that are no longer needed after all repositories use Prisma. Test mocks may remain.

**Implementation notes:**

- Verify no file in auth/profile still references Map-based storage.
- Remove dead code paths that used mock fallback.
- Keep test mocks.

**Acceptance criteria:**

- [ ] No runtime mock code in auth/profile repositories.
- [ ] Build passes, tests pass.
# # #   B a t c h   6 F      F i n a l   S t a b i l i t y   F i x   B e f o r e   P h a s e   1   C o m m i t 
 
 * * S t a t u s : * *   C o m p l e t e d 
 
 * * D e f e r r e d   i t e m s   r e m a i n   d o c u m e n t e d   a n d   n o t   m a r k e d   c o m p l e t e d : * * 
 -   . e n v / k e y / S M T P   c o n f i g 
 -   p r o d u c t i o n   e m a i l   l o g g i n g   p o l i c y 
 -   d i s c o v e r y   f e e d 
 -   d i s c o v e r a b i l i t y   f i l t e r i n g 
 -   S 3 / u p l o a d 
 -   J W T   D B   s e s s i o n   v a l i d a t i o n 
 -   G o o g l e   O A u t h   p e r s i s t e n c e 
 -   a n o n y m i z a t i o n   j o b 
  
 # # #   B a t c h   6 G      R e s t o r e   A c c o u n t   +   S o f t   D e l e t e   T r a n s a c t i o n   F i x 
 
 * * S t a t u s : * *   C o m p l e t e d 
 
 * * D e f e r r e d   i t e m s   r e m a i n   d o c u m e n t e d : * * 
 -   p u b l i c   r e s t o r e   t o k e n / e m a i l   f l o w 
 -   a n o n y m i z a t i o n   j o b 
 -   p e r m a n e n t   d e l e t e 
 -   J W T   D B   s e s s i o n   v a l i d a t i o n 
 -   d i s c o v e r y   f e e d 
 -   S 3 / u p l o a d 
  
 # # #   B a t c h   6 H      P e n d i n g   R e s t o r e   A c c e s s   B o u n d a r y   F i x 
 
 * * S t a t u s : * *   C o m p l e t e d 
 
 * * D e f e r r e d   i t e m s   r e m a i n   d o c u m e n t e d : * * 
 -   p u b l i c   r e s t o r e   t o k e n / e m a i l   f l o w 
 -   a n o n y m i z a t i o n   j o b 
 -   p e r m a n e n t   d e l e t e 
 -   f u l l   J W T   D B   s e s s i o n   v a l i d a t i o n 
 -   d i s c o v e r y   f e e d 
 -   S 3 / u p l o a d 
  
 # # #   B a t c h   6 I      F i n a l   B u i l d - D r i v e n   R e p a i r   B e f o r e   P h a s e   1   C o m m i t 
 
 * * S t a t u s : * *   C o m p l e t e d 
 
 * * D e f e r r e d   i t e m s   r e m a i n   d o c u m e n t e d : * * 
 -   p u b l i c   r e s t o r e   t o k e n / e m a i l   f l o w 
 -   a n o n y m i z a t i o n   j o b 
 -   p e r m a n e n t   d e l e t e 
 -   f u l l   J W T   D B   s e s s i o n   v a l i d a t i o n 
 -   d i s c o v e r y   f e e d 
 -   S 3 / u p l o a d 
  
 