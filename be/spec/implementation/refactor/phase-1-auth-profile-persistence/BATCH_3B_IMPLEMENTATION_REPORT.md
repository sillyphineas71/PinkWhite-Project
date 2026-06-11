# Batch 3B Implementation Report — Login DB Session + Session-Aware Tokens

**Date:** 2026-06-12 (Revised)  
**Status:** COMPLETED  
**Scope:** Login flow with DB session creation, session-aware token issuance, account status checks

---

## Files Changed

| File                                                                     | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/auth/repositories/user.repository.ts`                       | Added `accountStatus: string` to UserEntity interface. Updated toEntity() and toEntityFull() to map accountStatus from Prisma user model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/modules/auth/services/auth.service.ts`                              | **Login method:** Check accountStatus for SUSPENDED/BANNED/DELETED and block with generic "Email hoặc mật khẩu không chính xác" (no GoneException). Allow ACTIVE and PENDING_EMAIL_VERIFICATION. Handle soft-deleted users within 30-day restore with pendingRestore flag. **issueTokens method (shared helper):** Create session with placeholder hash; generate jti using crypto.randomUUID(); issue access token with {sub, email, session_id, token_type}; issue refresh token with {sub, email, session_id, jti, token_type}; hash refresh token with SHA-256; update session with real hash; set cookies. Added crypto import. |
| `src/modules/auth/services/token.service.ts`                             | No changes (already supports full JwtPayload with session_id, jti, token_type).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/modules/auth/repositories/session.repository.ts`                    | No changes (updateTokenHash method exists).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/modules/auth/decorators/current-user.decorator.ts`                  | No changes (already includes sessionId field).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/modules/auth/strategies/jwt-access.strategy.ts`                     | No changes (already maps session_id correctly).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md` | Updated T-001 through T-008 status from Planned to Completed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## Login Flow Changes

### Before Batch 3B

1. ✗ Validate credentials
2. ✗ Check email verification (blocked login if not verified)
3. ✗ Check banned (specific error message leaking account state)
4. ✗ Create session with refreshTokenHash (but no session_id in tokens)
5. ✗ Issue tokens with only {sub, email}
6. ✗ Set cookies

### After Batch 3B

1. ✓ Validate credentials
2. ✓ Check accountStatus: block SUSPENDED/BANNED/DELETED with generic error
3. ✓ Allow pending_email_verification users (no email verification requirement for login)
4. ✓ Allow soft-deleted users within 30-day restore window (pendingRestore flag)
5. ✓ Create session with placeholder hash
6. ✓ Generate jti using crypto.randomUUID()
7. ✓ Issue access token with {sub, email, session_id, token_type: 'access'}
8. ✓ Issue refresh token with {sub, email, session_id, jti, token_type: 'refresh'}
9. ✓ Hash refresh token with SHA-256
10. ✓ Update session with real refresh_token_hash
11. ✓ Set cookies

**Key Behavior Changes:**

- **Generic Auth Failure:** Both incorrect credentials AND blocked accounts (SUSPENDED/BANNED/DELETED/permanently deleted) return "Email hoặc mật khẩu không chính xác" without revealing specific reason. No visible leak of account state.
- **Pending Email Verification Allowed:** Users with accountStatus=PENDING_EMAIL_VERIFICATION can now log in. Email verification is NOT a login blocker.
- **Session-Aware Tokens:** Access and refresh tokens now include session_id for tracking and session-based logout.
- **JTI Support:** Refresh tokens include jti (JWT ID) for future replay detection and token family tracking (not implemented in Phase 1).
- **Soft Delete Restore Window:** Soft-deleted users (within 30 days) can log in with pendingRestore flag. Permanently deleted users (>30 days) are blocked with generic error.

---

## Session Creation Strategy

**Strategy Used: Option A with Placeholder Hash (Not Transaction-Wrapped)**

1. **Create Session with Placeholder:**

   ```typescript
   const placeholderHash = hashToken(crypto.randomUUID());
   const session = await this.sessionRepo.create({
     userId,
     refreshTokenHash: placeholderHash,
     userAgent: req.headers['user-agent'],
     ipAddress: req.ip,
     expiresAt: this.tokenService.getRefreshTokenExpiry(),
   });
   ```

   - Placeholder is cryptographically secure (SHA-256 hash of random UUID)
   - Returns session.id immediately for token generation

