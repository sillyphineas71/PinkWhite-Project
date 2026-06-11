# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial use case catalog — full coverage cho dating/social matchmaking platform | Toàn bộ file |

---

# Use Case Catalog — Dating / Social Matchmaking Platform

Tài liệu này tổng hợp toàn bộ use cases của hệ thống. Mỗi UC có ID, tên, module, actor, priority và status.

**Status definitions:**
- `documented` — Đã có spec đầy đủ
- `partially_implemented` — Đã có spec và implement một phần
- `implemented_mock` — Đã implement nhưng dùng in-memory mock
- `db_schema_ready` — Database schema đã sẵn sàng (chưa có code layer)
- `implemented_production` — Đã implement với DB thật (chưa có runtime nào đạt level này, nhưng schema đã ready)
- `needs_review` — Chưa rõ trạng thái, cần review
- `out_of_scope` — Ngoài scope hiện tại

**Priority definitions:**
- `P0` — Must have, không có không chạy được
- `P1` — Core feature, cần có trước launch
- `P2` — Important, nên có
- `P3` — Nice to have / Future

---

## Module 1: Auth & Account

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-AUTH-001 | Đăng ký bằng email/password | auth | Guest | P0 | `implemented_mock` | In-memory repo |
| UC-AUTH-002 | Đăng nhập bằng email/password | auth | Guest | P0 | `implemented_mock` | In-memory repo |
| UC-AUTH-003 | Đăng xuất khỏi thiết bị hiện tại | auth | User | P0 | `implemented_mock` | Cần verify cookie path + session revoke |
| UC-AUTH-004 | Lấy thông tin user hiện tại (GET /me) | auth | User | P0 | `implemented_mock` | |
| UC-AUTH-005 | Gửi email xác thực | auth | User/System | P0 | `implemented_mock` | Dùng Nodemailer |
| UC-AUTH-006 | Xác thực email bằng token | auth | User | P0 | `implemented_mock` | |
| UC-AUTH-007 | Yêu cầu reset password (Forgot) | auth | Guest | P1 | `implemented_mock` | |
| UC-AUTH-008 | Thực thi reset password | auth | Guest | P1 | `implemented_mock` | |
| UC-AUTH-009 | Thay đổi password khi đang login | auth | User | P1 | `implemented_mock` | |
| UC-AUTH-010 | Đăng nhập / Đăng ký bằng Google OAuth | auth | Guest | P1 | `implemented_mock` | Server-side id_token verify |
| UC-AUTH-011 | Xóa tài khoản (Soft Delete) | auth | User | P1 | `implemented_mock` | 30-day recovery window |
| UC-AUTH-012 | Khôi phục tài khoản (Restore) | auth | Guest | P1 | `implemented_mock` | Chỉ trong 30 ngày sau soft delete |
| UC-AUTH-013 | Refresh access token | auth | User | P0 | `implemented_mock` | Cần verify rotation |
| UC-AUTH-014 | Đăng xuất tất cả thiết bị (Force Logout All) | auth | User | P1 | `implemented_mock` | Cần verify all-session revoke |

---

## Module 2: Profile & Onboarding

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-PROF-001 | Tạo basic profile (name, dob, gender) | profile | User | P0 | `implemented_mock` | Onboarding step 1 |
| UC-PROF-002 | Xem basic profile của chính mình | profile | User | P0 | `implemented_mock` | |
| UC-PROF-003 | Cập nhật basic profile | profile | User | P0 | `implemented_mock` | Cần DOB update limit |
| UC-PROF-004 | Cập nhật bio | profile | User | P1 | `implemented_mock` | |
| UC-PROF-005 | Cập nhật interests | profile | User | P1 | `implemented_mock` | |
| UC-PROF-006 | Cập nhật thông tin nghề nghiệp / học vấn | profile | User | P2 | `needs_review` | |
| UC-PROF-007 | Upload photo | profile/storage | User | P0 | `needs_review` | Cần storage module |
| UC-PROF-008 | Confirm photo upload (backend verify) | profile/storage | User | P0 | `needs_review` | Upload confirmation flow |
| UC-PROF-009 | Xem danh sách photos của mình | profile | User | P0 | `implemented_mock` | |
| UC-PROF-010 | Reorder photos | profile | User | P1 | `implemented_mock` | |
| UC-PROF-011 | Xóa photo | profile | User | P1 | `implemented_mock` | Phải có ít nhất 1 approved photo |
| UC-PROF-012 | Cài đặt active location | profile | User | P0 | `implemented_mock` | Lat/lng validation |
| UC-PROF-013 | Xem active location của chính mình | profile | User | P0 | `implemented_mock` | |
| UC-PROF-014 | Kiểm tra onboarding eligibility | profile | System | P0 | `needs_review` | Xem BR-02-01 — có thể có bug |
| UC-PROF-015 | Bật/tắt hidden mode | profile/discovery | User | P1 | `implemented_mock` | |
| UC-PROF-016 | Passport (Fake location) | profile | User | P3 | `out_of_scope` | Premium feature, future |

