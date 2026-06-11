# CLAUDE.md — Backend Agent Guide: Dating / Social Matchmaking Platform

# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Full rewrite — production-grade backend agent guide cho dating/social matchmaking platform | Toàn bộ file |

---

## MANDATORY GREETING

Mọi phản hồi trong project này phải bắt đầu bằng chính xác:

```text
[Xin Chào Thiếu Chủ]
```

Không được thêm emoji hoặc ký tự nào phía trước. Không được bỏ qua.

---

## TL;DR — Đọc trong 60 giây

Đây là **backend production-grade cho Dating / Social Matchmaking Platform** (tương tự core architecture của Tinder/Bumble/Hinge).

**Core product loop:**
```text
Đăng ký / Đăng nhập
→ Xác thực email
→ Hoàn thành onboarding profile
→ Upload ảnh được approved
→ Cài đặt vị trí & discovery preferences
→ Nhận discovery feed
→ Swipe like / pass / super like
→ Mutual like → tạo match
→ Matched users chat
→ Unmatch / Block / Report
→ Privacy & Safety rules bảo vệ user
```

**Tech stack:**
- NestJS + TypeScript
- Prisma + PostgreSQL
- Redis (session, presence, cache)
- Cookie-based JWT authentication
- Socket.IO / WebSocket
- Swagger / OpenAPI
- Jest (unit + e2e)

**CRITICAL WARNINGS:**
- Current implementation đang dùng **in-memory / mock repositories**. Tuy nhiên, **database baseline (PostgreSQL + PostGIS)** đã được chốt và apply thành công ở local/dev qua Prisma (21 domain models).
- Bước tiếp theo sẽ là refactor service/repository sang dùng Prisma. Không implement feature mới nếu chưa hoàn thành refactor DB.
- Không implement code nếu chưa có SPEC → PLAN → TASKS → REVIEW.
- Privacy và Safety là **first-class requirements**, không phải làm sau.

---

## GOLDEN RULES — Không được vi phạm

### Rule 1: Đọc docs trước khi code
Mọi agent phải đọc:
1. `CLAUDE.md` (file này)
2. `AGENTS.md`
3. `spec/global/` — toàn bộ
4. `spec/modules/<module>/` — module liên quan
5. `spec/use-cases/` — use case liên quan

Trước khi viết bất kỳ dòng code nào.

### Rule 2: Changelog bắt buộc
Mọi file `.md` được tạo hoặc sửa phải cập nhật phần changelog ở đầu file.
Format: `| Date | Change Summary | Sections Changed |`

### Rule 3: Greeting bắt buộc
Mọi phản hồi phải bắt đầu bằng `[Xin Chào Thiếu Chủ]`.

### Rule 4: Không code khi chưa có spec
Luồng bắt buộc:
```text
Clarify requirement
→ Lock scope
→ Write/Update SPEC
→ Write PLAN
→ Write TASKS
→ Wait for REVIEW
→ Implement
→ Test
→ Update docs
```

### Rule 5: Không tự ý mở rộng scope
Nếu thấy feature hay nhưng chưa thuộc core scope:
- Ghi vào `Future Improvement` hoặc `Out of Scope`
- Không tự ý kéo vào current scope

Out of scope hiện tại (KHÔNG implement/spec sâu):
- recurring billing / Stripe / Apple IAP (chỉ support VNPAY prepaid subscription ở mức schema)
- AI matching / vector search
- live streaming / video call
- advanced moderation AI / automated content moderation
- admin dashboard chi tiết
- push infrastructure (FCM/APNs) / device token (chỉ in-app notification phase 1)
- Kafka / microservices
- KYC / face verification
- chat with GIF / Voice / Reactions (chỉ hỗ trợ text + image)

### Rule 6: Tuân thủ Database Schema Baseline
- `prisma/schema.prisma` đã chốt 21 bảng.
- ID Strategy là UUIDv7.
- Không tự ý sửa schema hoặc tạo migration mới khi chưa có yêu cầu rõ ràng.
- Mọi thay đổi schema đều phải đi qua quy trình review.

