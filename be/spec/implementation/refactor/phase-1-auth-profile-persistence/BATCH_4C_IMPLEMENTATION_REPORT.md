# Batch 4C Implementation Report — Forgot/Reset Password Transaction

## Files Changed

- `src/modules/auth/services/auth.service.ts`: Updated `forgotPassword` and `resetPassword` to use `SecurityTokenRepository`, `AuthIdentityRepository`, and transaction.
- `spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md`: Updated statuses for T-014.

## Pre-flight Batch 4B Check

- Verify email uses security_tokens: Verified.
- Verify email marks used_at: Verified.
- Verify email sets email_verified_at: Verified.
- Verify email does not modify onboarding_status: Verified.

## Forgot Password Flow Changes

The `forgotPassword` method has been refactored to use the Prisma-backed `SecurityTokenRepository`. 
- Returns a generic success response regardless of email existence.
- Only creates a password reset token for eligible users (`ACTIVE` or `PENDING_EMAIL_VERIFICATION` and not soft-deleted).
- Invalidates any previously active reset tokens for that user before generating a new one.

## Reset Password Flow Changes

The `resetPassword` method validates the token directly through the `SecurityTokenRepository` and updates the password using a Prisma `$transaction`.

## Transaction Boundary

- Used `this.prisma.$transaction(async (tx) => { ... })` inside `resetPassword` to atomize the token consumption and password update.
- Atomic token consumption: `tx.securityToken.updateMany` with constraints (`id = storedToken.id`, `usedAt = null`, `expiresAt > now`).
- Atomic password update: `tx.authIdentity.updateMany` for `userId = user.id` and `provider = EMAIL`.
- Transactions rollback if any update count is 0 or not exactly 1 as expected.

## Token Validation

- The raw token from the client is hashed using `hashToken()`.
- System checks that `tokenType === 'PASSWORD_RESET'`.
- System verifies that `usedAt` is null and `expiresAt` is in the future.
- User is loaded by `token.userId` and their status is checked (`BANNED`, `SUSPENDED`, `DELETED`, or `deletedAt !== null` rejects the request).

## Password Hash Storage

- The password is hashed and stored exclusively on the `auth_identities` table using `updateMany` for `userId` + `provider='EMAIL'`. 
- The hash is NOT stored on the `users` table.

## Security Behavior

- The raw token is never stored in the database.
- Uses generic `BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')` on any invalid condition to avoid leaking account or token status.
- Consumed tokens have `usedAt` set to prevent replay attacks.
- Invalid requests (unknown email, banned user, etc.) safely return a generic success message during the forgot password flow.

## What Did Not Change

- Register not changed
- Verify email not changed
- Login/logout/refresh not changed
- Session invalidation after password reset not implemented unless already present (existing session revocation is left intact)
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
 M src/modules/auth/services/auth.service.ts
```

## Scope Compliance

- Exclusively modified `auth.service.ts` and `tasks.md`.
- Maintained all limitations regarding Prisma schemas and runtime behaviors.
- Did not touch other domains.

## Known Issues / Deferred Work

- Active sessions are fully revoked for the user after reset password via legacy `SessionRepository` method `deleteAllByUserId`. This existing behavior remains untouched.

## Next Step

Batch 5A — Profile persistence repositories.
