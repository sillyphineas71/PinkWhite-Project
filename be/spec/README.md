# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial spec README update | Toàn bộ file |

---

# Backend Spec

Khu vực spec cho backend Social Matchmaking Platform — Production-grade Dating App.

## Cấu trúc

```
spec/
  README.md                 ← File này
  global/                   ← Quy ước và rules chung cho toàn backend
    constitution.md         ← Nguyên tắc nền tảng + coding standards (CONST-11)
    product-overview.md     ← Product description và scope
    system-context.md       ← C4 diagram, domain flows
    business-rules.md       ← Toàn bộ business rules
    privacy-rules.md        ← Privacy rules và data visibility matrix
    security.md             ← Security requirements và known risks
    api-guidelines.md       ← REST conventions, response format, error codes
    error-handling.md       ← Exception handling, status mapping
    logging-monitoring-audit.md ← Log format, audit events, monitoring
    data-governance.md      ← Data classification và lifecycle
    testing-strategy.md     ← Unit/Integration/E2E strategy
    implementation-workflow.md ← SDD workflow, phase planning
    known-gaps.md           ← Known implementation gaps
    open-questions.md       ← Open questions cần human decision
    glossary.md             ← Thuật ngữ
    [DEPRECATED] system-arch.md      → Xem system-context.md
    [DEPRECATED] coding-standards.md → Gộp vào constitution.md CONST-11
    [MOVED] git-workflow.md           → Xem be/GIT_WORKFLOW.md (root)

  modules/                  ← Module-level specs (architecture overview)
    auth/
      module.md             ← Boundary, responsibilities, data model concept
    profile/
      module.md
    discovery/
      module.md
    swipe/
      module.md
    match/
      module.md
    chat/
      module.md
    realtime/
      module.md
    notifications/
      module.md
    safety/
      module.md
    storage/
      module.md

  use-cases/                ← Use case catalog và core flows
    USE_CASE_CATALOG.md     ← Tất cả use cases với status và priority
    CORE_FLOWS.md           ← Core flow diagrams (Mermaid)

  database/                 ← Database source of truth
    DATABASE_SOURCE_OF_TRUTH.md
    POSTGRESQL_SCHEMA_V1.md
    PRISMA_SCHEMA_V1_DRAFT.md
    ...

  _drafts/                  ← Draft / not yet aligned
    features/               ← Các feature specs đang cần align với DB baseline
      auth/
      profile/
      discovery/
      swipe/
      match/
      chat/
      safety/
      storage/
```

## Quy tắc

1. **Viết spec trước khi implement.** Không có exception.
2. **Mọi file spec phải có changelog.** Format: `| Date | Change | Sections |`.
3. **Không tạo file code trong thư mục spec.**
4. **Feature spec** mô tả use case từ góc nhìn business.
5. **Module spec** mô tả technical boundary và design.
6. **Global spec** là source of truth cho conventions chung.
7. **Nếu implementation khác spec:** báo gap, không tự ý sửa spec theo code.

## Source of Truth Priority

```
User request mới nhất
→ Active source of truth:
  - spec/database
  - spec/global
  - spec/use-cases
  - spec/modules
→ Draft / not yet aligned:
  - spec/_drafts/features
→ API contract
→ CLAUDE.md
→ src/ (code hiện tại — thấp nhất)
```

## Quick Links

- Agent guide: `../CLAUDE.md`
- Business rules: `global/business-rules.md`
- Privacy rules: `global/privacy-rules.md`
- Known gaps: `global/known-gaps.md`
- Open questions: `global/open-questions.md`
- Use case catalog: `use-cases/USE_CASE_CATALOG.md`
