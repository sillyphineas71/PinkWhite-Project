# ⚠️ FILE NÀY ĐÃ BỊ MOVED

**Đã chuyển sang:** `be/GIT_WORKFLOW.md` (root của backend project)

Git workflow áp dụng cho toàn bộ repo nên được đặt ở root, không phải trong `spec/global/`.

**Không cập nhật file này nữa. Đọc và cập nhật `GIT_WORKFLOW.md` ở root.**

---

# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial git workflow và commit convention cho solo developer | Toàn bộ file |

---

# Git Workflow — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa quy trình Git và chuẩn commit message cho dự án. Dự án là **solo project** — một developer — nên workflow được tối giản nhưng vẫn giữ tính chuyên nghiệp và traceability.

---

## GW-01: Branch Strategy

### GW-01-01: Main branches

| Branch | Mục đích |
|---|---|
| `main` | Production-ready code. Luôn stable. |
| `develop` | Integration branch. Feature branches merge vào đây. |

### GW-01-02: Supporting branches

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

### GW-01-03: Branch naming rules
- Lowercase, kebab-case.
- Ngắn gọn nhưng mô tả đúng scope.
- Bao gồm module nếu liên quan: `<prefix>/<module>-<description>`.

```bash
# ✅ Tốt
feat/auth-refresh-token-rotation
fix/profile-age-calculation
docs/spec-business-rules
refactor/swipe-repository-prisma
test/match-creation-idempotency

# ❌ Không tốt
feat/new-stuff
fix/bug
my-branch
update
```

---

## GW-02: Commit Convention