### Rule 7: Không log sensitive data
Tuyệt đối không log:
- password / passwordHash
- JWT token / refresh token / raw cookie
- exact lat/lng
- message content / chat body
- private photo URL
- OAuth access token / id token
- raw email (nếu không mask)
- report detail nhạy cảm

Chi tiết: xem `spec/global/logging-monitoring-audit.md`

### Rule 8: Không expose private data
Không trả về data của user khác nếu không có valid context:
- discovery context
- active match context
- admin/moderator context

Xem data visibility matrix tại `spec/global/privacy-rules.md`

### Rule 9: Mock repository ≠ production truth
`UserRepository`, `ProfileRepository`, `SwipeRepository`, `MatchRepository` hiện tại là **in-memory mock**.
- Không coi behavior của mock là correct business logic.
- Không coi mock là production baseline.
- Khi chuyển sang Prisma, toàn bộ behavior phải được validate lại theo spec.

### Rule 10: Code ≠ Spec
Khi code hiện tại conflict với spec đã được approved:
```text
Không được mặc định code là đúng.
Phải báo gap và chờ reviewer/user quyết định.
```

---

## SOURCE OF TRUTH PRIORITY

Khi có conflict, ưu tiên theo thứ tự:

| Priority | Source |
|---|---|
| 1 | Yêu cầu trực tiếp mới nhất từ user |
| 2 | Database decision đã được reviewer/user chốt |
| 3 | Global specs: `spec/global/` |
| 4 | Module specs: `spec/modules/` |
| 5 | Use case specs: `spec/use-cases/` hoặc `spec/features/` |
| 6 | API contract nếu có |
| 7 | `CLAUDE.md` (file này) |
| 8 | Code hiện tại trong `src/` |

> **CRITICAL:** `If current code conflicts with approved spec, do not assume current code is correct.`

---

## TECH STACK

| Layer | Technology | Ghi chú |
|---|---|---|
| Framework | NestJS v11 | TypeScript |
| ORM | Prisma v6 | Đã có 21 domain models, ID strategy: UUIDv7 |
| Database | PostgreSQL + PostGIS | Baseline migration đã apply ở local |
| Cache / Session | Redis (ioredis v5) | Chưa fully integrated |
| Auth | Cookie-based JWT | access token + refresh token |
| Password | bcrypt | BCRYPT_ROUNDS env |
| Realtime | Socket.IO v4 | namespace `/realtime` |
| Validation | class-validator / class-transformer | |
| API Docs | Swagger / OpenAPI | `/docs` |
| Testing | Jest + Supertest | Unit + E2E |
| Notification | In-app only | FCM/Push là out of scope phase 1 |
| Email | Nodemailer + SMTP | Gmail App Password |
| OAuth | Google OAuth (google-auth-library) | Server-side id_token verify |
| Config | @nestjs/config + env | |
| Rate limiting | @nestjs/throttler | |

**KHÔNG dùng TypeORM.** Project này dùng Prisma.

---

## MODULE BOUNDARY

### `auth`
- Login / Register / Logout / Session
- JWT generation / validation / rotation
- Email verification flow
- Password reset / change
- Google OAuth
- Account status management (active, banned, deleted, suspended)
- Refresh token lifecycle
- **Không chứa:** profile data, swipe logic, discovery

### `profile`
- Onboarding profile creation / update
- Photo upload / approval / ordering / deletion
- Bio / interests / job / education / lifestyle
- Location management (set, update, get own)
- Onboarding eligibility check
- **Không chứa:** JWT, swipe logic, discovery filter, match lifecycle

### `discovery`
- Discovery feed generation
- Preference CRUD (age range, gender, distance)
- Feed filtering: active, onboarded, verified, not blocked, not swiped, fits preference
- Visibility toggle (hidden mode)
- **Không chứa:** swipe creation, match creation, profile mutation