---

## Module 3: Discovery

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-DISC-001 | Tạo discovery preferences | discovery | User | P0 | `implemented_mock` | Age range, gender, distance |
| UC-DISC-002 | Xem discovery preferences | discovery | User | P0 | `implemented_mock` | |
| UC-DISC-003 | Cập nhật discovery preferences | discovery | User | P0 | `implemented_mock` | |
| UC-DISC-004 | Lấy discovery feed | discovery | User | P0 | `implemented_mock` | Filter + distance calc |
| UC-DISC-005 | Load more / pagination cho feed | discovery | User | P0 | `needs_review` | Cursor pagination? |
| UC-DISC-006 | Filter nâng cao (education, lifestyle) | discovery | User | P2 | `out_of_scope` | Premium feature, future |

---

## Module 4: Swipe

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-SWIPE-001 | Like (Swipe right) | swipe | User | P0 | `implemented_mock` | |
| UC-SWIPE-002 | Pass (Swipe left) | swipe | User | P0 | `implemented_mock` | |
| UC-SWIPE-003 | Super Like | swipe | User | P1 | `needs_review` | Có quota riêng |
| UC-SWIPE-004 | Rewind (undo last swipe) | swipe | User | P2 | `needs_review` | Condition-based |
| UC-SWIPE-005 | Kiểm tra remaining likes | swipe | User | P1 | `needs_review` | |
| UC-SWIPE-006 | Kiểm tra remaining super likes | swipe | User | P2 | `needs_review` | |
| UC-SWIPE-007 | Xem "Who Liked Me" (free tier) | swipe | User | P2 | `needs_review` | Chỉ count + blurred |
| UC-SWIPE-008 | Xem "Who Liked Me" (premium tier) | swipe | User | P3 | `out_of_scope` | Requires subscription |

---

## Module 5: Match

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-MATCH-001 | Tạo match từ mutual like | match | System | P0 | `implemented_mock` | Phải idempotent |
| UC-MATCH-002 | Lấy danh sách matches | match | User | P0 | `implemented_mock` | |
| UC-MATCH-003 | Xem profile của một match | match | User | P0 | `implemented_mock` | Privacy-aware response |
| UC-MATCH-004 | Tìm kiếm match theo tên | match | User | P1 | `needs_review` | |
| UC-MATCH-005 | Unmatch | match | User | P0 | `implemented_mock` | Soft operation |
| UC-MATCH-006 | Rematch (after unmatch) | match | User | P3 | `out_of_scope` | Future feature |
| UC-MATCH-007 | Mark match conversation as read | match | User | P1 | `needs_review` | |

---

## Module 6: Chat

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-CHAT-001 | Gửi text message | chat | User | P0 | `db_schema_ready` | Schema ready |
| UC-CHAT-002 | Lấy lịch sử messages (pagination) | chat | User | P0 | `db_schema_ready` | Cursor pagination |
| UC-CHAT-003 | Lấy inbox / conversation list | chat | User | P0 | `db_schema_ready` | |
| UC-CHAT-004 | Mark message as read | chat | User | P1 | `db_schema_ready` | |
| UC-CHAT-005 | Typing indicator | chat/realtime | User | P1 | `needs_review` | Realtime only |
| UC-CHAT-006 | Online / offline status | chat/realtime | User | P1 | `needs_review` | Redis presence |
| UC-CHAT-007 | Thu hồi tin nhắn (Unsend) | chat | User | P2 | `db_schema_ready` | Soft delete support |
| UC-CHAT-008 | Gửi ảnh trong chat | chat | User | P2 | `db_schema_ready` | Requires storage |
| UC-CHAT-009 | Gửi voice message | chat | User | P3 | `out_of_scope` | Future feature |
| UC-CHAT-010 | React to message | chat | User | P3 | `out_of_scope` | Future feature |

---

