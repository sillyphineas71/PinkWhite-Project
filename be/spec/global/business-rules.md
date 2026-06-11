# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial documentation foundation cho dating/social matchmaking backend | Toàn bộ file |

---

# Business Rules — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa toàn bộ business rules bắt buộc cho backend. Mọi implementation phải tuân thủ các rules này. Khi có conflict giữa code và rules này, code KHÔNG được mặc định là đúng — phải báo gap.

---

## BR-01: Account & Auth Rules

### BR-01-01: Đăng ký tài khoản
- User đăng ký bằng email và password.
- Email phải unique trên toàn hệ thống.
- Email phải được validate format đúng.
- Password phải được hash bằng bcrypt trước khi lưu vào database.
- Password không bao giờ được lưu dạng plaintext.

### BR-01-02: Email verification
- Email verification là bắt buộc trước khi user được discoverable.
- User chưa verify email vẫn có thể login nhưng bị giới hạn quyền năng.
- User chưa verify email KHÔNG được xuất hiện trong discovery feed.
- Token xác thực email phải có TTL (thời gian hết hạn).

### BR-01-03: Account status
- Account có thể ở một trong các trạng thái: `pending_email_verification`, `active`, `suspended`, `banned`, `deleted`.
- `pending_email_verification`: User được phép login và hoàn thành onboarding, nhưng KHÔNG được discoverable.
- `banned`: bị cấm vĩnh viễn, không thể login, không thể recoverable bởi user.
- `suspended`: bị tạm dừng, không thể login, có thể hết hạn tự động hoặc được admin gỡ.
- `deleted`: user tự xóa hoặc hệ thống xóa, không thể login, recoverable trong 30 ngày (anonymized sau đó).
- Login cho phép `active` và `pending_email_verification`.
- Account bị `banned`/`suspended` phải trả về lỗi generic (không tiết lộ cụ thể lý do cho attacker enumeration).

### BR-01-04: JWT session
- Access token: short-lived (mặc định 15 phút).
- Refresh token: long-lived (mặc định 7 ngày), lưu dạng HTTP-only cookie.
- Refresh token phải rotate mỗi lần dùng — sau khi dùng, token cũ bị revoke, token mới được cấp.
- Logout current device: revoke đúng session đó (không ảnh hưởng device khác).
- Logout all devices: revoke tất cả session của user đó.
- Refresh token phải được lưu ở server side (Redis hoặc DB) để có thể revoke.

### BR-01-05: Password change
- Change password bắt buộc verify current password trước.
- Sau khi change password, toàn bộ session cũ của user đó phải bị revoke.

### BR-01-06: Forgot password / Reset password
- Reset password token phải có TTL ngắn (ví dụ: 15-60 phút).
- Reset password token chỉ dùng được một lần — sau khi dùng phải invalidate ngay.
- Sau khi reset password, toàn bộ session cũ phải bị revoke.
- Error message không được tiết lộ "email không tồn tại" để tránh enumeration attack.

### BR-01-07: CSRF
- Các mutation endpoint phải có CSRF protection.
- Đây là **Known Implementation Gap** hiện tại — cần implement trước khi production.

### BR-01-08: Google OAuth
- Backend phải verify Google id_token server-side (không tin raw token từ client).
- Nếu email từ OAuth đã tồn tại trong DB: liên kết account.
- Nếu email mới: tạo account mới, không cần set password.
- OAuth user không có password local — `passwordHash` là null.

---

## BR-02: Onboarding Rules

### BR-02-01: Điều kiện onboarded
User chỉ được coi là **completed onboarding** và **discoverable** khi thỏa mãn TẤT CẢ điều kiện sau:

| Điều kiện | Mô tả |
|---|---|
| `emailVerified` | Email đã được xác thực |
| `hasBasicProfile` | Có display name, dob, gender hợp lệ |
| `isAgeValid` | Tuổi từ 18 trở lên (tính chính xác) |
| `hasApprovedPhoto` | Có ít nhất 1 ảnh đã được approved |
| `hasActiveLocation` | Có vị trí hợp lệ |
| `hasPreferences` | Có discovery preferences (hoặc default preferences) |
| `isAccountActive` | Account active, không ban/deleted/hidden/suspended |

