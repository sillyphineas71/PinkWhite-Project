# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial known implementation gaps document | Toàn bộ file |

---

# Known Implementation Gaps — Dating / Social Matchmaking Platform

Tài liệu này ghi lại tất cả các gaps được phát hiện giữa code hiện tại và yêu cầu production. Đây là **documentation only** — không có code fix trong task này.

Mỗi gap có severity: 🔴 Critical / 🟡 Medium / 🟢 Low.

---

## GAP-01: In-Memory Repository — KHÔNG phải production database

**Severity:** 🔴 Critical

**Vị trí:**
- `src/modules/auth/repositories/user.repository.ts` — Dùng `Map<string, UserEntity>`
- `src/modules/auth/repositories/session.repository.ts` — In-memory
- `src/modules/auth/repositories/verification-token.repository.ts` — In-memory
- `src/modules/auth/repositories/reset-password-token.repository.ts` — In-memory
- `src/modules/profile/repositories/profile.repository.ts` — Dùng `Map<string, ProfileEntity>`
- `src/modules/profile/repositories/location.repository.ts` — In-memory
- `src/modules/profile/repositories/photo.repository.ts` — In-memory
- `src/modules/swipe/repositories/` — In-memory
- `src/modules/match/repositories/` — In-memory
- `src/modules/discovery/repositories/` — In-memory

**Impact:**
- Data reset về rỗng mỗi khi server restart.
- Không có persistence thật.
- Không thể scale ngang (mỗi instance có state riêng).
- Unique constraints không được enforce ở DB level.
- Race conditions không được handle đúng cách.

**Requirement:** Phải chuyển sang Prisma + PostgreSQL. Database schema và local migration đã được apply thành công (21 models). Bước tiếp theo là implement repository layer để dùng Prisma.

---

## GAP-02: Prisma Schema Rỗng [RESOLVED]

**Severity:** 🟢 Resolved

**Chi tiết:** Database schema đã được chốt với 21 domain models. Migration đã được apply thành công trên local `match_dev`. Gap này đã được giải quyết ở tầng database, chỉ chờ runtime layer integrate.

---

## GAP-03: `.env.example` Chứa Real Credentials [RESOLVED]

**Severity:** 🟢 Resolved (Security)

**Vị trí:** `be/.env.example`

**Chi tiết:** `.env.example` đã được sanitize, thay thế real credentials bằng các placeholders.

**Lưu ý quan trọng:** Mặc dù `.env.example` đã an toàn, nếu credentials thật từng bị commit và push lên remote repo trong các commit trước, chúng vẫn có rủi ro bị lộ trong Git history.
**Action required:** Phải rotate ngay Gmail App Password và Google Client Secret nếu chúng từng bị push lên public/semi-public repo.

---

## GAP-04: CSRF Protection Không Rõ

**Severity:** 🔴 Critical

**Vị trí:** `src/main.ts`, guards

**Chi tiết:** Không tìm thấy CSRF middleware hoặc CSRF token handling nào trong codebase. Backend dùng cookie-based JWT — mutation endpoints dễ bị CSRF attack.

**Requirement:** Cần implement CSRF protection trước production. Xem `spec/global/security.md` SEC-03.

---

## GAP-05: Account Status Guard Không Rõ

**Severity:** 🔴 Critical

**Vị trí:** `src/modules/auth/guards/jwt-access.guard.ts`

**Chi tiết:**
```typescript
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {}
```

Guard này chỉ verify JWT token. Không rõ có check account status (banned/suspended/deleted) sau khi JWT valid không.

**Impact:** Banned user có thể vẫn access API nếu JWT còn hạn.

**Requirement:** Cần AccountStatusGuard hoặc integrate account status check vào JWT strategy `validate()` method.

---

## GAP-06: Socket.IO Gateway Không Authenticate

**Severity:** 🔴 Critical

**Vị trí:** `src/realtime/realtime.gateway.ts`

**Chi tiết:**
```typescript
handleConnection(client: Socket) {
  this.logger.debug(`Socket connected: ${client.id}`);
  client.emit('connected', { socketId: client.id });
}
```

`handleConnection` không verify JWT, không authenticate user, không attach userId vào socket.

**Impact:**
- Bất kỳ ai cũng có thể connect socket.
- Không biết socket nào thuộc user nào.
- Không thể implement private rooms một cách an toàn.

**Requirement:** Socket phải extract JWT từ cookie trong handshake và verify. Attach userId vào socket data.

---

## GAP-07: isOnboarded Business Rule Có Thể Sai

**Severity:** 🟡 Medium

**Vị trí:** Profile/Auth service — chưa verify

**Chi tiết:** `isOnboarded` field tồn tại trên `UserEntity`. Chưa rõ business rule để set `isOnboarded = true` có đúng spec không. Theo spec (BR-02-01), user chỉ được coi là onboarded khi thỏa mãn TẤT CẢ: email verified, basic profile, age valid, approved photo, active location, preferences.

