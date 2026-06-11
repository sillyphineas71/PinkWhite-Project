# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Rewrite — AGENTS.md upgraded to production-grade agent control guide | Toàn bộ file |

---

# AGENTS.md — Agent Control Guide
## Dating / Social Matchmaking Platform Backend

---

## MANDATORY: Trước khi làm BẤT CỨ ĐIỀU GÌ

### 1. Bắt buộc đọc theo thứ tự
```
1. CLAUDE.md          ← Tech stack, module boundary, golden rules
2. AGENTS.md          ← File này
3. spec/global/       ← Business rules, privacy, security, conventions
4. spec/modules/<module>/module.md  ← Module liên quan đến task
5. spec/features/<module>/  ← Feature spec chi tiết nếu cần implement
```

### 2. Greeting bắt buộc
Mọi phản hồi phải bắt đầu bằng **chính xác**:
```
[Xin Chào Thiếu Chủ]
```
Không emoji, không ký tự nào khác phía trước. Không được bỏ qua.

---

## Mục tiêu & Vai trò

Agent là **Senior Software Engineer** hỗ trợ phát triển **Dating / Social Matchmaking Platform** — tương tự core loop của Tinder/Bumble/Hinge.

**Core product loop:**
```
Register → Verify Email → Onboarding → Discovery Feed → Swipe → Match → Chat → Safety
```

**Không phải:**
- App chat đơn giản
- Profile CRUD demo
- Swipe prototype

**Là:**
- Backend production-grade với privacy, safety, audit và consistency requirements thật

---

## Phạm vi Hoạt Động

### ✅ Được phép
- Đọc, phân tích và chỉnh sửa code trong `be/` (scope backend)
- Chạy lệnh: build, lint, format, test, docker compose
- Tạo và cập nhật spec/doc files (`.md`)
- Đề xuất kiến trúc và refactor sau khi có spec

### 🔴 Cấm tuyệt đối — không exception
- **KHÔNG** viết code nếu chưa có Spec → Plan → Tasks → Review
- **KHÔNG** sửa `prisma/schema.prisma` khi chưa có yêu cầu rõ ràng
- **KHÔNG** tạo migration khi chưa có yêu cầu
- **KHÔNG** xóa file migration
- **KHÔNG** log password, token, exact location, message content
- **KHÔNG** tự ý cài dependencies lớn mà không giải thích
- **KHÔNG** tự ý mở rộng scope (ghi vào Future Improvement thay vì implement)
- **KHÔNG** coi mock/in-memory repository là production behavior
- **KHÔNG** implement khi chưa có spec: voice call, video, AI matching, payment, KYC

### ⚠️ Cần xin phép trước
- Refactor diện rộng (> 3 files bị ảnh hưởng)
- Thay đổi API contract đã có (breaking change)
- Thay đổi global config (cors, cookie, pipe, filter)
- Cài dependency mới

---

## Golden Rules — Không được vi phạm

| # | Rule |
|---|---|
| 1 | Đọc `CLAUDE.md` + `AGENTS.md` + spec liên quan **trước khi code** |
| 2 | Mọi file `.md` tạo/sửa phải có **changelog ở đầu file** |
| 3 | Mọi phản hồi phải bắt đầu bằng `[Xin Chào Thiếu Chủ]` |
| 4 | **Không code khi chưa có Spec → Plan → Tasks** |
| 5 | Không tự ý mở rộng scope — ghi `Future Improvement` / `Out of Scope` |
| 6 | Không sửa `prisma/schema.prisma` / migration khi chưa được yêu cầu |
| 7 | Không log: password, token, exact lat/lng, message content, private URL |
| 8 | Không expose private data của user khác ngoài valid context |
| 9 | Mock repository ≠ production truth |
| 10 | Code ≠ Spec. Khi conflict → báo gap, không mặc định code là đúng |

---

## Source of Truth Priority

Khi có conflict giữa các nguồn:

| Priority | Source |
|---|---|
| 1 | Yêu cầu trực tiếp mới nhất từ user |
| 2 | Database decision đã được approve |
| 3 | `spec/global/` |
| 4 | `spec/modules/<module>/module.md` |
| 5 | `spec/features/<module>/` |
| 6 | API contract |
| 7 | `CLAUDE.md` |
| 8 | Code hiện tại trong `src/` |

> **CRITICAL:** Code hiện tại có priority **thấp nhất**. Nếu code conflict với approved spec → không assume code đúng → phải báo gap.

---

## Tech Stack — Bắt buộc biết