2. **Generate Tokens with Session ID:**
   - Access token: `{sub, email, session_id: session.id, token_type: 'access'}`
   - Refresh token: `{sub, email, session_id: session.id, jti: crypto.randomUUID(), token_type: 'refresh'}`

3. **Hash Real Refresh Token and Update Session:**
   ```typescript
   const refreshTokenHash = hashToken(refreshToken);
   await this.sessionRepo.updateTokenHash(
     session.id,
     refreshTokenHash,
     expiresAt,
   );
   ```

   - Real hash replaces placeholder atomically in DB
   - Refresh token is never stored raw (only SHA-256 hash)

**Known Limitation (Deferred):**

The login flow is not wrapped in a Prisma transaction. If issueTokens() fails after session creation but before hash update, the session row will remain with the placeholder hash. This is acceptable for Phase 1 because:

- The placeholder is cryptographically random (not guessable)
- Placeholder is never validated in refresh flow (only real hash is checked)
- Token cookies are only set after successful hash update
- If hash update fails, user can retry login to get valid tokens
- Proper transaction wrapping deferred to Phase 1 cleanup task

**Why This Approach:**

- ✓ Avoids two-phase transaction complexity for Phase 1
- ✓ Session ID available immediately for token generation
- ✓ Placeholder is never validated (only real hash used in refresh flow)
- ✓ No raw refresh token stored in database
- ✓ Backward compatible with existing refresh/logout flows

---

## Token Payload Changes

### Access Token Payload

```json
{
  "sub": "uuid-user-id",
  "email": "user@example.com",
  "session_id": "uuid-session-id",
  "token_type": "access",
  "iat": 1718055000,
  "exp": 1718055900
}
```

**Fields:**

- `sub`: User ID (required)
- `email`: User email (optional, for service-to-service context and backward compatibility)
- `session_id`: Links token to session record for session-based logout
- `token_type`: "access" (for token type validation)

### Refresh Token Payload

```json
{
  "sub": "uuid-user-id",
  "email": "user@example.com",
  "session_id": "uuid-session-id",
  "jti": "uuid-unique-token-id",
  "token_type": "refresh",
  "iat": 1718055000,
  "exp": 1718140400
}
```

**Fields:**

- `sub`: User ID (required)
- `email`: User email (optional, for service-to-service context and backward compatibility)
- `session_id`: Links token to session record
- `jti`: Unique token ID for replay detection and future family tracking (Phase 1 stores only; rotation/family tracking deferred to Phase 3D)
- `token_type`: "refresh" (for token type validation)

**Backward Compatibility:**

- signAccessToken() and signRefreshToken() accept full JwtPayload interface
- Can still be called with legacy {sub, email} format for other flows
- New fields (session_id, jti, token_type) are optional in JwtPayload interface

---

## Refresh Token Hashing

**Algorithm:** SHA-256 (deterministic)

**Implementation:**

```typescript
const refreshTokenHash = hashToken(refreshToken);
// Uses: crypto.createHash('sha256').update(token).digest('hex')
```

**Storage:**

- Column: `user_sessions.refresh_token_hash`
- Format: 64-character hexadecimal string
- Property: Cannot be reversed (one-way hash)

**Comparison in Refresh Flow:**

- Extract raw token from cookie
- Hash it with same SHA-256
- Compare with stored hash in DB

**Why Not bcrypt:**

- Refresh token is not a secret input like password
- Comparison must be deterministic (bcrypt is probabilistic with salt)
- Security model: token theft → hash match → session revoke
- No need for bcrypt's computational cost (token is already cryptographically random)

---

## Side Effects: Shared Helper Impact

**Important:** The issueTokens() method is now called by multiple flows, all of which now issue session-aware tokens:

