# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial auth module spec | Toàn bộ file |

---

# Auth Module

## Goal
Quản lý authentication, authorization, account lifecycle và session management.

## Responsibilities
- Đăng ký / Đăng nhập bằng email+password và Google OAuth.
- JWT cookie-based authentication (access token + refresh token).
- Refresh token rotation và session revocation.
- Email verification flow.
- Password reset / forgot password flow.
- Change password.
- Account lifecycle: soft delete, restore.
- Force logout all devices.
- Account status enforcement (active, banned, suspended, deleted).

## Out of Scope
- Profile creation / onboarding (→ `profile` module).
- Discovery preferences (→ `discovery` module).
- Admin-initiated ban/suspend (→ admin module, future).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-01.

Key rules:
- Email phải unique.
- Password phải hash bằng bcrypt.
- Email phải verified trước khi discoverable.
- Refresh token phải rotate.
- Account status check bắt buộc sau JWT verify.
- Logout phải revoke đúng session.
- Password change → revoke tất cả sessions.

## Privacy / Security Notes
- Không log password, token raw, email raw.
- Login failure: generic error (không tiết lộ email/password cụ thể sai).
- Forgot password: generic response ("if email exists, link was sent").
- Cookie: HttpOnly, Secure, SameSite.
- CSRF protection cần cho mutation endpoints.

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | Public | Đăng ký |
| POST | /api/auth/login | Public | Đăng nhập |
| POST | /api/auth/logout | User | Đăng xuất device hiện tại |
| POST | /api/auth/logout-all | User | Đăng xuất tất cả device |
| POST | /api/auth/refresh | Public (refresh cookie) | Refresh access token |
| GET | /api/auth/me | User | Lấy thông tin user hiện tại |
| POST | /api/auth/verify-email | Public | Xác thực email |
| POST | /api/auth/resend-verification | User | Gửi lại email verify |
| POST | /api/auth/forgot-password | Public | Yêu cầu reset password |
| POST | /api/auth/reset-password | Public | Thực thi reset password |
| PATCH | /api/auth/change-password | User | Đổi password khi đã login |
| DELETE | /api/auth/account | User | Soft delete account |
| POST | /api/auth/restore | Public | Restore soft deleted account |
| POST | /api/auth/google | Public | Google OAuth login/register |

## Data Model Requirements
*(Concept only — không phải final schema. Database sẽ được debate riêng.)*

**User entity cần:**
- `id` (UUID)
- `email` (unique)
- `passwordHash` (nullable — null cho OAuth users)
- `isEmailVerified` (boolean)
- `isOnboarded` (boolean)
- `isBanned` (boolean)
- `isSuspended` (boolean)
- `suspendedUntil` (datetime, nullable)
- `isHidden` (boolean)
- `deletedAt` (datetime, nullable — soft delete)
- `createdAt`, `updatedAt`

**Session entity cần:**
- `id` (UUID)
- `userId` (FK → User)
- `refreshTokenHash` (hash của refresh token — không lưu raw)
- `expiresAt`
- `createdAt`
- Device info (optional): `userAgent`, `ip`

**VerificationToken entity cần:**
- `id` (UUID)
- `email`
- `tokenHash`
- `expiresAt`
- `type` (EMAIL_VERIFY | PASSWORD_RESET)

## Events
*(Target — không implement trong task này)*

| Event | Trigger | Consumers |
|---|---|---|
| `AUTH.ACCOUNT_CREATED` | Register | Notification (welcome email) |
| `AUTH.EMAIL_VERIFIED` | Email verify | Profile (mark user as verifiable) |
| `AUTH.PASSWORD_CHANGED` | Password change | Notification (security alert) |
| `AUTH.ACCOUNT_DELETED` | Soft delete | Discovery (remove from feed) |

## Logging / Audit
- `AUTH.LOGIN_SUCCESS` — log userId, ip, userAgent.
- `AUTH.LOGIN_FAILURE` — log masked email, ip.
- `AUTH.LOGOUT` / `AUTH.LOGOUT_ALL`.
- `AUTH.PASSWORD_CHANGED`.
- `AUTH.EMAIL_VERIFIED`.
- `AUTH.ACCOUNT_DELETED` / `AUTH.ACCOUNT_RESTORED`.

Xem chi tiết: `spec/global/logging-monitoring-audit.md`.

## Testing Notes
- Unit: age calculation, password hashing, token generation.
- Integration: register, login, refresh, logout, forgot/reset password.
- E2E: full auth flow.
- Generic error test: login failure must return same message for wrong email vs wrong password.

## Known Implementation Gaps
- **GAP-01:** In-memory repositories — không persistent.
- **GAP-04:** CSRF protection chưa rõ.
- **GAP-05:** Account status guard chưa verify.
- **GAP-14:** Logout cookie path chưa verify.
- **GAP-15:** Refresh token rotation chưa verify.
- **GAP-03:** `.env.example` chứa real credentials.

## Open Questions
- CSRF strategy: Double Submit Cookie hay custom header?
- Cookie SameSite: Strict hay Lax? (ảnh hưởng Google OAuth redirect flow)
- Sau password reset: revoke tất cả sessions hay chỉ sessions cũ?
