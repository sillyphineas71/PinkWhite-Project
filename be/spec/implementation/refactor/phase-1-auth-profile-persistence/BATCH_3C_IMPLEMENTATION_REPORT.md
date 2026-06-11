# Batch 3C Implementation Report — Logout Current + Logout All DB Session Revoke

## Files Changed

- `src/modules/auth/services/auth.service.ts`: Updated `login`, `logout` and `forceLogoutAll` methods.
- `src/modules/auth/controllers/auth.controller.ts`: Updated `logout` method to use `user.sessionId`.
- `spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md`: Updated statuses and wording.
- `spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_3B_IMPLEMENTATION_REPORT.md`: Updated report accuracy.

## Batch 3B-Fix Summary

- Login behavior is strictly limited to allowing ACTIVE and PENDING_EMAIL_VERIFICATION.
- Blocked SUSPENDED, BANNED, DELETED, and `deletedAt` users with a generic `UnauthorizedException('Email hoặc mật khẩu không chính xác')`.
- Prevented login status leak from banned/suspended accounts and removed `pendingRestore` response from login flow for soft-deleted accounts.
- Updated `tasks.md` to reflect accurate token payload legacy compatibility and correctly tracked task statuses.
- Updated `BATCH_3B_IMPLEMENTATION_REPORT.md` to document the fact that `issueTokens` is shared and to accurately state known limitations.

## Logout Current Changes

- The `logout` method uses `sessionId` from the authenticated user's context (passed via `AuthUser`).
- It verifies the session belongs to the current user.
- It revokes the session explicitly by updating `session_status = REVOKED` and `revoked_reason = 'logout'` using `SessionRepository.revokeById()`.
- It does not hard delete the session record.

## Logout All Changes

- The `forceLogoutAll` method revokes all active sessions for the current user using `SessionRepository.revokeAllByUserId()`.
- It sets `session_status = REVOKED` and `revoked_reason = 'logout_all'`.
- It does not hard delete any session record.

## SessionRepository Changes

- Ensured that session invalidation relies on the Prisma methods `revokeById` and `revokeAllByUserId`, satisfying the requirement to avoid `userSession.delete` or `deleteMany`. 

## What Did Not Change

- Refresh rotation not implemented
- Register transaction not implemented
- Email verification/reset password not migrated
- JWT DB session validation not implemented
- Prisma schema not changed
- Migrations not changed

## Known Limitation

Existing access tokens may remain valid until expiry if JwtAccessStrategy does not check session_status on every request.
Refresh-token protection will be improved in the refresh rotation batch.

## Commands Run

| Command | Result | Notes |
|---|---|---|
| `npx prisma generate` | Pass | Prisma Client generated successfully |
| `npm run build` | Pass | TypeScript compilation completed with no errors |
| `npm run test` | Pass | 1 test suite passed successfully |
| `git status --short` | Pass | Verified the scope of file changes |

## Git Status

```text
warning: in the working copy of 'be/scripts/generate-auth.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/scripts/generate-repos.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/spec/implementation/refactor/phase-1-auth-profile-persistence/checklists/requirements.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/spec/implementation/refactor/phase-1-auth-profile-persistence/plan.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/spec/implementation/refactor/phase-1-auth-profile-persistence/spec.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/src/modules/auth/repositories/auth-identity.repository.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'be/src/modules/auth/repositories/security-token.repository.ts', LF will be replaced by CRLF the next time Git touches it
 M CLAUDE.md
 A broken-diff-stat.txt
 A broken-phase1-implementation.patch
 A broken-status.txt
 A build_errors.txt
 M package-lock.json
 M package.json
 A scripts/generate-auth.js
 A scripts/generate-repos.js
 A spec/implementation/refactor/phase-1-auth-profile-persistence/checklists/requirements.md
 A spec/implementation/refactor/phase-1-auth-profile-persistence/plan.md
 A spec/implementation/refactor/phase-1-auth-profile-persistence/spec.md
 A spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md
 M src/database/prisma.service.ts
 M src/modules/auth/auth.module.ts
 M src/modules/auth/controllers/auth.controller.ts
 M src/modules/auth/decorators/current-user.decorator.ts
 A src/modules/auth/repositories/auth-identity.repository.ts
D  src/modules/auth/repositories/reset-password-token.repository.ts
 A src/modules/auth/repositories/security-token.repository.ts
 M src/modules/auth/repositories/session.repository.ts
 M src/modules/auth/repositories/user.repository.ts
D  src/modules/auth/repositories/verification-token.repository.ts
 M src/modules/auth/services/auth.service.ts
 M src/modules/auth/services/token.service.ts
 M src/modules/auth/strategies/jwt-access.strategy.ts
 R spec/implementation/refactor/phase-1-auth-profile-persistence/IMPLEMENTATION_REVIEW_SUMMARY.md -> src/modules/discovery/repositories/discovery-preferences.repository.ts
 A src/modules/profile/repositories/user-privacy-settings.repository.ts
 M test/discovery.e2e-spec.ts
 M test/match.e2e-spec.ts
 M test/profile.e2e-spec.ts
 M test/swipe.e2e-spec.ts
?? ../be.zip
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_1_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_2_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_3A_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_3B_IMPLEMENTATION_REPORT.md
?? spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_3C_IMPLEMENTATION_REPORT.md
?? src/modules/auth/repositories/reset-password-token.repository.ts
?? src/modules/auth/repositories/verification-token.repository.ts
```

## Scope Compliance

- All forbidden files were untouched.
- Did not change Prisma schema or run any migrations.
- Did not introduce `refresh token rotation` or `register transaction`.
- No new runtime TS suppressions added.

## Next Step

Batch 3D — Refresh token rotation.