**KHÔNG được** set `isOnboarded = true` chỉ sau khi tạo basic profile.

**Known Implementation Gap:** Hiện tại `isOnboarded` có thể bị set không đúng — cần review khi chuyển sang Prisma.

### BR-02-02: Onboarding step order
Gợi ý thứ tự onboarding (có thể linh hoạt nhưng phải hoàn thành hết):
1. Nhập basic info (name, dob, gender)
2. Upload ít nhất 1 ảnh và chờ approval
3. Cấp vị trí
4. Set preferences (có thể dùng default)

---

## BR-03: Age Rules

### BR-03-01: Minimum age
- Minimum age: **18 tuổi**.
- Age phải tính chính xác theo ngày, tháng, năm — KHÔNG dùng công thức `currentYear - birthYear`.
- Ví dụ: user sinh 2000-12-31, hôm nay là 2018-12-30 → chưa đủ 18, bị từ chối.

### BR-03-02: Age exposure
- Khi hiển thị profile cho other users: chỉ trả về `age` (số nguyên), KHÔNG trả về `dob`.
- Khi user xem profile của chính mình: có thể trả về `dob`.
- Age cần được tính động (dựa trên `dob` và ngày hiện tại), không lưu cứng `age` vào DB.

---

## BR-04: Profile & Photo Rules

### BR-04-01: Profile fields
- Các fields public (hiển thị cho other users khi có context phù hợp): `displayName`, `age`, `gender`, `bio`, `interests`, `jobTitle`, `school`.
- Các fields private (chỉ self): `dob`, `email`, `passwordHash`, `exact location`.
- Các fields admin only: `isBanned`, `suspendedUntil`, `reportRecords`, `moderationStatus`.

### BR-04-02: Photo status
- Mỗi photo có status: `pending` | `approved` | `rejected`.
- Discovery feed chỉ dùng `approved` photos.
- Trạng thái photo phase 1: tự động chuyển sang `approved` ngay sau khi user confirm upload thành công. Trường `moderation_status` vẫn được giữ lại để phục vụ admin/moderator review (report workflow) sau này.

### BR-04-03: Photo upload confirmation
- Backend KHÔNG được tin raw external URL do client tự điền.
- Backend phải cấp `uploadId` hoặc `objectKey` khi khởi tạo upload.
- Client upload lên Storage, sau đó confirm với backend bằng `uploadId` / `objectKey`.
- Backend verify objectKey tồn tại trên Storage trước khi approve.

### BR-04-04: Photo ordering
- User có thể reorder photos.
- Photo đầu tiên trong order là primary display photo.
- Tối thiểu phải có 1 approved photo trước khi onboarding complete.

---

## BR-05: Location Rules

### BR-05-01: Location validation
- Latitude: -90 đến +90.
- Longitude: -180 đến +180.
- Location phải có timestamp (để biết location có còn fresh không).

### BR-05-02: Location privacy
- Backend KHÔNG bao giờ expose exact lat/lng cho other users.
- Discovery feed và match profile chỉ trả `distanceKm` (rounded) hoặc `distanceLabel`.
- Distance label gợi ý: `< 1 km`, `1–5 km`, `5–20 km`, `20+ km`.

### BR-05-03: Active location
- User có một active location tại một thời điểm.
- Phải có location trước khi discoverable.
- Location stale (quá lâu không update) có thể được handle bằng policy riêng (Open Question).

### BR-05-04: Passport / Fake location
- Database đã hỗ trợ `passport_location` và chế độ `active_location_mode = passport`.
- Tuy nhiên, phần runtime feature và premium entitlement cho tính năng Passport sẽ được implement ở phase sau. Phase 1 chỉ tập trung vào `real_location`.

---

## BR-06: Discovery Rules