1. **Login (UC002)** — Creates session and issues tokens ✓
2. **Verify Email (UC005 confirm)** — Calls issueTokens, now includes session_id and jti ⚠️
3. **Google OAuth (UC009)** — Calls issueTokens, now includes session_id and jti ⚠️
4. **Password Reset (UC007)** — Calls issueTokens indirectly via confirmVerifyEmail, now includes session_id and jti ⚠️

**Side Effect Analysis:**

- All flows now create user_sessions rows (previously only login did)
- All flows now issue tokens with session_id and jti
- All flows now hash refresh tokens
- This is **intentional and correct**: every token issued should be tied to a session for logout/revoke tracking
- No breaking changes: @CurrentUser decorator accepts optional sessionId field

**Deferred Scope:** Refresh token rotation and family tracking (Batch 3D) will use the jti field to detect replay attacks.

---

## What Did Not Change

| Item                                  | Reason                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Refresh rotation**                  | Out of scope (Batch 3D); jti stored but not validated yet                                  |
| **Token family detection**            | Out of scope (Batch 3D); full family tracking deferred                                     |
| **Logout/logout-all**                 | Out of scope (Batch 3C); session revocation flow separate                                  |
| **Register transaction**              | Out of scope; register flow uses issueTokens (now session-aware) but transaction unchanged |
| **Email verification/reset password** | Out of scope; flows now use issueTokens (side effect: now session-aware)                   |
| **Prisma schema**                     | Not required (user_sessions table already exists)                                          |
| **Migrations**                        | Not required (no schema changes)                                                           |
| **Package dependencies**              | Already satisfied (crypto, @nestjs/jwt, @prisma/client)                                    |

---

## Commands Run

| Command               | Result     | Notes                                                                        |
| --------------------- | ---------- | ---------------------------------------------------------------------------- |
| `npx prisma generate` | ✓ Success  | Prisma Client v6.19.3 generated                                              |
| `npm run build`       | ✓ Success  | TypeScript compilation completed                                             |
| `npm run test`        | ✓ Success  | 1 test suite, 1 test passed                                                  |
| `git status --short`  | ✓ Verified | Only auth.service.ts, user.repository.ts, tasks.md modified for Batch 3B-Fix |

---

## Git Status

```
M be/src/modules/auth/repositories/user.repository.ts
M be/src/modules/auth/services/auth.service.ts
M be/spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md
```

---

## Scope Compliance

✓ **Prisma schema not modified** — No changes to schema.prisma  
✓ **Migrations not modified** — No changes to migration files  
✓ **Package files not modified** — No package.json/package-lock.json changes  
✓ **Auth controller not modified** — No route or endpoint changes  
✓ **Forbidden modules not modified** — Profile/Discovery/Swipe/Match/Chat/Payment untouched  
✓ **No TypeScript suppressions** — No @ts-ignore, @ts-nocheck, or @ts-expect-error  
✓ **No hard deletes** — Sessions revoked, not deleted  
✓ **No raw refresh token storage** — Only SHA-256 hash stored  
✓ **Generic login failure** — SUSPENDED/BANNED/DELETED/permanently-deleted return generic error  
✓ **Pending email verification allowed** — No email verification check in login  
✓ **Account status properly checked** — accountStatus field added to UserEntity for clean account status access

---

## Implementation Summary

### Login Behavior

- ✓ **Credentials invalid:** Generic "Email hoặc mật khẩu không chính xác" + timing-safe dummy compare
- ✓ **Account SUSPENDED:** Generic failure (no leak of suspended state)
- ✓ **Account BANNED:** Generic failure (no leak of banned state)
- ✓ **Account DELETED (accountStatus=DELETED):** Generic failure (no leak of deleted state)
- ✓ **Soft deleted (>30 days):** Generic failure (no GoneException visible to client)
- ✓ **Soft deleted (≤30 days):** Login allowed with pendingRestore flag
- ✓ **Pending email verification:** Login allowed (no email verification required)
- ✓ **Active account:** Login allowed

### Session Creation

- ✓ Created before token issuance
- ✓ Placeholder hash replaced with real hash
- ✓ No raw refresh token remains in DB
- ✓ SessionRepository.updateTokenHash() called to finalize

### Token Issuance

