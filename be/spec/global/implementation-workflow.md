# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial implementation workflow spec cho dating/social matchmaking backend | Toàn bộ file |

---

# Implementation Workflow — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa quy trình phát triển chuẩn cho backend. Mọi agent và developer phải follow workflow này.

---

## IW-01: Spec-Driven Development (SDD) Principles

### IW-01-01: Core principle
Không viết bất kỳ dòng code logic nào nếu chưa có Spec được approve.

Thứ tự bắt buộc:
```
Requirement → SPEC → PLAN → TASKS → REVIEW → IMPLEMENT → TEST → DOCS
```

### IW-01-02: Không được skip steps
- Không được implement trực tiếp từ "yêu cầu miệng" mà không có spec.
- Không được bỏ qua REVIEW step.
- Không được merge code khi test chưa pass.

---

## IW-02: Full Development Workflow

### Step 1: Clarify Requirement

**Input:** User request hoặc feature task.

**Actions:**
- Đọc `CLAUDE.md`, `AGENTS.md`, spec liên quan.
- Hiểu rõ: actor, goal, preconditions, happy flow, unhappy flows.
- Xác định module boundary.
- Flag bất kỳ ambiguity nào — hỏi trước khi assume.

**Output:** Clear understanding of requirement.

---

### Step 2: Lock Scope

**Actions:**
- Xác định rõ: task này làm gì, không làm gì.
- List các dependency: cần modules khác không?
- Nếu cần database decision: flag và chờ (không tự assume schema).
- Ghi rõ Out of Scope items.

**Output:** Scope statement.

---

### Step 3: Write / Update SPEC

**Actions:**
- Tạo hoặc cập nhật spec file trong `spec/modules/<module>/` hoặc `spec/features/`.
- Spec phải cover:
  - Goal + Actor + Preconditions
  - API design (endpoint, request, response, status codes)
  - Business rules (tham chiếu `spec/global/business-rules.md`)
  - Privacy / Security notes
  - Data model requirements (concept, không phải final schema)
  - Events nếu có
  - Happy flow + Unhappy flows
  - Open questions nếu còn
- Cập nhật changelog trong file spec.
- Nếu spec mới: thêm vào Use Case Catalog.

**Output:** Spec file.

---

### Step 4: Write PLAN

**Actions:**
- Technical implementation plan.
- List các files cần tạo/sửa.
- Xác định dependencies và thứ tự implement.
- Xác định database operations nếu có.
- Xác định transaction boundaries.

**Output:** Plan document (có thể trong spec file hoặc riêng).

---

### Step 5: Write TASKS

**Actions:**
- Task checklist chi tiết.
- Mỗi task: đủ nhỏ để implement trong 1-2 giờ.
- Mark dependencies rõ ràng.

**Output:** Task list (trong spec hoặc trong todo comment).

---

### Step 6: Wait for REVIEW

**Actions:**
- Trình bày spec + plan + tasks cho reviewer.
- Không implement khi chưa có approval.
- Nếu reviewer có feedback: cập nhật spec và plan trước khi proceed.

**Output:** Reviewer approval.

---

### Step 7: Implement

**Actions:**
- Implement theo đúng spec và plan.
- Không tự ý thêm feature ngoài scope.
- Cấu trúc module: `Controller → Service → Repository → Prisma`.
- Không put business logic trong Controller.
- Validate DTO đầy đủ.
- Handle errors đúng theo `spec/global/error-handling.md`.
- Log đúng theo `spec/global/logging-monitoring-audit.md`.
- Không log sensitive data.

**Output:** Working implementation.

---

### Step 8: Test

**Actions:**
- Viết unit tests cho business logic mới.
- Viết integration tests cho API endpoints mới.
- Chạy existing tests: verify không break.
- E2E nếu feature là P0/P1.

**Output:** All tests pass.

---

### Step 9: Update Docs

**Actions:**
- Cập nhật spec nếu implementation có deviation so với plan (và document lý do).
- Cập nhật `known-gaps.md` nếu phát hiện gap mới.
- Cập nhật changelog trong spec files đã thay đổi.
- Cập nhật `open-questions.md` nếu question đã được chốt.

**Output:** Up-to-date documentation.

---

## IW-03: Phase Planning

### Phase 0: Documentation Foundation (CURRENT)
**Status:** In progress (task này).

**Goal:** Chuẩn hóa toàn bộ documentation/spec. Không implement code.