Dự án dùng **Conventional Commits** (https://www.conventionalcommits.org/).

### GW-02-01: Format cơ bản

```
<type>(<scope>): <subject>

[body]

[footer]
```

### GW-02-02: Type — bắt buộc

| Type | Dùng khi |
|---|---|
| `feat` | Thêm feature mới |
| `fix` | Sửa bug |
| `docs` | Cập nhật documentation, spec, README, CLAUDE.md |
| `refactor` | Refactor code (không thêm feature, không sửa bug) |
| `test` | Thêm hoặc sửa tests |
| `chore` | Maintenance: deps, build, config, CI |
| `perf` | Cải thiện performance |
| `style` | Code style (format, lint — không đổi logic) |
| `security` | Security fix hoặc hardening |
| `revert` | Revert commit trước |
| `wip` | Work in progress — chỉ dùng trên feature branch, KHÔNG merge vào develop/main |

### GW-02-03: Scope — khuyến khích

Scope là module hoặc khu vực bị ảnh hưởng:

```
auth | profile | discovery | swipe | match | chat | realtime
notifications | safety | storage | common | database | config
spec | docs | deps | ci
```

### GW-02-04: Subject — quy tắc

- Dùng **tiếng Anh**.
- **Imperative mood** (câu mệnh lệnh): "add", "fix", "update", "remove" — **không phải** "added", "fixed", "updating".
- **Không** viết hoa chữ đầu.
- **Không** có dấu chấm (`.`) ở cuối.
- Tối đa **72 ký tự**.

```bash
# ✅ Tốt
feat(auth): add refresh token rotation with session invalidation
fix(discovery): exclude blocked users from feed query
docs(spec): add business rules for swipe quota

# ❌ Không tốt
feat(auth): Added refresh token.    ← past tense + dấu chấm
Fix bug                              ← không có scope, không mô tả
update stuff                         ← quá mơ hồ
feat(auth): implement the complete authentication system with refresh token rotation and session management ← quá dài
```

---

## GW-03: Commit Message Examples

### Feature mới

```
feat(auth): add Google OAuth login with server-side id_token verification

Implement UC-AUTH-010. Backend verifies Google id_token using google-auth-library
before creating or linking account. Does not store OAuth access token.

Refs: spec/features/auth/auth-uc009-google-oauth.md
```

```
feat(swipe): implement like quota with rolling 24-hour window

Free users limited to 50 likes per 24-hour rolling window.
Super likes have separate quota of 5 per day.
Quota tracked in Redis with TTL-based expiry.

Refs: spec/modules/swipe/module.md, BR-07-04
```

```
feat(safety): add block user with mutual invisibility

Block creates bidirectional invisibility:
- Discovery excludes blocked users in both directions
- Active match hidden from both users' inbox
- New messages disabled between pair

Refs: spec/modules/safety/module.md, BR-10-01
```

### Bug fix

```
fix(auth): clear cookie with correct path on logout

Cookie was set with Path=/api but cleared with Path=/.
Browser did not remove cookie, allowing stale session to persist.

Fixes: GAP-14 in spec/global/known-gaps.md
```

```
fix(profile): use exact date comparison for minimum age validation

Previous implementation used currentYear - birthYear which incorrectly
allowed users born late in the year to pass the 18-year check.
Now uses day-accurate calculation (dob + 18 years <= today).

Fixes: BR-03-01
```

```
fix(discovery): apply block filter to feed query

Discovery feed was not excluding users with a block relationship.
Added bidirectional block check using safety.isBlocked(a, b) || isBlocked(b, a).

Fixes: GAP-16 in spec/global/known-gaps.md
```

### Refactor

```
refactor(auth): replace in-memory UserRepository with Prisma implementation

Migrate UserRepository from Map<string, UserEntity> to Prisma-backed
implementation. Maintains same interface contract. All existing unit tests pass.

Part of: Phase 2 - Core Infrastructure
```

```
refactor(common): extract age calculation to shared utility

Move age calculation logic from ProfileService to common/utils/age.util.ts
for reuse across profile, discovery, and swipe eligibility checks.
```

### Documentation

```
docs(spec): add comprehensive business rules for dating platform

Initial documentation foundation (Phase 0). Covers auth, onboarding,
age validation, photo approval, location privacy, discovery eligibility,
swipe quota, match creation, chat permission, safety, and notifications.

No code implementation performed.
```

```
docs(claude): rewrite CLAUDE.md as production backend agent guide

Add golden rules, module boundary definitions, tech stack corrections
(Prisma not TypeORM), implementation workflow, and known implementation
state table.
```

### Test

```
test(auth): add unit tests for refresh token rotation

Test scenarios:
- Valid refresh token → new token pair issued, old token revoked
- Already-used refresh token → 401 (rotation enforcement)
- Expired refresh token → 401
```

```
test(discovery): add integration tests for feed eligibility filtering

Verify feed excludes: banned, hidden, unverified, not-onboarded users,
blocked users (both directions), already-swiped users, and self.
Privacy: assert no dob or exact location in response.
```

### Security

```
security(auth): implement account status guard for all authenticated routes

Add AccountStatusGuard that checks account.isBanned, account.isSuspended,
and account.deletedAt after JWT verification. Returns 403 if account
is not active. Closes GAP-05.
```

```
security(realtime): add JWT authentication to Socket.IO gateway

Extract and verify JWT from HTTP-only cookie on socket handshake.
Attach userId to socket.data. Reject connection if token missing or invalid.
Closes GAP-06.
```

### Chore

```
chore(deps): upgrade @nestjs/* packages to v11.1.x

Update all NestJS packages to latest v11.1.x.
Run test suite to verify no breaking changes.
```

```
chore(env): remove real credentials from .env.example

Replace SMTP_PASSWORD and GOOGLE_CLIENT_ID with placeholder values.
Closes GAP-03 (security risk).
```

### Hotfix

```
hotfix(auth): revoke all sessions after password change

Sessions were not invalidated after password change, allowing
old sessions to remain active. All sessions for user are now
revoked immediately upon password update.
```

---

## GW-04: Multi-line Commit Body

Dùng body khi cần giải thích **tại sao** (not just what):

```
feat(match): implement idempotent match creation with DB unique constraint

Match creation must be idempotent to handle:
1. Race condition when two like events arrive simultaneously
2. Event processor retry (at-least-once delivery guarantee)

Implementation:
- DB unique constraint on (min(userIdA, userIdB), max(userIdA, userIdB))
- upsert pattern with conflict handling
- Worker checks for existing active match before inserting

Without this, mutual likes under high concurrency could create
duplicate match records, corrupting the user's inbox.

Refs: BR-08-02, spec/modules/match/module.md, GAP-17
```

---

## GW-05: Footer — References

Footer dùng để reference spec, issue, gap:

```
Refs: spec/modules/auth/module.md       ← tham chiếu spec
Fixes: GAP-05                           ← đóng một known gap
Closes: OQ-01-03                        ← trả lời một open question
Breaking: change cookie path from / to /api  ← breaking change
```

---

## GW-06: Commit Scope cho Docs / Spec

Khi chỉ update documentation (không có code):

```
docs(spec): <description>              ← spec files
docs(claude): <description>            ← CLAUDE.md
docs(readme): <description>            ← README files
docs(changelog): <description>         ← changelog riêng
```

---

## GW-07: WIP Commits

Trên feature branch, được phép dùng `wip:` cho intermediate saves:

```
wip(auth): partial implementation of CSRF double submit cookie

NOT for merge. Saving progress on CSRF middleware.
Token generation done. Validation middleware in progress.
```

Trước khi merge vào develop: **squash hoặc rebase** các WIP commits thành commits có nghĩa.

---

## GW-08: Workflow cho Solo Developer

```
# 1. Tạo feature branch từ develop
git checkout develop
git pull origin develop
git checkout -b feat/auth-account-status-guard

# 2. Code và commit theo từng logical unit
git add src/modules/auth/guards/account-status.guard.ts
git commit -m "security(auth): implement AccountStatusGuard for active account check"

git add src/modules/auth/strategies/jwt-access.strategy.ts
git commit -m "refactor(auth): integrate account status check in JWT strategy validate"

git add test/auth.e2e-spec.ts
git commit -m "test(auth): add e2e test for banned account returns 403"

# 3. Update docs nếu cần
git add spec/global/known-gaps.md
git commit -m "docs(spec): mark GAP-05 as resolved"

# 4. Merge vào develop
git checkout develop
git merge --no-ff feat/auth-account-status-guard -m "feat(auth): add account status guard (closes GAP-05)"

# 5. Xóa feature branch
git branch -d feat/auth-account-status-guard
```

---

## GW-09: Merge Strategy

| Merge type | Khi nào dùng |
|---|---|
| `--no-ff` (merge commit) | Feature branch → develop. Giữ history rõ ràng. |
| `--ff-only` | Hotfix nhỏ, 1 commit. |
| `squash` | Squash WIP commits trên feature branch trước khi merge. |
| `rebase` | Sync feature branch với develop (trước khi merge). |

```bash
# Cập nhật feature branch với changes mới từ develop
git rebase develop

# Merge feature vào develop với merge commit
git checkout develop
git merge --no-ff feat/safety-block-module
```

---

## GW-10: Tag Convention

Dùng Semantic Versioning (`vMAJOR.MINOR.PATCH`):

| Tag | Khi nào |
|---|---|
| `v0.1.0` | Phase 1 complete (DB schema + core infrastructure) |
| `v0.2.0` | Phase 2 complete (Safety + Storage) |
| `v0.3.0` | Phase 3 complete (Chat + Realtime) |
| `v1.0.0` | Production launch ready |

```bash
git tag -a v0.1.0 -m "feat: Phase 1 complete - Prisma DB migration from mock repositories"
git push origin v0.1.0
```

---

## GW-11: .gitignore Checklist

Đảm bảo các file sau KHÔNG bao giờ được commit:

```gitignore
# Environment — NEVER commit
.env
.env.local
.env.production

# Build output
dist/
generated/

# Dependencies
node_modules/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/

# Test coverage
coverage/
```

> ⚠️ **CRITICAL:** `.env` phải luôn có trong `.gitignore`. Xem GAP-03 — `.env.example` hiện chứa real credentials cần được thay bằng placeholders ngay.

---

## GW-12: Quick Reference Card

```
feat(scope): add something new
fix(scope): correct a bug
docs(spec): update documentation
refactor(scope): improve code structure
test(scope): add or update tests
chore(deps): maintenance tasks
perf(scope): performance improvement
security(scope): security hardening
style(scope): formatting only
revert: revert commit abc123

Scope: auth | profile | discovery | swipe | match | chat
       realtime | safety | storage | notifications | common | database
       spec | docs | deps | config | ci

Subject rules:
  - English
  - imperative mood (add, fix, update, remove)
  - no capital first letter
  - no dot at end
  - max 72 chars
```