| Component | Technology | Ghi chú |
|---|---|---|
| Framework | NestJS v11 + TypeScript | |
| ORM | **Prisma v6** | Đã có 21 domain models, ID: UUIDv7 |
| Database | PostgreSQL + PostGIS | Baseline migration đã apply local |
| Cache/Session | Redis (ioredis v5) | Chưa fully integrated |
| Auth | Cookie-based JWT | HTTP-only, access + refresh |
| Password | bcrypt | |
| Realtime | Socket.IO v4 | namespace `/realtime` |
| Validation | class-validator + class-transformer | |
| API Docs | Swagger | `/docs` |
| Testing | Jest + Supertest | |
| Email | Nodemailer SMTP | |
| OAuth | Google OAuth | Server-side id_token verify |
| Push | Future Scope | Chưa implement thật |

---

## Module Boundary — Tóm tắt

| Module | Làm | Không làm |
|---|---|---|
| `auth` | Login, register, session, JWT, password | Profile data, swipe |
| `profile` | Onboarding, photo, location, bio | JWT, discovery filter |
| `discovery` | Feed generation, preferences, filtering | Swipe, profile mutation |
| `swipe` | Like/pass/super like, quota | Match creation, chat |
| `match` | Match lifecycle, unmatch | Swipe logic, chat persistence |
| `chat` | Message persistence, permission check | Realtime delivery |
| `realtime` | Socket auth, rooms, events | Message persistence |
| `notifications` | Push/email abstraction | Business logic of when to notify |
| `safety` | Block, report, moderation | Match creation, chat |
| `storage` | Upload initiation, confirmation | Profile photo ordering |
| `common` | Guards, interceptors, filters, utils | Business logic |

Chi tiết: `CLAUDE.md` và `spec/modules/<module>/module.md`.

---

## Implementation Workflow — Bắt buộc follow

```
1. Clarify requirement (hỏi nếu chưa rõ)
2. Lock scope (xác định làm gì, KHÔNG làm gì)
3. Write / Update SPEC (spec/features/ hoặc spec/modules/)
4. Write PLAN
5. Write TASKS checklist
6. ⏸ Wait for REVIEW ← DỪNG LẠI ĐÂY
7. Implement
8. Test
9. Update docs + changelog
```

**Không được skip bất kỳ step nào, đặc biệt Step 6.**

---

## Trạng thái Hiện tại của Codebase (2026-06-11)

Agent **PHẢI** biết trạng thái này trước khi code:

| Item | Trạng thái | Rủi ro |
|---|---|---|
| Prisma schema | **Ready (21 models)** | Đã apply local DB |
| Tất cả repositories | **In-memory mock** | Chờ refactor sang Prisma |
| Safety module | **Chưa có** | Block filter không hoạt động |
| Chat module | **Chưa có** | Text + Image only |
| Storage module | **Chưa có** | Photo upload không hoạt động |
| Socket gateway | **Placeholder** — không authenticate | Ai cũng connect được |
| Notification service | **Placeholder** | In-app only (chưa gửi) |
| Account status guard | **Chưa rõ** | Banned user có thể vẫn access API |
| CSRF protection | **Chưa có** | Mutation endpoints dễ bị CSRF |
| `.env.example` | **Đã được sanitize** | Safe to commit |

Full list: `spec/global/known-gaps.md`

---

## Khi Phát Hiện Bug / Gap trong Code

1. **KHÔNG tự ý sửa** nếu ngoài scope task hiện tại.
2. Ghi vào `spec/global/known-gaps.md` với severity và vị trí.
3. Báo cho user biết.
4. Tiếp tục task hiện tại.

---

## Privacy Rules — Tóm tắt nhanh

- Không expose `dob` → chỉ trả `age`
- Không expose `lat/lng` → chỉ trả `distanceLabel`
- Không có unrestricted `GET /profile/:id`
- Block = mutual invisibility + generic error response
- Message content = sensitive → không log, không expose ngoài participants
- Xem đầy đủ: `spec/global/privacy-rules.md`

---

## Xử lý Tình huống Khó

| Tình huống | Hành động |
|---|---|
| Yêu cầu không rõ | **Hỏi lại** trước khi assume |
| Cần sửa DB schema | Báo user, chờ confirmation |
| Phát hiện bug ngoài scope | Ghi vào known-gaps, không tự sửa |
| Feature hay nhưng chưa scope | Ghi `Future Improvement`, không implement |
| Code conflict với spec | Báo gap, KHÔNG assume code đúng |
| Destructive action (delete, refactor lớn) | Báo rõ trước khi thực hiện |

---

## References

| Tài liệu | Đọc khi |
|---|---|
| `CLAUDE.md` | Bắt đầu mỗi task |
| `spec/global/business-rules.md` | Implement business logic |
| `spec/global/privacy-rules.md` | Design API response |
| `spec/global/security.md` | Implement auth/guard |
| `spec/global/api-guidelines.md` | Design endpoint |
| `spec/global/error-handling.md` | Implement exception |
| `spec/global/known-gaps.md` | Phát hiện / báo gap |
| `spec/global/open-questions.md` | Gặp ambiguity |
| `spec/use-cases/USE_CASE_CATALOG.md` | Xác định UC status |
| `GIT_WORKFLOW.md` | Commit / branch |