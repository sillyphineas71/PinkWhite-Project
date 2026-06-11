# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial privacy rules foundation cho dating/social matchmaking backend | Toàn bộ file |

---

# Privacy Rules — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa toàn bộ privacy rules. Privacy là **first-class requirement**, không phải làm sau. Mọi API design, data model và implementation phải tuân thủ các rules này.

---

## PR-01: Privacy Principles

### PR-01-01: Least privilege data exposure
Mỗi actor chỉ nhận data mà họ cần và có quyền thấy, không hơn.

### PR-01-02: Context-based access
Việc access profile data phụ thuộc vào **context** của relationship:
- Discovery context: thấy limited profile (không thấy dob, không thấy exact location).
- Active match context: thấy nhiều hơn discovery nhưng vẫn không thấy dob.
- Self context: thấy tất cả data của chính mình.
- Admin/Moderator context: thấy thêm moderation data.

### PR-01-03: No exact location exposure
Backend KHÔNG BAO GIỜ trả exact lat/lng cho other users, kể cả trong match context.

### PR-01-04: No DOB exposure
Date of birth KHÔNG được trả về cho other users. Chỉ trả `age` (số nguyên).

### PR-01-05: No unrestricted profile lookup
Không có route dạng `GET /profile/:id` trả full profile chỉ vì requester đã login.
Profile data phải đi qua context:
- Discovery feed context
- Active match context
- Admin/moderator context

### PR-01-06: Safety over engagement
Khi có conflict giữa privacy/safety và engagement metrics, **safety/privacy luôn thắng**.

---

## PR-02: Data Visibility Matrix

Bảng visibility theo actor. ✅ = có thể thấy / ❌ = không thấy / 🔶 = thấy dạng hạn chế

| Field | Self | Discovery Viewer | Active Match | Unmatched User | Blocked User | Admin/Moderator |
|---|---|---|---|---|---|---|
| `userId` | ✅ | ❌ (dùng internal) | ❌ (dùng matchId) | ❌ | ❌ | ✅ |
| `displayName` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `dob` (ngày sinh) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `age` (tuổi) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `gender` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `bio` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `interests` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `photos` (approved) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `exact lat/lng` | ✅ (own) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `distanceKm/label` | N/A | ✅ (rounded/label) | ✅ (rounded/label) | ❌ | ❌ | ✅ |
| `online status` | ✅ | ❌ | 🔶 (basic) | ❌ | ❌ | ✅ |
| `lastActive` | ✅ | ❌ | 🔶 (rough) | ❌ | ❌ | ✅ |
| `jobTitle/school` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `email` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `message content` | ✅ (own messages) | ❌ | ✅ (in match) | ❌ | ❌ | ✅ (moderation) |
| `report records` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `moderation status` | 🔶 (limited) | ❌ | ❌ | ❌ | ❌ | ✅ |
| `isBanned/isSuspended` | 🔶 (effect only) | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## PR-03: Direct Profile Lookup

### PR-03-01: Không có unrestricted profile endpoint
**FORBIDDEN pattern:**
```http
GET /api/profile/:userId
→ Returns full profile because requester is logged in
```

### PR-03-02: Profile access phải qua context
```http
# Discovery context
GET /api/discovery/feed
→ Returns list of limited profiles visible in feed

# Match context
GET /api/matches/:matchId/profile
→ Returns limited profile of matched user

# Admin context (tách route rõ)
GET /api/admin/users/:userId
→ Returns full profile với admin permission
```

---

## PR-04: Location Privacy

### PR-04-01: Self location access
User có thể xem exact location của chính mình.

### PR-04-02: Other users — không có exact location
Khi trả profile của other users (discovery, match), chỉ trả `distanceKm` hoặc `distanceLabel`.

### PR-04-03: Distance buckets (recommended)
| Label | Range |
|---|---|
| `< 1 km` | 0 – 1 km |
| `1–5 km` | 1 – 5 km |
| `5–20 km` | 5 – 20 km |
| `20+ km` | > 20 km |

Có thể dùng rounded `distanceKm` (làm tròn xuống 1 km) thay vì bucket label — cần chốt riêng.

### PR-04-04: Location logging
- Không log exact lat/lng vào application logs trừ khi có security/audit reason.
- Nếu cần log location cho investigation: phải mask hoặc hash.

---

## PR-05: Hidden Mode

### PR-05-01: Effect của hidden mode
- User ở hidden mode KHÔNG xuất hiện trong discovery feed của bất kỳ user nào.
- Existing active matches vẫn có thể chat (nếu chưa unmatch/block).
- Hidden mode KHÔNG tự động unmatch/block existing matches.
- Hidden mode KHÔNG hide user khỏi admin/moderator view.