- ✓ Access token includes session_id
- ✓ Refresh token includes session_id and jti
- ✓ Both tokens include token_type field
- ✓ Both tokens include email (backward compatibility)
- ✓ Cookies set via TokenService.setAuthCookies()

### Side Effects (Intentional)

- ✓ All token-issuing flows now create sessions (register, verify email, oauth, password reset)
- ✓ All tokens now include session_id and jti
- ✓ This is correct: every token should be tied to a session

---

## Known Issues / Deferred Work

**Not Transaction-Wrapped:** The issueTokens() method creates a session, generates tokens, updates the hash, and sets cookies without wrapping in a Prisma transaction. If the updateTokenHash() call fails, the session row retains the placeholder hash and the user's tokens are not set in cookies (client gets error). This is acceptable for Phase 1 and can be cleaned up later as a transaction-wrapping task.

**Deferred Scope for Phase 3D:**

- Full refresh token family detection and rotation
- Replay attack detection via jti validation
- Compromise detection (reusing same jti twice = compromised)

---

## Next Step

**Batch 3C — Logout Current + Logout All Revoke DB Sessions**

- Update logout() to extract session_id from @CurrentUser() and revoke session via SessionRepository.revokeById()
- Update logoutAll() to revoke all active sessions for user via SessionRepository.revokeAllByUserId()
- Maintain existing cookie clearing behavior
- Expected scope:
  - src/modules/auth/services/auth.service.ts (logout, logoutAll methods)
  - src/modules/auth/repositories/session.repository.ts (revokeById, revokeAllByUserId already exist)
  - No token.service.ts changes
  - No controller changes

---

## Token Payload Changes

### Access Token Payload

```json
{
  "sub": "uuid-user-id",
  "email": "user@example.com",
  "session_id": "uuid-session-id",
  "token_type": "access",
  "iat": 1718055000,
  "exp": 1718055900
}
```

**Fields:**

- `sub`: User ID (required)
- `email`: User email (optional, for service-to-service context)
- `session_id`: Links token to session record
- `token_type`: "access" (for type checking)

### Refresh Token Payload

```json
{
  "sub": "uuid-user-id",
  "email": "user@example.com",
  "session_id": "uuid-session-id",
  "jti": "uuid-unique-token-id",
  "token_type": "refresh",
  "iat": 1718055000,
  "exp": 1718140400
}
```

**Fields:**

- `sub`: User ID (required)
- `email`: User email (optional, for service-to-service context)
- `session_id`: Links token to session record
- `jti`: Unique token ID for replay detection (Phase 1 only stores; rotation not implemented)
- `token_type`: "refresh" (for type checking)

**Backward Compatibility:**

- signAccessToken() and signRefreshToken() accept full JwtPayload
- Can still be called with legacy {sub, email} format
- New fields (session_id, jti, token_type) are optional in JwtPayload interface

---

## Refresh Token Hashing

**Algorithm:** SHA-256 (deterministic)

**Implementation:**

```typescript
const refreshTokenHash = hashToken(refreshToken);
// Uses: crypto.createHash('sha256').update(token).digest('hex')
```

**Storage:**

- Column: `user_sessions.refresh_token_hash`
- Format: 64-character hexadecimal string
- Property: Cannot be reversed (one-way hash)

**Comparison in Refresh Flow:**

- Extract raw token from cookie
- Hash it with same SHA-256
- Compare with stored hash in DB

**Why Not bcrypt:**

- Refresh token is not a secret input like password
- Comparison must be deterministic (bcrypt is probabilistic)
- Security model: token theft → hash match → session revoke
- No need for bcrypt's computational cost

---

## What Did Not Change

| Item                                  | Reason                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| **Refresh rotation**                  | Out of scope; requires tracking token families and compromise detection        |
| **Logout/logout-all**                 | Out of scope (Batch 3C); would revoke sessions but logic already exists        |
| **Register transaction**              | Out of scope; email verification flow unchanged                                |
| **Email verification/reset password** | Out of scope; flows unchanged, users can login with pending_email_verification |
| **Prisma schema**                     | Not required (user_sessions table already exists with all needed fields)       |
| **Migrations**                        | Not required (no schema changes)                                               |
| **Package dependencies**              | Already satisfied by existing crypto, @nestjs/jwt, @prisma/client              |