### BR-06-01: Discovery eligibility của target
Một user **chỉ xuất hiện** trong discovery feed của requester khi thỏa mãn TẤT CẢ:

| Điều kiện | Mô tả |
|---|---|
| `target.accountActive` | Không bị ban/suspend/deleted |
| `target.isOnboarded` | Đã hoàn thành onboarding |
| `target.isEmailVerified` | Email đã verified |
| `!target.isHidden` | Không ở chế độ ẩn danh |
| `target.hasApprovedPhoto` | Có ít nhất 1 approved photo |
| `target.hasActiveLocation` | Có active location |
| `!block_exists(requester, target)` | Requester không block target |
| `!block_exists(target, requester)` | Target không block requester |
| `!already_swiped(requester, target)` | Requester chưa swipe target (trừ khi có recycle rule) |
| `target_fits_requester_prefs` | Target phù hợp preference của requester |
| `target != requester` | Không phải chính user đó |

### BR-06-02: Discovery Rules bổ sung
- **Mutual preference filtering:** Có cần target preferences cũng phải match requester không? (Open Question).
- **Recycle rule:** User đã bị PASS sẽ được recycle (xuất hiện lại trong discovery) mặc định sau 30 ngày.
- **Ranking algorithm:** Phase đầu dùng random hoặc distance-based.
- **Geographic limit:** Lọc theo `maxDistance` từ preference.

### BR-06-03: Hidden mode
- User ở hidden mode: không xuất hiện trong discovery của người khác.
- Existing matches vẫn có thể chat (không tự động unmatch).
- Hidden không ảnh hưởng tới admin/moderator view.

---

## BR-07: Swipe Rules

### BR-07-01: Swipe eligibility
- User KHÔNG được swipe chính mình.
- User phải `active` và `onboarded` mới được swipe.
- Target phải eligible (xem BR-06-01) — nếu không, trả lỗi phù hợp.

### BR-07-02: Swipe types
- `LIKE`: quẹt phải.
- `PASS`: quẹt trái.
- `SUPER_LIKE`: vuốt lên (có quota riêng).

### BR-07-03: Swipe idempotency
- Swipe history is stored in `swipe_events`.
- Current directional state is stored in `swipe_states`.
- Repeated same action should be idempotent or return current state.
- PASS can recycle after default 30 days.
- LIKE/SUPER_LIKE normally do not recycle.

### BR-07-04: Like quota
- Free user có giới hạn số like per period.
- **Reset quota:** Tính theo rolling 24h (từ lần quẹt đầu tiên hoặc theo token bucket), không reset cứng theo calendar day.
- Free like limit value is still open, but quota window is rolling 24h.
- Super Like có quota riêng, nhỏ hơn like thường.

### BR-07-05: Rewind
- Rewind chỉ áp dụng cho swipe **cuối cùng** và chỉ khi đó là lượt **PASS**.
- Cụ thể: chỉ được undo lượt pass vừa xảy ra tức thì. Rewind only applies to the last PASS.
- Rewind không thể áp dụng nếu swipe đã tạo match — cần handle edge case này.

### BR-07-06: Event-driven target
- Swipe action KHÔNG trực tiếp check và tạo match trong cùng request.
- Target architecture:
  ```text
  Swipe API → Create swipe + Outbox event → Worker consumes → Check mutual → Create match
  ```
- Phase hiện tại (pre-outbox): service boundary phải rõ, nhưng docs phải ghi rõ production target.

---

## BR-08: Match Rules

### BR-08-01: Match creation condition
- Match được tạo khi và chỉ khi có **mutual like** (cả 2 đều LIKE nhau).
- Super Like + Like (đối chiều) = Match.
- Pass không tạo match.

### BR-08-02: Match uniqueness
- Tại một thời điểm, một cặp user chỉ có **một lifetime match record** duy nhất (`matches` table).
- Match creation phải **idempotent** — nếu worker xử lý 2 lần, không tạo duplicate match.
- Database đã enforce uniqueness constraint `(user_a_id, user_b_id)` cho match pair.