### `swipe`
- Like / Pass / Super Like
- Rewind (last swipe, condition-based)
- Swipe quota management (like, super like)
- "Who liked me" (limited visibility)
- Swipe idempotency
- **Không chứa:** match creation (chỉ trigger event), discovery logic

### `match`
- Match creation (từ mutual like event)
- Match lifecycle (active, unmatched)
- Get matches / search matches
- Unmatch / rematch (nếu có)
- Match profile view
- **Không chứa:** swipe logic, chat persistence, notification sending

### `chat`
- Message send / read / list (persistence layer)
- Read receipts (persistence)
- Chat permission check (active match only)
- Conversation inbox
- **Không chứa:** realtime delivery (đó là `realtime` module), match creation

### `realtime`
- Socket.IO gateway
- Socket auth / connection management
- Room management (match rooms)
- Realtime event emission (typing, online status, message delivery)
- **Không chứa:** message persistence (đó là `chat`), match creation

### `notifications`
- Notification abstraction (in-app, email)
- Notification preference check
- **Hiện tại:** In-app only. Push/FCM (device tokens) là out of scope phase 1.
- **Target:** event-driven notification dispatch
- **Không chứa:** business logic quyết định khi nào gửi

### `safety`
- Block / Unblock user
- Report user / Report content
- Moderation record management
- Account restriction (suspend, ban) — admin action
- **Không chứa:** match creation, chat permission (safety chỉ cấp data, module khác check)

### `storage`
- Photo upload initiation (generate upload URL / uploadId)
- Photo metadata management
- Upload confirmation (backend verify objectKey, không tin raw client URL)
- Provider abstraction (local disk, S3, Cloudinary)
- **Hiện tại:** placeholder / mock
- **Không chứa:** profile photo ordering (đó là `profile`)

### `database`
- Prisma service
- Migration management
- **CRITICAL:** Schema đã chốt baseline (21 models). Phase tiếp theo là refactor repositories.

### `common`
- Guards (JwtAccessGuard, AccountStatusGuard)
- Interceptors (LoggingInterceptor, ResponseInterceptor)
- Filters (GlobalExceptionFilter)
- Decorators (CurrentUser, Public, Roles)
- Utils (age calculation, distance calculation, pagination)
- **Không chứa:** business logic

---

## IMPLEMENTATION WORKFLOW

```text
1. Clarify requirement
   → Hiểu đúng use case, actor, precondition, happy/unhappy flows

2. Lock scope
   → Xác định rõ task này làm gì, không làm gì
   → Nếu cần database decision, flag và chờ

3. Write / Update SPEC
   → Tạo/cập nhật file trong spec/modules/<module>/ hoặc spec/features/
   → Ghi rõ API, data model requirements, business rules, privacy/security notes
   → Cập nhật changelog

4. Write PLAN
   → Technical implementation plan
   → Xác định files cần tạo/sửa
   → Xác định dependencies

5. Write TASKS
   → Task checklist chi tiết
   → Có thể chia thành nhiều PR nhỏ

6. Wait for REVIEW
   → Không implement khi chưa có approval

7. Implement
   → Theo đúng spec và plan
   → Không tự ý thêm feature ngoài scope

8. Test
   → Unit test cho business logic
   → Integration test cho API
   → E2E nếu cần

9. Update docs
   → Cập nhật spec nếu có thay đổi so với plan
   → Cập nhật known-gaps.md nếu phát hiện gap mới
   → Cập nhật changelog
```

---

## DEFINITION OF DONE

Một backend feature được coi là "Done" khi:

- [ ] Spec rõ ràng, đã được review
- [ ] Plan rõ ràng
- [ ] Task checklist rõ ràng
- [ ] DTO validation đầy đủ (class-validator)
- [ ] Auth/Permission guard được check
- [ ] Privacy impact đã được đánh giá
- [ ] Transaction đúng chỗ nếu có nhiều write
- [ ] Domain error handling rõ ràng (không trả generic 500 cho business errors)
- [ ] Logging/audit đúng (không log sensitive data)
- [ ] Test coverage đủ
- [ ] Không log secret / token / password
- [ ] Không uncontrolled data leak ra ngoài
- [ ] Build / lint / test pass
- [ ] Docs đã được cập nhật