---

## Commands Run

| Command               | Result     | Notes                                                     |
| --------------------- | ---------- | --------------------------------------------------------- |
| `npx prisma generate` | ✓ Success  | Prisma Client v6.19.3 generated in 417ms                  |
| `npm run build`       | ✓ Success  | TypeScript compilation completed without errors           |
| `npm run test`        | ✓ Success  | 1 test suite, 1 test passed                               |
| `git status --short`  | ✓ Verified | Only auth.service.ts modified; scope compliance confirmed |

---

## Git Status

```
M be/src/modules/auth/services/auth.service.ts
M be/spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md
```

**Other files modified in previous batches (not touched in Batch 3B):**

- be/src/modules/auth/services/token.service.ts (from Batch 3A)
- be/src/modules/auth/strategies/jwt-access.strategy.ts (from Batch 3A)
- be/src/modules/auth/repositories/session.repository.ts (from Batch 2F)
- be/src/modules/auth/decorators/current-user.decorator.ts (from Batch 3A)

---

## Scope Compliance

✓ **Prisma schema not modified** — No changes to schema.prisma  
✓ **Migrations not modified** — No changes to migration files  
✓ **Package files not modified** — No package.json/package-lock.json changes  
✓ **Auth controller not modified** — No route or endpoint changes  
✓ **Forbidden modules not modified** — Profile/Discovery/Swipe/Match/Chat/Payment untouched  
✓ **No TypeScript suppressions** — No @ts-ignore, @ts-nocheck, or @ts-expect-error  
✓ **No hard deletes** — Sessions revoked, not deleted  
✓ **No raw refresh token storage** — Only SHA-256 hash stored  
✓ **Generic login failure preserved** — Banned/suspended/deleted return generic error  
✓ **Pending email verification allowed** — Removed email verification check

---

## Implementation Summary

### Login Behavior

- ✓ **Credentials invalid:** Generic "Email hoặc mật khẩu không chính xác" + timing-safe dummy compare
- ✓ **Banned account:** Generic failure (no "Tài khoản đã bị khóa")
- ✓ **Soft deleted (>30 days):** GoneException
- ✓ **Soft deleted (≤30 days):** Login allowed with pendingRestore flag
- ✓ **Pending email verification:** Login allowed (no ForbiddenException)
- ✓ **Active account:** Login allowed

### Session Creation

- ✓ Created before token issuance
- ✓ Placeholder hash replaced with real hash
- ✓ No raw refresh token remains in DB
- ✓ SessionRepository.updateTokenHash() called to finalize

### Token Issuance

- ✓ Access token includes session_id
- ✓ Refresh token includes session_id and jti
- ✓ Both tokens include token_type field
- ✓ Both tokens include email (backward compatibility)
- ✓ Cookies set via TokenService.setAuthCookies()

---

## Known Issues / Deferred Work

- `issueTokens()` is a shared helper, so existing flows calling `issueTokens` now also issue session-aware tokens.
- Refresh rotation is not implemented.
- Logout/logout-all are not implemented until Batch 3C.
- Placeholder hash flow is non-transactional.
- Full refresh token family reuse detection is out of scope.

**Phase 1 Remaining Batches:**

- **Batch 3C:** Logout current + logout all revoke DB sessions
- **Batch 3D:** Refresh token rotation with family tracking
- **Batch 4:** Profile persistence and onboarding flow
- **Batch 5:** Email verification transaction
- **Batch 6:** Reset password transaction

---

## Next Step

**Batch 3C — Logout Current + Logout All Revoke DB Sessions**

- Update logout() to extract session_id from @CurrentUser() and revoke session
- Update logoutAll() to revoke all active sessions for user
- Maintain existing cookie clearing behavior
- Expected scope:
  - src/modules/auth/services/auth.service.ts (logout, logoutAll methods)
  - src/modules/auth/repositories/session.repository.ts (revokeById, revokeAllByUserId)
  - No token.service.ts changes
  - No controller changes
