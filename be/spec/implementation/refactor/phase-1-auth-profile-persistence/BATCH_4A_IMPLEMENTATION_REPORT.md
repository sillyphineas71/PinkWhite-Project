# Batch 4A Implementation Report — Register Transaction

## Files Changed

- `src/modules/auth/services/auth.service.ts`: Updated `register()` to use `this.prisma.$transaction`.
- `spec/implementation/refactor/phase-1-auth-profile-persistence/tasks.md`: Updated statuses for T-012.

## Register Flow Changes

The `register()` method now encapsulates all initial user creation steps inside a single Prisma transaction. This includes user creation, discovery preferences, privacy settings, and security tokens.

## Transaction Boundary

- Used `this.prisma.$transaction(async (tx) => { ... })` in `auth.service.ts`.
- `userRepo.create()` is passed the transaction client `tx`.
- `securityTokenRepo.create()` is passed the transaction client `tx`.
- `tx.discoveryPreference.create()` and `tx.userPrivacySettings.create()` are called directly inside the transaction using the transaction client.

## Created Rows

1. `users`: Created with `account_status: 'PENDING_EMAIL_VERIFICATION'` and `onboarding_status: 'NOT_STARTED'` (default schema values).
2. `auth_identities`: Created by `userRepo.create()` containing the `password_hash` and `provider: 'EMAIL'`.
3. `discovery_preferences`: Default preferences added.
4. `user_privacy_settings`: Default settings added.
5. `security_tokens`: Created token of type `EMAIL_VERIFICATION`.

## Token Storage

- The raw email verification token is generated, hashed with `hashToken()`, and only the hash is stored in `security_tokens`.
- The raw token is returned/used only for the email service.

## Email Delivery Behavior

- `emailService.sendVerificationEmail(normalized, token)` is invoked *after* the Prisma `$transaction` block successfully commits.

## Default Values Used

- **Discovery Preferences**: `minAge`: 18, `maxAge`: 100, `maxDistanceKm`: 100, `preferredGenders`: `['MALE', 'FEMALE', 'NON_BINARY', 'OTHER']`.
- **User Privacy Settings**: Fallback to Prisma schema defaults (isHidden: false, showDistance: true, showOnlineStatus: true, showLastActive: true).
- **Users**: AccountStatus `PENDING_EMAIL_VERIFICATION`, OnboardingStatus `NOT_STARTED` (schema defaults).
- **Security Tokens**: `expiresAt`: 15 minutes from creation.

## What Did Not Change

- Verify email not implemented
- Forgot/reset password not implemented
- Login/logout/refresh not changed
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
- `auth.module.ts` did not need modification because `PrismaService` is already exported by `DatabaseModule` and imported by `AuthModule`.
- Maintained all limitations regarding Prisma schemas and existing legacy verification token methods.

## Known Issues / Deferred Work

- Verify email and password reset flows are still using legacy repositories and will be updated in subsequent batches.

## Next Step

Batch 4B — Verify email transaction.
