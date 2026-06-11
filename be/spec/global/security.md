# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Full rewrite — production security spec cho dating/social matchmaking backend | Toàn bộ file |

---

# Security — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa toàn bộ security requirements và known risks. Security là **first-class requirement**.

---

## SEC-01: Authentication & Cookie-based JWT

### SEC-01-01: Cookie strategy
- Access token và refresh token được lưu trong **HTTP-only cookie** — không accessible bởi JavaScript client.
- Điều này ngăn chặn XSS (Cross-Site Scripting) attack lấy cắp token.
- Cookie phải có các attributes:
  - `HttpOnly: true`
  - `SameSite: Strict` hoặc `Lax` (cần chốt — Strict an toàn hơn nhưng ảnh hưởng cross-site flows như OAuth redirect)
  - `Secure: true` (chỉ trên HTTPS — production bắt buộc)
  - `Path: /api` (giới hạn scope của cookie)

### SEC-01-02: Access token
- Short-lived: mặc định 15 phút.
- Signed bằng `JWT_ACCESS_SECRET`.
- Payload tối thiểu: `sub` (userId), `iat`, `exp`.
- KHÔNG lưu sensitive data (email, password, role details) trong token payload.

### SEC-01-03: Refresh token
- Long-lived: mặc định 7 ngày.
- Signed bằng `JWT_REFRESH_SECRET` riêng (khác với access secret).
- Phải được lưu server-side (Redis hoặc DB session table) để có thể revoke.
- Phải rotate mỗi lần dùng — old token bị invalidate, new token được cấp.
- **Known Implementation Gap:** Cần verify refresh token rotation và server-side storage implementation.

### SEC-01-04: Token secrets
- `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` phải là string ngẫu nhiên đủ dài (>= 32 chars).
- Không được dùng default/weak secrets trong production.
- **Known Risk:** `.env.example` hiện chứa comment "Có thể dùng tạm key mặc định này cho lúc dev" — cần đổi toàn bộ trước khi production.

---

## SEC-02: Session Revocation

### SEC-02-01: Logout current device
- Phải revoke đúng session token của device đó.
- Cookie phải bị clear trên client (Set-Cookie với maxAge=0 hoặc expired date).
- Session record trên server (Redis/DB) phải bị xóa.

### SEC-02-02: Logout all devices (Force logout)
- Phải revoke TẤT CẢ sessions của user đó.
- Có thể implement bằng: xóa tất cả session records, hoặc increment `tokenVersion` trên user record.
- **Known Implementation Gap:** Cần verify force logout implementation.

### SEC-02-03: Logout sau password change
- Sau khi đổi password thành công: tất cả sessions cũ phải bị revoke.
- Chỉ session hiện tại (nếu muốn) được giữ lại — tùy policy.

### SEC-02-04: Logout cookie path
- **Known Risk:** Cookie logout phải clear đúng path. Nếu cookie set ở `Path: /api` nhưng clear ở `Path: /`, cookie sẽ không bị xóa đúng cách.
- Cần verify cookie path consistency.

---

## SEC-03: CSRF Protection

### SEC-03-01: CSRF risk
- Cookie-based authentication có nguy cơ CSRF (Cross-Site Request Forgery).
- Mutation endpoints (POST, PUT, PATCH, DELETE) phải có CSRF protection.

### SEC-03-02: Recommended approach
Options (cần chốt):
1. **SameSite=Strict cookie**: Đơn giản nhất, nhưng có thể block một số OAuth flows.
2. **Double Submit Cookie pattern**: Client gửi CSRF token trong cả cookie và header.
3. **Custom header pattern**: Require custom header (ví dụ: `X-Requested-With: XMLHttpRequest`) — SOP (Same-Origin Policy) ngăn cross-site request gửi custom header.

### SEC-03-03: Known Implementation Gap
**CSRF protection hiện tại chưa rõ.** Cần review và implement trước production.

---

## SEC-04: CORS

### SEC-04-01: CORS configuration
- CORS chỉ mở cho origin được cấu hình trong `CORS_ORIGIN` env.
- `credentials: true` phải được set (vì dùng cookie).
- Không được dùng wildcard `*` khi có `credentials: true` — browser sẽ block.

### SEC-04-02: Socket.IO CORS
- Realtime gateway có CORS riêng, hiện hardcode `http://localhost:5173`.
- **Known Risk:** Production phải cấu hình CORS từ env, không hardcode.

---

## SEC-05: Rate Limiting

### SEC-05-01: Auth endpoints
- Login, register, forgot-password, verify-email phải có rate limiting.
- Recommended: @nestjs/throttler với strict limit cho auth endpoints.
- Ví dụ: max 5 login attempts per IP per 15 minutes.

### SEC-05-02: General API
- General rate limiting cho tất cả endpoints (bảo vệ khỏi abuse).

### SEC-05-03: Swipe quota
- Swipe quota là business rule, không chỉ là rate limit.
- Phải implement ở service layer, không chỉ dựa vào throttler.

---

## SEC-06: Account Status Guard

