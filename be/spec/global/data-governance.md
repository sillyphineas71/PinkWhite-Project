# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Rewrite — comprehensive data governance cho dating/social matchmaking backend | Toàn bộ file |

---

# Data Governance — Dating / Social Matchmaking Platform

---

## DG-01: Data Classification

### DG-01-01: Class 1 — Public Data
Data có thể được hiển thị trong discovery/match context:

| Field | Exposed to |
|---|---|
| `displayName` | Discovery viewer, active match |
| `age` (tính từ dob) | Discovery viewer, active match |
| `gender` | Discovery viewer, active match |
| `bio` | Discovery viewer, active match |
| `interests` | Discovery viewer, active match |
| `jobTitle`, `school` | Discovery viewer, active match |
| `approved photos` | Discovery viewer, active match |
| `distanceLabel` | Discovery viewer, active match |

### DG-01-02: Class 2 — Self-only Data
Data chỉ user đó mới được xem:

| Field | Rationale |
|---|---|
| `dob` (ngày tháng năm sinh) | Privacy — chỉ trả `age` cho others |
| `email` | Authentication data |
| `exact lat/lng` | Location privacy |
| `isEmailVerified`, `isOnboarded` | Internal state |
| `isHidden`, `isPremium` | User settings |
| `deletedAt` | Soft delete timestamp |

### DG-01-03: Class 3 — System/Admin Only Data
Data chỉ admin/moderator/system được xem:

| Field | Rationale |
|---|---|
| `passwordHash` | Credential — never expose |
| `isBanned`, `isSuspended` | Moderation state |
| `suspendedUntil` | Moderation data |
| `reportRecords` | Moderation records |
| `moderationNotes` | Internal moderation |
| Audit logs | Security/compliance |

### DG-01-04: Class 4 — Never Expose
Data không bao giờ được expose ở bất kỳ context nào qua API:

| Field | Rationale |
|---|---|
| `passwordHash` | Security — never ever |
| Raw JWT tokens | Security |
| Reset password tokens | Security |
| Email verification tokens | Security |
| OAuth tokens | Third-party credential |
| Internal infrastructure IPs | Security |

---

## DG-02: Data Access Rules

### DG-02-01: Authentication required
- Tất cả private data phải authenticated.
- Guest (unauthenticated) không được access bất kỳ user data nào.

### DG-02-02: Context-based access
- Discovery context: Class 1 only.
- Match context: Class 1 only (không có dob, không có exact location).
- Self context: Class 1 + Class 2.
- Admin context: Class 1 + Class 2 + Class 3 (không có Class 4).

### DG-02-03: Cross-user data isolation
- User A không được query data của User B ngoài các contexts đã define.
- Service layer phải enforce ownership check trước khi trả data.

---

## DG-03: Sensitive Data Rules

### DG-03-01: Password
- Phải hash bằng bcrypt trước khi lưu.
- Không bao giờ lưu plaintext.
- Không log, không return, không expose.

### DG-03-02: Tokens
- JWT, refresh token, reset token, verification token: không log, không return raw trong response (chỉ set vào HTTP-only cookie).
- Tokens phải có TTL.
- Tokens phải invalidatable (server-side storage để revoke).

### DG-03-03: Location data
- Exact lat/lng: không expose cho other users.
- Không log exact coordinates trong application logs.
- Nếu cần log location event: log action only, not coordinates.

### DG-03-04: Chat data
- Message content là sensitive.
- Không log message content.
- Chỉ participants của active match được access messages.

### DG-03-05: Moderation data
- Block/report records không expose cho users bình thường.
- Report description không expose cho reported user.

---

## DG-04: Data Lifecycle

### DG-04-01: Creation
- Validate input trước khi lưu (DTO validation + service validation).
- Sanitize user input (prevent injection) — Prisma parameterized queries handle this.
- Không lưu data không cần thiết.

### DG-04-02: Retention
- Active account: data giữ nguyên.
- Soft deleted account: data giữ trong 30 ngày.
- After 30 days: **Open Question** (xem `spec/global/open-questions.md` OQ-02-02).
- Messages: **Open Question** — retention policy chưa chốt.
- Audit logs: minimum 1 năm.

### DG-04-03: Deletion
- User-initiated: soft delete (30-day recovery window).
- System-initiated: sau 30 ngày soft delete (policy chưa chốt).
- Moderator action: account ban/suspend (không xóa data, chỉ restrict access).

### DG-04-04: Anonymization
Khi hard delete: xóa PII nhưng có thể retain anonymized records cho:
- Report records (de-identified).
- Aggregate analytics.
- Safety investigation purposes.

---

## DG-05: Cross-module Data Rules

### DG-05-01: Block data
Block data phải ảnh hưởng tới:
- Discovery: exclude blocked users.
- Match: hide existing match.
- Chat: disable new messages.
- Notification: suppress notifications.

### DG-05-02: Safety data propagation
Report/moderation data phải không bị expose qua normal user-facing APIs.

### DG-05-03: Match data access
Message data chỉ accessible qua match context:
- `GET /api/chats/:matchId/messages` → verify participant.
- Admin: separate admin endpoint.

---

## DG-06: GDPR / Privacy Compliance Notes

**Scope:** Nếu product target EU users, cần comply với GDPR.

**Requirements (Future Improvement):**
- Right to access: User có thể download toàn bộ data về mình.
- Right to erasure: User có thể request full data deletion.
- Data processing consent: Explicit consent khi register.
- Data breach notification: Process cho notification khi có breach.

**Hiện tại:** Chưa implement GDPR compliance. Ghi là **Future Improvement** nếu product expand sang EU.
