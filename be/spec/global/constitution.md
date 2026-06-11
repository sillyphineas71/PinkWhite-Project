# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Rewrite — production-grade constitution cho dating/social matchmaking backend | Toàn bộ file |

---

# Constitution — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa các nguyên tắc nền tảng không thể thương lượng của backend. Mọi quyết định kiến trúc, implementation và design đều phải tuân theo.

---

## CONST-01: Spec-Driven Development

Backend được phát triển theo Spec-Driven Development (SDD).

**Rule:** Không viết code logic nếu chưa có Spec được approve.

**Flow bắt buộc:**
```
Requirement → Spec → Plan → Tasks → Review → Implement → Test → Docs
```

**Source of truth priority:**
1. User request mới nhất
2. Database decision đã được approve
3. Global specs (`spec/global/`)
4. Module specs (`spec/modules/`)
5. Use case specs (`spec/use-cases/`)
6. API contract
7. `CLAUDE.md`
8. Code hiện tại

---

## CONST-02: Privacy & Safety First

Privacy và Safety là **first-class requirements**, không phải "làm sau" hay "feature optional".

**Rules:**
- Least privilege data exposure — mỗi actor chỉ thấy data họ cần.
- Không expose exact location cho other users.
- Không expose DOB cho other users.
- No unrestricted profile lookup.
- Block creates mutual invisibility — high priority.
- Safety over engagement metrics.

Xem chi tiết: `spec/global/privacy-rules.md`, `spec/global/security.md`.

---

## CONST-03: Business Rule Enforcement

Business rules phải được enforce ở đúng layer:

| Rule type | Enforce ở đâu |
|---|---|
| DTO validation (format) | DTO + class-validator (Controller layer) |
| Domain business rules | Service layer |
| Data integrity constraints | Database (unique, foreign key, check) |
| Auth/permission | Guard (before Controller) |

**Rules:**
- Không đặt business logic quan trọng trong Controller.
- Không đặt database constraint responsibility vào Service layer — DB phải enforce tại nguồn.
- Prisma là data access layer duy nhất — không import Prisma trực tiếp ở Service.

---

## CONST-04: Database Design Principle

- Database constraint phải bảo vệ invariants quan trọng (unique match pair, unique email, etc.).
- Soft delete được ưu tiên hơn hard delete cho hầu hết entities.
- Schema phải được debate và approve bởi human reviewer trước khi implement.
- Không tự ý chốt schema mà không có approval.

---

## CONST-05: Security Baseline

**Không thể thương lượng:**
- Password phải hash bằng bcrypt.
- JWT phải lưu trong HTTP-only cookie.
- Production: không expose stack trace.
- Production: HTTPS only.
- Auth endpoints phải có rate limiting.
- CSRF protection cho mutation endpoints.
- Không hardcode secrets.

---

## CONST-06: Mock ≠ Production

Code hiện tại dùng in-memory repositories. Đây là **prototype state**, không phải production baseline.

**Rules:**
- Không coi in-memory behavior là business rule nguồn gốc.
- Khi chuyển sang Prisma: validate tất cả business rules theo spec, không theo mock behavior.
- Không scale với mock — phải chuyển sang real DB.

---

## CONST-07: API Contract Stability

- API contract phải được spec trước khi implementation.
- Breaking change phải được thông báo rõ.
- Response format phải consistent theo `spec/global/api-guidelines.md`.
- Error format phải consistent theo `spec/global/error-handling.md`.

---

## CONST-08: Logging Discipline

- Không log sensitive data (xem danh sách trong `spec/global/logging-monitoring-audit.md`).
- Structured logging trong production.
- Audit events phải được persist, không chỉ log.

---

## CONST-09: Test Coverage

- P0 features phải có unit tests + integration tests.
- Critical business rules phải có unit tests.
- E2E phải cover toàn bộ P0 core flow.
- Build/lint/test phải pass trước khi merge.

---

## CONST-10: Module Independence

- Module không được import internal implementation của module khác trực tiếp.
- Cross-module communication qua service interface hoặc events.
- Module boundary phải rõ — xem `CLAUDE.md` và `spec/modules/<module>/module.md`.

---

## CONST-11: Coding Standards

### Architecture
Mỗi module tuân theo pattern:
```
Controller → Service → Repository → PrismaService
```
- `Controller`: chỉ handle HTTP. **Không** đặt business logic.
- `Service`: business logic, permission check, domain rules.
- `Repository`: Prisma queries, data transformation.
- `PrismaService`: Prisma client wrapper. **Không** có business logic.
- **Không** import `PrismaService` trực tiếp trong `Service`.

### TypeScript
- Strict mode. Không dùng `any` nếu có thể tránh.
- Interface, type, DTO phải define rõ ràng.

### Validation
- Mọi input phải qua DTO + `class-validator`.
- `ValidationPipe` global: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

### Error Handling
- Không throw raw `Error` — dùng `HttpException` hoặc domain exception.
- Domain errors phải có error code theo `spec/global/api-guidelines.md`.
- Production: không expose stack trace.

### Logging
- Không log sensitive data — xem `spec/global/logging-monitoring-audit.md` LMA-02.
- Structured JSON logging trong production.
- Mọi request phải có `requestId`.

### Secrets & Config
- Tất cả config đọc từ env qua `@nestjs/config`.
- Không hardcode port, URL, secret.
- `.env.example` chỉ được chứa **placeholder** values — không bao giờ commit real credentials.

### Code Style
- ESLint + Prettier enforced.
- Commit theo Conventional Commits — xem `GIT_WORKFLOW.md`.
- Không để `TODO` comment trong code — phải resolve hoặc ghi vào `spec/global/known-gaps.md`.

### Realtime
- Socket auth bắt buộc trước khi join room.
- Room naming: dùng `matchId` UUID, không dùng userId trực tiếp.

### Testing
- Test file: `<name>.spec.ts` (unit), `<name>.e2e-spec.ts` (E2E).
- Mock external services trong tests.
- Dùng đúng global prefix `/api` trong tests.
- Xem `spec/global/testing-strategy.md` cho chi tiết.
