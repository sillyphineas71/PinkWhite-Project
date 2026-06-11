# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Create GIT_WORKFLOW.md at be/ root level — moved from spec/global/git-workflow.md | Toàn bộ file |

---

# Git Workflow — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa quy trình Git và chuẩn commit message. Áp dụng cho toàn bộ repository. Dự án là **solo project** — một developer — nên workflow được tối giản nhưng giữ tính chuyên nghiệp và traceability.

---

## GW-01: Branch Strategy

### Main branches

| Branch | Mục đích |
|---|---|
| `main` | Production-ready code. Luôn stable. |
| `develop` | Integration branch. Feature branches merge vào đây. |

### Supporting branches

| Prefix | Dùng khi | Ví dụ |
|---|---|---|
| `feat/` | Thêm feature mới | `feat/auth-google-oauth` |
| `fix/` | Sửa bug | `fix/discovery-block-filter` |
| `docs/` | Cập nhật documentation/spec | `docs/business-rules-update` |
| `refactor/` | Refactor không thêm feature, không sửa bug | `refactor/auth-repository-prisma` |
| `test/` | Thêm/sửa tests | `test/swipe-idempotency-unit` |
| `chore/` | Maintenance: update deps, config, scripts | `chore/update-nestjs-v11` |
| `hotfix/` | Fix khẩn cấp trực tiếp từ main | `hotfix/cookie-clear-path` |
| `perf/` | Performance improvement | `perf/discovery-query-index` |
| `security/` | Security fix | `security/csrf-protection` |

### Branch naming rules
- Lowercase, kebab-case.
- Bao gồm module nếu liên quan: `<prefix>/<module>-<description>`.

```bash
# ✅ Tốt
feat/auth-refresh-token-rotation
fix/profile-age-calculation
docs/spec-business-rules
security/account-status-guard

# ❌ Không tốt
feat/new-stuff
fix/bug
update
```

---

## GW-02: Commit Convention

Dự án dùng **Conventional Commits**.

### Format

```
<type>(<scope>): <subject>

[body — tùy chọn]

[footer — tùy chọn]
```

### Type — bắt buộc

| Type | Dùng khi |
|---|---|
| `feat` | Thêm feature mới |
| `fix` | Sửa bug |
| `docs` | Documentation, spec, README, CLAUDE.md, AGENTS.md |
| `refactor` | Refactor không thêm feature, không sửa bug |
| `test` | Thêm hoặc sửa tests |
| `chore` | Maintenance: deps, build, config |
| `perf` | Cải thiện performance |
| `style` | Format, lint — không đổi logic |
| `security` | Security fix hoặc hardening |
| `revert` | Revert commit trước |
| `wip` | Work in progress — chỉ trên feature branch |

### Scope — theo module

```
auth | profile | discovery | swipe | match | chat | realtime
notifications | safety | storage | common | database | config
spec | docs | deps | ci
```

### Subject rules
- **Tiếng Anh**
- **Imperative mood**: `add`, `fix`, `update`, `remove` — không phải `added`, `fixed`
- Không viết hoa chữ đầu
- Không dấu chấm (`.`) ở cuối
- Tối đa **72 ký tự**

---

## GW-03: Commit Examples

### Feature
```
feat(auth): add refresh token rotation with session invalidation
feat(safety): implement block user with mutual invisibility
feat(swipe): add like quota with rolling 24-hour window
```

### Fix
```
fix(auth): clear cookie with correct path on logout
fix(profile): use exact date comparison for minimum age validation
fix(discovery): apply block filter to feed query
```

### Security
```
security(auth): add AccountStatusGuard after JWT verification
security(realtime): add JWT authentication to Socket.IO gateway
security(env): remove real credentials from .env.example
```

### Docs
```
docs(spec): add business rules for swipe quota and rewind
docs(claude): rewrite CLAUDE.md as production backend agent guide
docs(agents): upgrade AGENTS.md with golden rules and module boundary
```

### Refactor
```
refactor(auth): replace in-memory UserRepository with Prisma implementation
refactor(common): extract age calculation to shared utility
```