**Impact:** Nếu set sai, user có thể bị mark là onboarded trước khi thật sự complete, dẫn đến xuất hiện trong discovery khi chưa đủ điều kiện.

**Requirement:** Cần review và verify onboarding eligibility check logic.

---

## GAP-08: CORS Socket.IO Hardcoded

**Severity:** 🟡 Medium

**Vị trí:** `src/realtime/realtime.gateway.ts`

```typescript
@WebSocketGateway({
  cors: {
    credentials: true,
    origin: ['http://localhost:5173'],
  },
  namespace: 'realtime',
})
```

**Impact:** Production sẽ fail nếu không đổi cứng string này. Không thể config qua env.

**Requirement:** Đọc `CORS_ORIGIN` từ env config thay vì hardcode.

---

## GAP-09: Safety Module Chưa Tồn Tại

**Severity:** 🔴 Critical

**Chi tiết:** Không có `src/modules/safety/` hoặc `src/safety/`. Block/Report là P0 features nhưng chưa implement.

**Impact:**
- Không có cách block user → discovery không exclude blocked users đúng cách.
- Không có cách report user.
- Discovery và match queries không thể apply block filter nếu không có block data.

---

## GAP-10: Chat Module Chưa Tồn Tại

**Severity:** 🔴 Critical

**Chi tiết:** Không có `src/modules/chat/`. Chat là P0 feature nhưng chưa implement.

**Impact:** Matched users không thể chat dù UI có thể tồn tại.

---

## GAP-11: Storage Module Chưa Tồn Tại

**Severity:** 🔴 Critical

**Chi tiết:** Không có storage module. Photo upload flow chưa implement. Photo entity trong mock repository không có actual storage backend.

**Impact:** User không thể thật sự upload ảnh. Photo approval flow không thể hoạt động đúng.

---

## GAP-12: Notification Service Luôn Throw Error

**Severity:** 🟡 Medium

**Vị trí:** `src/notifications/notifications.service.ts`

```typescript
sendToDevice(deviceToken, payload): Promise<never> {
  return Promise.reject(
    new Error('Firebase notification adapter is not implemented yet.')
  );
}
```

**Impact:** Push notification không hoạt động. Nếu có code gọi `sendToDevice`, nó sẽ throw unhandled exception.

**Requirement:** Placeholder cần được handle gracefully (không crash app), và cần implement thật trước production.

---

## GAP-13: E2E Test Prefix Inconsistency

**Severity:** 🟡 Medium

**Vị trí:** `test/app.e2e-spec.ts`

```typescript
it('/health (GET)', () => {
  return request(app.getHttpServer())
    .get('/health')  // ← không có /api prefix
```

**Chi tiết:** `main.ts` set `app.setGlobalPrefix('api')`, nên health endpoint phải ở `/api/health`. Test đang test `/health` — có thể test đang fail hoặc health route được setup đặc biệt không theo global prefix.

**Requirement:** Cần verify health route config và fix test nếu sai.

---

## GAP-14: Logout Cookie Path Chưa Verify

**Severity:** 🟡 Medium

**Chi tiết:** Khi logout, cookie phải được clear đúng path. Nếu cookie được set với `Path: /api` nhưng clear command gửi `Path: /`, browser sẽ không xóa cookie.

**Requirement:** Cần verify cookie set/clear path consistency.

---

## GAP-15: Refresh Token Rotation Chưa Verify

**Severity:** 🟡 Medium

**Chi tiết:** Cần verify: Sau khi refresh token được dùng, token cũ có bị revoke không? Nếu không có rotation, stolen refresh token có thể dùng mãi.

---

## GAP-16: Discovery Không Apply Block Filter

**Severity:** 🔴 Critical

**Chi tiết:** Discovery query phải exclude users mà requester đã block hoặc đã block requester. Nhưng Safety module chưa tồn tại → không có block data → discovery không thể apply block filter.

---

## GAP-17: Match Creation Không Idempotent Ở DB Level

**Severity:** 🟡 Medium (sẽ là Critical khi có real DB)

**Chi tiết:** Hiện tại in-memory mock. Khi chuyển sang PostgreSQL, phải có unique constraint để đảm bảo một cặp user chỉ có một active match. Nếu race condition tạo 2 concurrent swipes → có thể tạo duplicate match.

**Requirement:** DB schema phải có `UNIQUE(userIdA, userIdB)` constraint hoặc equivalent cho match pair.

---

## GAP-18: Structured Logging Chưa Có

**Severity:** 🟡 Medium

**Chi tiết:** NestJS built-in `Logger` không output structured JSON. Production cần JSON logging để integrate với log aggregation systems.

**Requirement:** Cần setup pino hoặc winston với JSON formatter.

---

## GAP-19: Rate Limiting Chưa Apply Trên Auth Endpoints

**Severity:** 🟡 Medium

**Chi tiết:** `@nestjs/throttler` đã install nhưng chưa verify có apply throttle trên auth endpoints không.

**Requirement:** Auth endpoints (login, register, forgot-password) phải có strict rate limiting.
