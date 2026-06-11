# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial safety module spec | Toàn bộ file |

---

# Safety Module

## Goal
Bảo vệ user bằng block, report và moderation. Safety là **first-class requirement** — không phải feature làm sau.

## Responsibilities
- Block user (mutual invisibility).
- Unblock user.
- List blocked users.
- Report user (tạo moderation record).
- Cung cấp block check API cho các modules khác (discovery, chat, notifications).
- Moderation record management (chưa có admin UI — future).

## Out of Scope
- Admin moderation UI (Out of Scope — future).
- Account ban/suspend by admin (Out of Scope — future).
- Automated moderation AI (Out of Scope — future).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-10.

Key rules:
- Block tạo mutual invisibility (A blocks B → A không thấy B, B không thấy A).
- Block nếu có active match → match bị hide, chat disabled.
- Block priority cao hơn unmatch.
- Generic error response cho blocked user (không tiết lộ "you are blocked").
- Report không tự động block.
- Multiple reports có thể trigger review flag.
- Cannot block/report self.

## Privacy / Security Notes
- `POST /api/safety/block` response: phải generic đủ để blocker không biết state của target.
- Khi blocked user access blocker: generic error (404 preferred, không phải "you are blocked").
- Report detail là sensitive — không expose cho user bình thường, không log content.
- Block check phải được tất cả other modules (discovery, chat, notifications) query trước khi action.

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/safety/block | User | Block một user |
| DELETE | /api/safety/block/:targetId | User | Unblock user |
| GET | /api/safety/blocks | User | Danh sách blocked users |
| POST | /api/safety/report | User | Report một user |

**Internal APIs (for other modules):**
- `isBlocked(userIdA, userIdB): boolean` — check if block exists in either direction.

## Data Model Requirements
*(Concept only)*

**Block entity:**
- `id` (UUID)
- `blockerId` (FK → User)
- `blockedId` (FK → User)
- `createdAt`

**Constraint:** `UNIQUE(blockerId, blockedId)` — idempotent block.

**Report entity:**
- `id` (UUID)
- `reporterId` (FK → User)
- `reportedId` (FK → User)
- `reason` (enum: SPAM, FAKE, INAPPROPRIATE, HARASSMENT, OTHER)
- `description` (text, nullable — sensitive)
- `status` (enum: PENDING, REVIEWED, RESOLVED, DISMISSED)
- `createdAt`
- `reviewedAt` (nullable)
- `reviewedBy` (FK → Admin User — nullable)

## Events
*(Target)*

| Event | Trigger | Consumer |
|---|---|---|
| `USER_BLOCKED` | Block created | Match (hide match), Chat (disable), Notification (suppress) |
| `REPORT_SUBMITTED` | Report created | Moderation system |

## Logging / Audit
- `SAFETY.USER_BLOCKED` — log blockerId, blockedId.
- `SAFETY.USER_UNBLOCKED` — log blockerId, blockedId.
- `SAFETY.REPORT_SUBMITTED` — log reporterId, reportedId, reason, reportId (KHÔNG log description content).

## Testing Notes
- Integration: block → discovery excludes blocked. Block → chat disabled. Block → match hidden.
- Privacy: blocked user accessing blocker → 404 generic.
- Integration: report submission idempotency (có thể report nhiều lần không?).
- Integration: block self → 400.

## Known Implementation Gaps
- **GAP-09:** Safety module CHƯA TỒN TẠI (`src/modules/safety` chưa có).
- **GAP-16:** Discovery không apply block filter (phụ thuộc module này).
- Block effect trên existing match/chat chưa có.

## Open Questions
- Report idempotency: user có thể report cùng người nhiều lần không?
- Bao nhiêu report trigger auto-review flag? (xem OQ-02-02)
- Có auto-suspend sau số report threshold không?
- Report moderation workflow chi tiết thế nào? (xem OQ-02-03)