### Test
```
test(auth): add unit tests for refresh token rotation
test(discovery): add integration tests for feed eligibility filtering
```

### Chore
```
chore(deps): upgrade @nestjs/* packages to v11.1.x
chore(env): replace real credentials in .env.example with placeholders
```

### Hotfix
```
hotfix(auth): revoke all sessions after password change
```

---

## GW-04: Commit Body — Khi nào cần

Dùng body khi cần giải thích **tại sao** (not just what):

```
feat(match): implement idempotent match creation with DB unique constraint

Match creation must be idempotent to handle:
1. Race condition when two like events arrive simultaneously
2. Event processor retry (at-least-once delivery guarantee)

DB unique constraint on normalized pair (min(a,b), max(a,b)).
Worker uses upsert with conflict handling.

Refs: BR-08-02, spec/modules/match/module.md, GAP-17
```

---

## GW-05: Footer References

```
Refs: spec/modules/auth/module.md     ← tham chiếu spec
Fixes: GAP-05                         ← đóng known gap
Closes: OQ-01-03                      ← trả lời open question
Breaking: cookie path changed from / to /api
```

---

## GW-06: WIP Commits

Trên feature branch, được phép dùng `wip:`:

```
wip(auth): partial CSRF double submit cookie — validation in progress
```

**Trước khi merge vào develop:** squash hoặc rebase các WIP commits thành commits có nghĩa.

---

## GW-07: Solo Developer Workflow

```bash
# 1. Tạo feature branch từ develop
git checkout develop && git pull
git checkout -b feat/auth-account-status-guard

# 2. Commit theo logical units nhỏ
git add src/modules/auth/guards/account-status.guard.ts
git commit -m "security(auth): implement AccountStatusGuard for active account check"

git add test/auth.e2e-spec.ts
git commit -m "test(auth): verify banned account returns 403 after JWT auth"

git add spec/global/known-gaps.md
git commit -m "docs(spec): mark GAP-05 as resolved"

# 3. Sync với develop nếu có changes mới
git rebase develop

# 4. Merge vào develop
git checkout develop
git merge --no-ff feat/auth-account-status-guard \
  -m "feat(auth): add account status guard (closes GAP-05)"

# 5. Xóa branch
git branch -d feat/auth-account-status-guard
```

---

## GW-08: Merge Strategy

| Strategy | Khi nào |
|---|---|
| `--no-ff` | Feature branch → develop. Giữ history rõ ràng. |
| `--ff-only` | Hotfix nhỏ, 1 commit |
| Squash trước khi merge | Nhiều WIP commits trên branch |
| Rebase | Sync feature branch với develop |

---

## GW-09: Tag Convention

```
v0.1.0  ← Phase 1: DB schema + core infrastructure
v0.2.0  ← Phase 2: Safety + Storage
v0.3.0  ← Phase 3: Chat + Realtime
v1.0.0  ← Production launch
```

```bash
git tag -a v0.1.0 -m "feat: Phase 1 complete - Prisma repositories"
git push origin v0.1.0
```

---

## GW-10: .gitignore Checklist

```gitignore
# NEVER commit
.env
.env.local
.env.production

# Build
dist/
generated/

# Dependencies
node_modules/

# OS / IDE
.DS_Store
.vscode/settings.json
```

> ⚠️ `.env` phải luôn có trong `.gitignore`. Xem GAP-03 — `.env.example` hiện chứa real credentials cần thay bằng placeholder ngay.

---

## Quick Reference

```
feat(scope): add something new
fix(scope): correct a bug
docs(spec): update documentation
refactor(scope): improve code structure
test(scope): add or update tests
security(scope): security hardening
chore(deps): maintenance tasks
perf(scope): performance improvement
wip(scope): work in progress (branch only)

Scope: auth | profile | discovery | swipe | match | chat
       realtime | safety | storage | notifications | common
       database | spec | docs | deps | config | ci

Rules:
  - English, imperative mood
  - no capital first letter
  - no dot at end
  - max 72 chars subject
```
