# Batch 4B Implementation Report — Verify Email Transaction

## Files Changed

- `src/modules/auth/services/auth.service.ts`: Updated `sendVerificationEmail` and `confirmVerifyEmail` to use `SecurityTokenRepository` and Prisma `$transaction`.
- `spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md`: Updated statuses for T-013.

## Pre-flight Batch 4A Check

- Register creates email_verification security token: Verified.
- Register stores token_hash only: Verified.
- Default account_status: PENDING_EMAIL_VERIFICATION verified.
- Default onboarding_status: NOT_STARTED verified.

## Verify Email Flow Changes

The `confirmVerifyEmail` method has been refactored to use the Prisma-backed `SecurityTokenRepository`. It properly hashes the incoming token and checks the DB for an existing, unused, and unexpired token.

The `sendVerificationEmail` method was also updated to invalidate old tokens via `SecurityTokenRepository` and generate new ones under the `EMAIL_VERIFICATION` token type to keep consistency within the verify email flow.

## Transaction Boundary

- Used `this.prisma.$transaction(async (tx) => { ... })` inside `confirmVerifyEmail` to atomize the token consumption and user status updates.
- Atomic token consumption: `tx.securityToken.updateMany` with constraints (`id = storedToken.id`, `usedAt = null`, `expiresAt > now`).

## Token Validation

- The raw token from the client is hashed using `hashToken()`.
- System checks that `tokenType === 'EMAIL_VERIFICATION'`.
- System verifies that `usedAt` is null and `expiresAt` is in the future.
- If the token update count !== 1 inside the transaction, it throws an error ensuring replay safety.

## User Status Behavior

- Uses generic `BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn')` on any invalid condition to avoid leaking account status.
- Sets `emailVerifiedAt` to the current time.
- Changes `accountStatus` from `PENDING_EMAIL_VERIFICATION` to `ACTIVE` only.
- Will not activate a user who is `BANNED`, `SUSPENDED`, `DELETED`, or has `deletedAt !== null`.

## Security Behavior

- The raw token is never stored in the database.
- Consumed tokens have `usedAt` set to prevent replay attacks.
- Outdated tokens are invalidated when generating a new token via `sendVerificationEmail`.

## What Did Not Change

- Register transaction not changed
- Forgot/reset password not implemented
- Login/logout/refresh not changed
- Onboarding status not changed
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

- Password reset flow is still using the legacy repository and will be addressed in Batch 4C.

## Next Step

Batch 4C — Forgot/reset password transaction.