**Deliverables:**
- CLAUDE.md (rewrite)
- spec/global/business-rules.md
- spec/global/privacy-rules.md
- spec/global/security.md
- spec/global/system-context.md
- spec/global/api-guidelines.md
- spec/global/error-handling.md
- spec/global/logging-monitoring-audit.md
- spec/global/testing-strategy.md
- spec/global/implementation-workflow.md
- spec/global/known-gaps.md
- spec/global/open-questions.md
- spec/global/data-governance.md
- spec/global/constitution.md
- spec/use-cases/USE_CASE_CATALOG.md
- spec/use-cases/CORE_FLOWS.md
- spec/modules/* (10 modules)

---

### Phase 1: Database Schema Design
**Status:** Chờ Phase 0 complete.

**Goal:** Human reviewer + user debate và chốt final database schema.

**Activities:**
- Review data model requirements trong spec.
- Design Prisma schema cho tất cả entities.
- Agree on: soft delete strategy, unique constraints, indexes, outbox table.
- Agree on: PostGIS vs plain lat/lng.

**Output:** Approved `prisma/schema.prisma`.

**CRITICAL:** Agent không được tự ý design final schema trước khi có human approval.

---

### Phase 2: Core Infrastructure
**Status:** Chờ Phase 1.

**Goal:** Chuyển từ in-memory mock sang Prisma + PostgreSQL.

**Scope:**
- Replace tất cả mock repositories bằng Prisma implementations.
- Implement account status guard.
- Implement CSRF protection.
- Implement request ID middleware.
- Implement global exception filter chuẩn.
- Fix Socket.IO CORS từ env.
- Fix E2E test prefix.
- Fix `.env.example` (remove real credentials).
- Rate limiting trên auth endpoints.

---

### Phase 3: Safety Module
**Status:** Chờ Phase 2.

**Goal:** Block/Report là P0 safety requirements.

**Scope:**
- Block user (mutual invisibility).
- Report user.
- Apply block filter trong discovery, match, chat.
- Apply block/unmatch check trong chat permission.

---

### Phase 4: Storage Module
**Status:** Chờ Phase 2.

**Goal:** Real photo upload flow.

**Scope:**
- Choose storage provider (S3/Cloudinary).
- Implement presigned URL generation.
- Implement upload confirmation.
- Photo approval workflow.

---

### Phase 5: Chat Module
**Status:** Chờ Phase 3.

**Goal:** Real-time messaging.

**Scope:**
- Message persistence (DB).
- Chat permission check.
- Socket.IO auth.
- Match room management.
- Read receipts (persistence).
- Typing indicator (realtime only).
- Online status (Redis presence).

---

### Phase 6: In-app Notifications
**Status:** Chờ Phase 5.

**Goal:** Real notification delivery.

**Scope:**
- Persist notification records.
- Read/unread notification API if needed.
- Suppression rules.
- Realtime notification event.

**Future:**
- Push provider.
- FCM/APNs.
- device_tokens table.

---

### Phase 7: Production Hardening
**Status:** Future.

**Goal:** Production readiness.

**Scope:**
- Structured logging (pino/winston).
- Monitoring setup (Prometheus / DataDog / CloudWatch).
- API versioning (if needed).
- Redis for session storage (real implementation).
- Audit log persistence.
- Security audit.
- Performance testing.

---

## IW-04: Definition of Done

Một backend feature/task được coi là "Done" khi:

- [ ] Spec đã được approve bởi reviewer
- [ ] Plan rõ ràng
- [ ] Task checklist complete
- [ ] DTO validation đầy đủ
- [ ] Auth + Account status guard được check
- [ ] Privacy impact đã review
- [ ] Transaction đúng chỗ nếu có nhiều writes
- [ ] Domain error handling rõ ràng
- [ ] Logging đúng (không log sensitive data)
- [ ] Unit tests pass
- [ ] Integration tests pass (khi có real DB)
- [ ] Không log secret / token / password
- [ ] Không data leak ra ngoài
- [ ] Build / lint / test pass
- [ ] Spec/docs đã update

---

## IW-05: Git Workflow (Recommended)

### Branch naming
```
feature/<module>-<short-description>
fix/<module>-<short-description>
docs/<description>
```

### Commit message
```
feat(auth): implement account status guard
fix(discovery): exclude blocked users from feed
docs(spec): add business rules for match creation
```

### PR checklist
- [ ] Tests pass
- [ ] No sensitive data logged
- [ ] Spec updated
- [ ] Changelog updated
- [ ] Reviewed by at least 1 person