### PR-05-02: Likes trong hidden mode
- Nếu hidden user từng bị like: like đó vẫn được retain.
- Nếu hidden user like người khác: like đó vẫn được record.
- Nếu mutual like xảy ra khi hidden: match vẫn được tạo (Open Question — cần chốt).

---

## PR-06: Block Privacy

### PR-06-01: Mutual invisibility
Khi user A block user B:
- A không thấy B trong discovery, match list, search.
- B không thấy A trong discovery, match list, search.

### PR-06-02: Existing match sau block
- Nếu A và B đang có active match: match bị hide khỏi normal inbox.
- Chat bị disabled (không gửi được message mới).
- Notification giữa A và B bị suppress.

### PR-06-03: Generic error response
- Khi B cố truy cập A's profile sau khi bị block: trả về generic error.
- Không trả về "you are blocked" — điều này cho B biết mình bị block, vi phạm privacy.
- Recommended: trả `404 Not Found` hoặc `403 Forbidden` generic.

---

## PR-07: Unmatch Privacy

### PR-07-01: After unmatch
- Conversation bị ẩn khỏi normal inbox của cả 2.
- Profile của person kia không còn accessible qua match context.
- Unmatch KHÔNG tiết lộ cho người bị unmatch biết rằng họ bị unmatch — chỉ conversation biến mất.

### PR-07-02: Data retention sau unmatch
- Messages không bị hard delete ngay.
- Data được retain cho moderation / abuse investigation purposes.
- Retention period: **Open Question** — cần chốt policy.

---

## PR-08: Who Liked Me

### PR-08-01: Free tier behavior
User free xem "Who Liked Me":
- Chỉ xem **count** — bao nhiêu người đã like.
- Không xem real identity.
- Không xem real photo URL.
- Không xem real userId.
- Không xem exact timestamp (để tránh reverse identification).
- Có thể xem blurred/generic avatar placeholder.

### PR-08-02: Premium tier
- Premium behavior là **Out of Scope / Future Improvement** hiện tại.
- Khi implement: phải chốt exactly những gì premium được thấy.

---

## PR-09: Logging Privacy

### PR-09-01: Banned from logs
Tuyệt đối KHÔNG log các thông tin sau vào application logs:

| Loại data | Lý do |
|---|---|
| `password` / `passwordHash` | Credential leak |
| JWT `access_token` raw | Token leak |
| JWT `refresh_token` raw | Session hijack risk |
| Cookie raw value | Token leak |
| Exact `lat/lng` | Location privacy |
| Message `content` / `body` | Chat content privacy |
| Private photo URL | Content privacy |
| OAuth `access_token` / `id_token` | Third-party credential leak |
| Raw email (nếu không mask) | PII |
| Report detail nhạy cảm | Moderation privacy |
| `SMTP_PASSWORD` | Email credential |
| `GOOGLE_CLIENT_ID` raw nếu sensitive | OAuth credential |

### PR-09-02: Safe to log
| Loại data | Ghi chú |
|---|---|
| `userId` (masked/partial) | OK nếu cần trace |
| Request ID / Correlation ID | OK |
| HTTP method + path | OK (không log body với sensitive data) |
| Response status code | OK |
| Duration | OK |
| Error type (không phải stack trace raw) | OK trong prod |

---

## PR-10: Data Retention & Deletion

### PR-10-01: Soft delete
- Khi user soft delete account: data không bị xóa ngay.
- Trong 30 ngày: user có thể restore account.
- Sau 30 ngày: **Open Question** — auto hard delete hay giữ dạng anonymized?

### PR-10-02: Hard delete policy
- **Open Question:** Khi hard delete, xóa gì và giữ gì?
- Messages: retain for moderation (bao lâu)?
- Reports liên quan: retain for moderation.
- Match history: retain hay xóa?

### PR-10-03: Data anonymization
- Khi account bị hard deleted: thông tin cá nhân (name, dob, photos) nên được anonymized.
- Report records liên quan có thể được retain nhưng de-identified.

---

## PR-11: OAuth Privacy

### PR-11-01: Google OAuth data
- Backend chỉ lấy từ Google id_token: `email`, `name`, `picture` (optional).
- Backend KHÔNG lưu Google `access_token` vào DB.
- Backend KHÔNG log Google `id_token`.
- `picture` URL từ Google: không dùng trực tiếp như profile photo — user phải upload riêng.

---

## PR-12: Admin / Moderator Privacy

### PR-12-01: Admin access
- Admin/moderator có thể thấy full user data bao gồm: email, dob, location, moderation history, report records.
- Admin access phải có audit log riêng.
- Admin không được thấy message content trừ khi có escalation/moderation reason rõ ràng.

### PR-12-02: Admin scope
- Admin/moderator role management là **Out of Scope** hiện tại cho user-facing.
- Ghi nhận là future requirement.