### SEC-06-01: Account status check bắt buộc
- **Sau khi JWT được verify**, phải check account status.
- Trạng thái `pending_email_verification` được phép login và hoàn thành onboarding, nhưng KHÔNG được become discoverable (bị loại khỏi feed).
- Nếu account `banned` / `suspended` / `deleted`: phải từ chối request login hoặc access api chính.
- Trả về `403 Forbidden` (không phải `401`) — vì token hợp lệ nhưng account bị khóa.

### SEC-06-02: Known Implementation Gap
**Account status guard hiện chưa rõ.** `JwtAccessGuard` hiện tại chỉ kế thừa `AuthGuard('jwt-access')` — không rõ có check account status không.

Cần tạo `AccountStatusGuard` hoặc integrate vào JWT strategy's `validate()` method.

---

## SEC-07: Password Security

### SEC-07-01: Password hashing
- Password phải được hash bằng **bcrypt** trước khi lưu vào DB.
- `BCRYPT_ROUNDS` phải >= 10 (default development), >= 12 trong production.
- Không bao giờ lưu plaintext password.

### SEC-07-02: Password validation
- Password phải có minimum length (ví dụ: 8 chars).
- **Open Question:** Có cần enforce complexity rules (uppercase, số, ký tự đặc biệt) không?

---

## SEC-08: Generic Error Messages (Anti-enumeration)

### SEC-08-01: Auth flows
- **Login failure:** Trả về generic "Invalid email or password" — không tiết lộ "email không tồn tại" vs "password sai".
- **Forgot password:** Trả về generic "If this email exists, a reset link was sent" — không tiết lộ email có tồn tại không.
- **Blocked user:** Trả về generic error — không tiết lộ "you are blocked".
- **Banned account:** Trả về generic "Account access denied" — không tiết lộ lý do cụ thể.

---

## SEC-09: No Stack Trace in Production

### SEC-09-01: Global exception filter
- Production phải NOT expose stack trace trong HTTP response.
- Development có thể log stack trace locally.
- `NODE_ENV=production` phải loại bỏ stack trace khỏi response.

### SEC-09-02: Structured error response
```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "requestId": "req-abc-123"
}
```
Không bao gồm `stack` trong production.

---

## SEC-10: Environment Variables Security

### SEC-10-01: .env.example security audit
**CRITICAL RISK DETECTED:** File `.env.example` hiện chứa các giá trị thật:
- `SMTP_USER="haiductran712@gmail.com"` — real email
- `SMTP_PASSWORD="mfij hxoe ympb kjav"` — real Gmail App Password
- `GOOGLE_CLIENT_ID="416199732141-..."` — real Google Client ID

**Action required (không nằm trong task này — ghi để human review):**
1. Rotate SMTP App Password ngay.
2. `.env.example` chỉ được chứa placeholder values, không bao giờ real credentials.
3. Kiểm tra `.gitignore` để đảm bảo `.env` thật không bị commit.

### SEC-10-02: Secret management
- Không hardcode secret trong code.
- Tất cả secrets phải đến từ env.
- Production phải dùng secret management service (AWS Secrets Manager, GCP Secret Manager, v.v.) — **Future Improvement**.

---

## SEC-11: OAuth Security

### SEC-11-01: Google OAuth server-side verification
- Backend phải verify Google `id_token` server-side dùng `google-auth-library`.
- Không tin raw id_token từ client mà không verify signature và audience.
- Verify audience phải khớp `GOOGLE_CLIENT_ID`.

---

## SEC-12: Socket Security

### SEC-12-01: Socket authentication
- Socket.IO connection phải authenticate user.
- Cookie-based auth: có thể extract JWT từ cookie trong handshake.
- **Known Implementation Gap:** Realtime gateway hiện tại KHÔNG authenticate — `handleConnection` không verify JWT, không gán userId vào socket.

### SEC-12-02: Socket authorization
- Sau khi authenticate, phải kiểm tra permission trước khi join room.
- User chỉ được join room của match mà họ là participant.
- Room naming phải không predictable (dùng matchId UUID, không dùng userIds trực tiếp).

---

## SEC-13: Admin / Moderator Security

### SEC-13-01: Admin routes separation
- Admin endpoints phải tách route rõ ràng (ví dụ: `/api/admin/*`).
- Admin endpoints phải có admin role guard riêng.
- Admin scope là **Out of Scope** hiện tại nhưng design phải tính đến.

### SEC-13-02: Admin access logging
- Mọi admin action phải có audit log.
- Xem `spec/global/logging-monitoring-audit.md` cho audit events.

---

## SEC-14: Known Security Risks Summary

| Risk | Severity | Status |
|---|---|---|
| `.env.example` chứa real credentials | 🔴 Critical | **Cần action ngay — ngoài scope task này** |
| CSRF protection chưa rõ | 🔴 Critical | Known Gap |
| Account status guard chưa rõ | 🔴 Critical | Known Gap |
| Socket auth không có | 🔴 Critical | Known Gap |
| CORS Socket hardcoded | 🟡 Medium | Known Gap |
| Cookie path chưa verify | 🟡 Medium | Known Gap |
| Stack trace in production chưa check | 🟡 Medium | Known Gap |
| Refresh token rotation chưa verify | 🟡 Medium | Known Gap |