## Module 7: Realtime

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-RT-001 | Connect socket với authentication | realtime | User | P0 | `needs_review` | Gateway chưa có auth |
| UC-RT-002 | Join match room | realtime | User | P0 | `needs_review` | |
| UC-RT-003 | Receive message realtime | realtime | User | P0 | `needs_review` | |
| UC-RT-004 | Receive match notification realtime | realtime | User | P0 | `needs_review` | |
| UC-RT-005 | Leave / disconnect gracefully | realtime | User | P1 | `needs_review` | |

---

## Module 8: Notifications

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-NOTIF-001 | Match created notification | notifications | System | P0 | `db_schema_ready` | In-app notification |
| UC-NOTIF-002 | New message notification | notifications | System | P1 | `db_schema_ready` | In-app notification |
| UC-NOTIF-003 | Super like received notification | notifications | System | P2 | `db_schema_ready` | In-app notification |
| UC-NOTIF-004 | Moderation action notification | notifications | System | P2 | `db_schema_ready` | In-app notification |
| UC-NOTIF-005 | Đăng ký device token | notifications | User | P1 | `out_of_scope` | Push/FCM out of scope |
| UC-NOTIF-006 | Lấy in-app notification list | notifications | User | P2 | `db_schema_ready` | Schema ready |
| UC-NOTIF-007 | Mark notification as read | notifications | User | P2 | `db_schema_ready` | Schema ready |

---

## Module 9: Safety

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-SAFE-001 | Block user | safety | User | P0 | `needs_review` | Chưa có safety module |
| UC-SAFE-002 | Unblock user | safety | User | P1 | `needs_review` | |
| UC-SAFE-003 | Xem danh sách blocked users | safety | User | P1 | `needs_review` | |
| UC-SAFE-004 | Report user | safety | User | P0 | `needs_review` | |
| UC-SAFE-005 | Moderator review report | safety | Moderator | P1 | `out_of_scope` | Admin scope |
| UC-SAFE-006 | Ban user | safety | Admin | P1 | `out_of_scope` | Admin scope |
| UC-SAFE-007 | Suspend user | safety | Admin | P1 | `out_of_scope` | Admin scope |

---

## Module 10: Storage

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-STOR-001 | Initiate photo upload (get presigned URL) | storage | User | P0 | `needs_review` | Chưa có storage module |
| UC-STOR-002 | Confirm photo upload | storage | User | P0 | `needs_review` | Backend verify objectKey |
| UC-STOR-003 | Delete photo from storage | storage | User/System | P1 | `needs_review` | |

---

## Module 11: Admin (Out of Scope / Future)

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-ADMIN-001 | Tìm kiếm & xem user list | admin | Admin | P2 | `out_of_scope` | |
| UC-ADMIN-002 | Ban / Suspend user | admin | Admin | P2 | `out_of_scope` | |
| UC-ADMIN-003 | Xem reported users list | admin | Admin | P2 | `out_of_scope` | |
| UC-ADMIN-004 | Handle report | admin | Admin | P2 | `out_of_scope` | |
| UC-ADMIN-005 | Dashboard analytics | admin | Admin | P3 | `out_of_scope` | |

---

## Module 12: Monetization (Out of Scope)

| UC ID | Name | Module | Actor | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| UC-MON-001 | Mua subscription | monetization | User | P3 | `db_schema_ready` | VNPAY prepaid schema ready |
| UC-MON-002 | Xem subscription status | monetization | User | P3 | `db_schema_ready` | Schema ready |
| UC-MON-003 | Kích hoạt Boost | monetization | User | P3 | `out_of_scope` | |
| UC-MON-004 | Mua Super Likes pack | monetization | User | P3 | `out_of_scope` | |

---

## Tổng hợp theo priority

| Priority | Count | Notes |
|---|---|---|
| P0 (Must have) | 23 | Cần hoàn thành trước launch |
| P1 (Core) | 20 | Nên có trước launch |
| P2 (Important) | 10 | Có thể launch thiếu, nhưng cần sớm |
| P3 (Nice to have) | 10+ | Future iterations |

---

## Tổng hợp theo status (ước tính 2026-06-11)

| Status | Count | Notes |
|---|---|---|
| `implemented_mock` | ~25 | Dùng in-memory, chưa production |
| `db_schema_ready` | ~20 | Đã có schema DB/migration, chờ implement logic layer |
| `needs_review` | ~15 | Chưa rõ trạng thái hoặc chưa implement |
| `out_of_scope` | ~15 | Không làm trong phase này |
| `documented` | 0 | Chưa có spec đầy đủ riêng (đang xây) |
| `implemented_production` | 0 | Runtime implementation not production yet |