### BR-08-03: Match states
- `hasActiveMatch(userA, userB)`: match còn hiệu lực, chưa unmatch/block.
- `hasEverMatched(userA, userB)`: match đã từng tồn tại (kể cả đã unmatch).
- Hai trạng thái này phải phân biệt rõ trong data model.

### BR-08-04: Unmatch
- Unmatch kết thúc active match.
- Sau unmatch: không gửi được message mới.
- Sau unmatch: conversation bị ẩn khỏi inbox bình thường của cả 2.
- Unmatch KHÔNG hard delete data ngay — retain để investigation nếu cần.
- Unmatch KHÔNG tự động block.

### BR-08-05: Rematch
- Rematch (tái hợp sau unmatch) nếu được implement trong tương lai sẽ **tái sử dụng (reuse)** record match cũ đã tồn tại bằng cách update `status = active`, KHÔNG tạo record match mới.

### BR-08-06: Target architecture
```text
Swipe created
→ Outbox/domain event created (SWIPE_CREATED)
→ Match processor handles SWIPE_CREATED
→ Check mutual like
→ Create match idempotently
→ Emit MATCH_CREATED event
→ Notification / Realtime dispatch
```
**Trạng thái hiện tại:** In-memory, không có outbox/event processor thật. Ghi là target, chưa implement.

---

## BR-09: Chat Rules

### BR-09-01: Chat permission
- Chỉ **active matched users** mới có thể gửi tin nhắn.
- Sau unmatch: không được gửi message mới.
- Sau block: không được gửi message mới.
- Chat permission phải được check mỗi khi gửi message — không chỉ check khi vào conversation.

### BR-09-02: Message content
- Message content là **sensitive data**.
- Không được log message content.
- Message content không được expose cho user không phải participant.

### BR-09-03: Read receipts / Typing / Online status
- Read receipts và typing indicator là realtime layer.
- Persistence của read status (đã đọc/chưa đọc) phải lưu vào DB — không chỉ realtime.
- Online status có thể dùng Redis presence, không cần persist vào DB.

### BR-09-04: Message retention
- **Open Question:** Message retention policy là gì? 30 ngày? 1 năm? Vô hạn?
- **Open Question:** Có cần message deletion (unsend) không?

---

## BR-10: Safety Rules

### BR-10-01: Block
- Block tạo **mutual invisibility**:
  - Blocker không thấy blocked trong discovery, match, chat.
  - Blocked không thấy blocker trong discovery, match, chat.
- Nếu có active match: match bị ẩn, chat bị disabled.
- Block priority cao hơn unmatch — nếu block tồn tại, unmatch state không quan trọng.
- Response cho blocked user phải dùng **generic error** — không tiết lộ "you are blocked".

### BR-10-02: Report
- Report tạo moderation record.
- Report không nhất thiết block ngay — user có thể chọn block kèm report.
- Multiple reports có thể trigger automatic review flag hoặc suspension.
- **Open Question:** Bao nhiêu report sẽ trigger auto-suspend? Ai review report?

### BR-10-03: Safety module là first-class
- Safety module không phải "làm sau" — là core module.
- Block/report phải ảnh hưởng tới discovery, match, chat và notification.
- Nếu chưa implement safety module: phải ghi là **Known Implementation Gap**.

---

## BR-11: Notification Rules

### BR-11-01: Notification routing
- Notification KHÔNG nên gửi trực tiếp từ mọi service.
- Target: đi qua event-driven notification service boundary.
- Phase hiện tại: placeholder service, throw Error khi gọi.

### BR-11-02: Notification suppression
- Không gửi notification cho cặp user đã block nhau.
- Không gửi notification cho cặp user đã unmatch.
- Không gửi notification cho deleted/banned account.

### BR-11-03: Notification candidates
- Match created → notify cả 2 users.
- New message → notify recipient (nếu không online).
- Super Like received → notify target.
- Moderation action → notify user bị ảnh hưởng.
