# Batch 3A Implementation Report — Token Payload Compatibility

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Batch 3A — Token payload type compatibility | Entire file |

---

## Files Changed

| File | Change |
|---|---|
| src/modules/auth/repositories/session.repository.ts | Step 1 cleanup: deleteAllByUserId now revokes instead of hard delete |
| src/modules/auth/services/token.service.ts | Added TokenType, extended JwtPayload with session_id/token_type/jti; added AccessTokenPayload/RefreshTokenPayload types |
| src/modules/auth/strategies/jwt-access.strategy.ts | validate() returns sessionId and tokenType when present |
| src/modules/auth/decorators/current-user.decorator.ts | AuthUser extended with optional sessionId and tokenType fields |
| spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md | T-007 marked Partially completed (Batch 3A) |
| spec/implementation/refactor/phase-1-auth-profile-persistence/BATCH_2_IMPLEMENTATION_REPORT.md | Step 1 cleanup: fixed deleteById/deleteAllByUserId description |

## Step 1 Cleanup Summary

- **SessionRepository.deleteAllByUserId** — changed from deleteMany to updateMany with sessionStatus: REVOKED
- **deleteById** — already used update with REVOKED (verified in Batch 2F)
- **tasks.md** — T-001 to T-005 confirmed Completed
- **BATCH_2_IMPLEMENTATION_REPORT.md** — corrupted text cleaned, hard-delete compatibility noted

## Token Payload Changes

### TokenService types

`	ypescript
type TokenType = 'access' | 'refresh';

interface JwtPayload {
  sub: string;
  email?: string;
  session_id?: string;
  token_type?: TokenType;
  jti?: string;
}

interface AccessTokenPayload {
  sub: string;
  session_id: string;
  token_type: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  session_id: string;
  jti: string;
  token_type: 'refresh';
}
`

### JwtAccessStrategy validate()

Returns { userId, email?, sessionId?, tokenType? } from token payload.

### CurrentUser decorator

AuthUser now has sessionId?: string and 	okenType?: 'access' | 'refresh'.

## Backward Compatibility

- Legacy { sub, email } payload still works — email, session_id, 	oken_type, and jti are all optional in JwtPayload
- signAccessToken() and signRefreshToken() accept both old and new payload shapes
- erifyRefreshToken() returns the extended JwtPayload with optional fields
- AuthService calls unchanged — continues to pass { sub, email } to sign methods
- No token rejection for missing session_id — enforcement deferred to Batch 3B

## What Did Not Change

- AuthService token issuing flow not changed
- Login/session creation flow not changed
- Refresh rotation not changed
- Register flow not changed
- Prisma schema not changed
- Migrations not changed

## Commands Run

| Command | Result | Notes |
|---|---|---|
| 
px prisma generate | PASS | Prisma Client generated (no schema change) |
| 
pm run build | PASS | 0 errors |
| 
pm run test | PASS | 1 suite, 1 test |
| git status --short | 4 files modified in Step 2 + pre-existing Batch 1/2 changes |

## Scope Compliance

| Requirement | Status |
|---|---|
| Prisma schema unchanged | ✅ |
| Migrations unchanged | ✅ |
| Package files unchanged | ✅ |
| AuthService/controller unchanged | ✅ |
| Auth business flows unchanged | ✅ |
| Profile/discovery/swipe/match/chat/payment unchanged | ✅ |
| Runtime TS suppressions added | ❌ None |
| Hard delete user_sessions remains | ❌ None — all revoke |

## Next Step

Batch 3B — Login creates DB session first, then issues session-aware access/refresh tokens.
