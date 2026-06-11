# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Rewrite — comprehensive product overview cho dating/social matchmaking platform | Toàn bộ file |

---

# Product Overview — Dating / Social Matchmaking Platform

---

## PO-01: Product Description

Backend production-grade cho **Dating / Social Matchmaking Platform** — tương tự core loop của Tinder/Bumble/Hinge ở mức backend architecture.

**Đây KHÔNG phải:**
- App chat đơn giản.
- Profile CRUD demo.
- Swipe prototype.

**Đây LÀ:**
- Backend production-grade với privacy, safety, consistency và audit requirements thật.
- Foundation để build public-facing dating product.
- Hệ thống cần xử lý concurrent users, idempotent operations, và sensitive personal data.

---

## PO-02: Core Product Loop

```text
User đăng ký / đăng nhập
→ Xác thực email
→ Hoàn thành onboarding profile (name, dob, gender, photo, location, preferences)
→ Nhận discovery feed (personalized, filtered candidates)
→ Swipe: like / pass / super like
→ Mutual like tạo match (event-driven, idempotent)
→ Matched users có thể chat (realtime + persistent)
→ Safety controls: unmatch / block / report
→ Privacy rules bảo vệ mọi bước
```

---

## PO-03: Target User Groups

| Group | Role | Actions |
|---|---|---|
| Dating App User | End user | Register, onboard, swipe, match, chat, block, report |
| Admin | Internal | Moderate reports, ban/suspend accounts |
| Moderator | Internal | Review reports, approve/reject photos (nếu manual review) |

---

## PO-04: Core Modules

| Module | Responsibility | Status |
|---|---|---|
| `auth` | Login, register, session, token, account status | Partially implemented (mock) |
| `profile` | Onboarding, photos, location, bio, interests | Partially implemented (mock) |
| `discovery` | Feed generation, preferences, filtering | Partially implemented (mock) |
| `swipe` | Like, pass, super like, quota, rewind | Partially implemented (mock) |
| `match` | Match lifecycle, unmatch | Partially implemented (mock) |
| `chat` | Message persistence, read receipts, permission | Not implemented |
| `realtime` | Socket auth, rooms, events | Placeholder only |
| `notifications` | Push, in-app, email abstraction | Placeholder only |
| `safety` | Block, report, moderation | Not implemented |
| `storage` | Photo upload, media metadata | Not implemented |

---

## PO-05: Non-Functional Requirements

| Requirement | Target | Current State |
|---|---|---|
| Privacy | Least privilege, no DOB/exact location exposure | Partially enforced (mock) |
| Safety | Block mutual invisible, report flow | Not implemented |
| Idempotency | Match creation, swipe duplicate | Partially in mock |
| Auditability | Audit events for critical actions | Not implemented |
| Scalability | Multi-instance with Redis adapter | Not ready |
| Security | Cookie JWT, CSRF, rate limit, account status guard | Partially implemented |
| Testability | Unit + Integration + E2E | Basic E2E only |

---

## PO-06: What Is NOT In Scope (Current Phase)

- Subscription / Payment / Billing
- AI matching / recommendation / vector search
- Live streaming / Video call
- Advanced moderation AI / Automated content moderation
- Admin dashboard (detailed)
- Mobile push infrastructure phức tạp (beyond placeholder)
- Kafka / Microservices
- KYC / Face verification
- Boost feature (exposure boost)
- Rematch feature

Các items trên được ghi là **Future Improvement** hoặc **Out of Scope**.

---

## PO-07: Production Target vs Current State

| Aspect | Current State | Production Target |
|---|---|---|
| Database | No schema, no connection | PostgreSQL via Prisma, full schema |
| Repositories | In-memory mock | Prisma repositories |
| Auth | Mock session storage | Redis-backed session |
| Realtime | Placeholder gateway | Authenticated Socket.IO with match rooms |
| Notifications | Always throw Error | In-app only |
| Storage | None | S3 / Cloudinary |
| Safety | None | Block + Report module |
| Chat | None | Persistent + realtime |
| Monitoring | None | Health checks + metrics + alerting |
| Logging | NestJS Logger (unstructured) | Structured JSON (pino) |

---

## PO-08: Tech Stack Summary

| Component | Technology |
|---|---|
| Framework | NestJS v11 + TypeScript |
| ORM | Prisma v6 |
| Database | PostgreSQL |
| Cache / Session | Redis (ioredis) |
| Auth | Cookie-based JWT (access + refresh) |
| Realtime | Socket.IO v4 |
| Validation | class-validator + class-transformer |
| API Docs | Swagger / OpenAPI |
| Testing | Jest + Supertest |
| Email | Nodemailer (SMTP) |
| Push | Future Scope |
| OAuth | Google OAuth (server-side verify) |
| Password | bcrypt |
| Rate limiting | @nestjs/throttler |
