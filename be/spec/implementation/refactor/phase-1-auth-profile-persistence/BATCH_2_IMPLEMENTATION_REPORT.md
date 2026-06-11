# Batch 2 Implementation Report — Auth Repository Base

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Batch 2 — Auth repository Prisma refactor | Entire file |

---

## Files Changed

| File | Change |
|---|---|
| src/modules/auth/repositories/user.repository.ts | Replaced in-memory Map with Prisma users + auth_identities queries. Legacy fields computed from real columns. |
| src/modules/auth/repositories/auth-identity.repository.ts | Replaced in-memory Map with Prisma auth_identities queries. |
| src/modules/auth/repositories/session.repository.ts | Replaced in-memory Map with Prisma user_sessions queries. Added revoke/compromise methods. |
| src/modules/auth/repositories/security-token.repository.ts | Replaced in-memory Map with Prisma security_tokens queries. |
| src/modules/auth/auth.module.ts | Added DatabaseModule to imports. Registered AuthIdentityRepository and SecurityTokenRepository as providers. |
| spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md | T-002 through T-005 marked Completed. |

## Repository Changes

### UserRepository

**Prisma mapping:** users table + auth_identities (for password_hash lookup).

**Methods preserved:** create, findByEmail, findById, updatePasswordHash, setEmailVerified, softDelete, restore, setIsOnboarded, setIsHidden, indAll.

**Key design:**
- create() creates both users row and auth_identities row with provider=EMAIL
- Legacy fields computed from real columns:
  - isEmailVerified → email_verified_at != null
  - isOnboarded → onboarding_status == COMPLETED
  - isBanned → aaccount_status == BANNED
  - isPremium → false (out of scope)
  - isHidden → false (requires privacy settings join, out of scope)
- passwordHash read from auth_identities relation
- Methods accept optional 	x?: Prisma.TransactionClient for transactional use
- UserEntity interface preserved unchanged for service compatibility

### AuthIdentityRepository

**Prisma mapping:** auth_identities table.

**Methods preserved:** create, findByProvider, findByUserId, updatePasswordHash, deleteByUserId.

**Key design:**
- updatePasswordHash uses updateMany with userId + provider (avoids updating by wrong id)
- Returns mapped AuthIdentityEntity preserving existing interface

### SessionRepository

**Prisma mapping:** user_sessions table.

**Methods preserved:** create, findByTokenHash, findById, deleteById, deleteAllByUserId, updateTokenHash, wasTokenHashEverUsed.

**New methods added (for Batch 3):**
- findActiveById — find session with sessionStatus = ACTIVE
- revokeById — set sessionStatus = revokeD with reason
- revokeAllByUserId — batch-update all active sessions to revokeD
- markCompromised — set sessionStatus = COMPROMISED

**Key design:**
- create() generates refreshTokenFamilyId via crypto.randomUUID()
- Session revoke updates status fields, does NOT hard delete

### SecurityTokenRepository

**Prisma mapping:** security_tokens table.

**Methods preserved:** create, findByTokenHash, findByUserIdAndType, markUsed, deleteAllByUserId.

**New methods added (for Batch 4):**
- invalidateByUserIdAndType — deletes existing tokens of same type for user

**Key design:**
- create stores 	okenHash only (never raw token)
- Methods accept optional 	x?: Prisma.TransactionClient

## Compatibility Notes

- UserEntity preserved as-is with legacy computed fields (isEmailVerified, isOnboarded, isBanned, isPremium, isHidden)
- SessionEntity preserved as-is (maps ipHash → ipAddress for backward compat)
- AuthIdentityEntity preserved as-is
- SecurityTokenEntity preserved as-is
- VerificationTokenRepository and ResetPasswordTokenRepository remain unchanged (still in-memory mock) — will be migrated in Batch 4

## What Did Not Change

- AuthService, AuthController, TokenService, EmailService — not touched
- Token payload — not changed (still { sub, email })
- VerificationTokenRepository and ResetPasswordTokenRepository — not migrated yet
- Register/login/refresh/logout flow — not changed
- Prisma schema — not changed
- Migrations — not changed
- Profile/discovery/swipe/match modules — not touched
- No @ts-nocheck / @ts-ignore / @ts-expect-error added

## Commands Run

| Command | Result | Notes |
|---|---|---|
| 
px prisma generate | PASS | Prisma Client generated |
| 
pm run build | PASS | 0 errors |
| 
pm run test | PASS | 1 suite, 1 test |
| 
pm run test:e2e | Not run | Out of scope |

## Git Status

`
~ Modified (Batch 2):
  src/modules/auth/auth.module.ts
  src/modules/auth/repositories/user.repository.ts
  src/modules/auth/repositories/auth-identity.repository.ts
  src/modules/auth/repositories/session.repository.ts
  src/modules/auth/repositories/security-token.repository.ts
  spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md
`

(prisma.service.ts change is from Batch 1, other modified files are pre-existing from before Batch 1.)

## Scope Compliance

| Requirement | Status |
|---|---|
| Prisma schema unchanged | ✅ |
| Migrations unchanged | ✅ |
| Package files unchanged | ✅ |
| AuthService/controller/token flow changed | ❌ No — only repositories |
| Profile/discovery/swipe/match/chat/payment changed | ❌ No |
| Runtime TS suppressions added | ❌ None |
| Mock fallback added | ❌ None (removed in Batch 1) |
| Build passes | ✅ |
| Unit tests pass | ✅ |

## Known Issues / Deferred Work

1. VerificationTokenRepository and ResetPasswordTokenRepository still use in-memory Map — deferred to Batch 4.
2. AuthService still uses old SessionRepository.deleteById (hard delete) instead of revokeById (status update) — deferred to Batch 3.
3. AuthService still uses old UserRepository.updatePasswordHash by user id (looks up auth_identity internally) — fine, but updatePasswordHash now stores to aauth_identities table.
4. isPremium and isHidden always return false — proper implementation deferred to later phases.
5. AuthService email verification/reset flows still use VerificationTokenRepository and ResetPasswordTokenRepository (in-memory) — deferred to Batch 4.
6. UserRepository.create wraps user + auth_identity creation in a Prisma transaction (fixed in Batch 2F).

## Next Step

Batch 3 is not approved until reviewer reviews Batch 2.