---

## KNOWN IMPLEMENTATION STATE (as of 2026-06-11)

| Item | State | Note |
|---|---|---|
| Prisma schema | **Ready (21 models)** | Đã apply thành công PostgreSQL + PostGIS migration ở local |
| User repository | In-memory mock | Dùng `Map<string, UserEntity>` (Chờ refactor sang Prisma) |
| Profile repository | In-memory mock | Dùng `Map<string, ProfileEntity>` (Chờ refactor sang Prisma) |
| Swipe repository | In-memory mock | (Chờ refactor sang Prisma) |
| Match repository | In-memory mock | (Chờ refactor sang Prisma) |
| Discovery repository | In-memory mock | (Chờ refactor sang Prisma) |
| Realtime gateway | Placeholder | Chỉ có ping/pong, không có auth |
| Notification service | Placeholder | In-app only trong tương lai |
| Storage | Không có | Chưa implement |
| Chat module | Không có | Chưa implement (text + image only) |
| Safety module | Không có | Chưa implement |
| CSRF protection | Không rõ | Cần review |
| Account status guard | Không rõ | JwtAccessGuard chưa check account status |
| `.env.example` | CÓ SECRET THẬT | SMTP_PASSWORD và GOOGLE_CLIENT_ID chứa giá trị thật |

Chi tiết: `spec/global/known-gaps.md`

---

## FILE STRUCTURE

```text
/be
  CLAUDE.md             ← File này. Đọc trước khi làm gì.
  AGENTS.md             ← Agent permission và rules
  README.md             ← Quick start
  .env.example          ← Đã được sanitize
  prisma/
    schema.prisma       ← Chứa 21 domain models
  src/
    main.ts             ← Bootstrap (prefix /api, cookie-parser, cors, swagger)
    app.module.ts
    config/
    database/           ← PrismaService
    redis/              ← RedisService
    health/             ← Health check endpoint
    realtime/           ← Socket.IO gateway (placeholder)
    notifications/      ← Notification service (placeholder)
    modules/
      auth/             ← Auth module (controllers, services, repositories, guards, strategies)
      profile/          ← Profile module (controllers, services, repositories)
      discovery/        ← Discovery module (controllers, services, repositories)
      swipe/            ← Swipe module (controllers, services, repositories)
      match/            ← Match module (controllers, services, repositories)
  test/
    app.e2e-spec.ts
    discovery.e2e-spec.ts
    match.e2e-spec.ts
    profile.e2e-spec.ts
    swipe.e2e-spec.ts
  spec/
    README.md
    global/             ← Quy tắc chung
    modules/            ← Module specs
    features/           ← Feature specs (existing)
    use-cases/          ← Use case catalog (mới)
```

---

## API CONVENTIONS

- Global prefix: `/api`
- Swagger: `/docs`
- Socket namespace: `/realtime`
- Auth: HTTP-only cookie (`access_token`, `refresh_token`)
- Validation: `class-validator` + `ValidationPipe` global
- Error format: xem `spec/global/error-handling.md`
- API guideline: xem `spec/global/api-guidelines.md`

---

## REFERENCES

- Business rules: `spec/global/business-rules.md`
- Privacy rules: `spec/global/privacy-rules.md`
- Security: `spec/global/security.md`
- API guidelines: `spec/global/api-guidelines.md`
- Error handling: `spec/global/error-handling.md`
- Logging/monitoring: `spec/global/logging-monitoring-audit.md`
- Testing strategy: `spec/global/testing-strategy.md`
- Implementation workflow: `spec/global/implementation-workflow.md`
- Known gaps: `spec/global/known-gaps.md`
- Open questions: `spec/global/open-questions.md`
- Use case catalog: `spec/use-cases/USE_CASE_CATALOG.md`
- Core flows: `spec/use-cases/CORE_FLOWS.md`
- System context: `spec/global/system-context.md`
