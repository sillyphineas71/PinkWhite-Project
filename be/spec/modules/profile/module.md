# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial profile module spec | Toàn bộ file |

---

# Profile Module

## Goal
Quản lý hồ sơ người dùng, onboarding, photo, location, bio, interests và lifestyle. Profile là foundation để user có thể tham gia discovery.

## Responsibilities
- Tạo và cập nhật basic profile (name, dob, gender).
- Upload ảnh (initiate + confirm với storage backend).
- Approve/reject photo (auto hoặc manual — cần chốt).
- Reorder và xóa photos.
- Cập nhật bio, interests, job, education.
- Set và update active location.
- Bật/tắt hidden mode (visibility toggle).
- Kiểm tra onboarding eligibility.
- Set `isOnboarded = true` khi TẤT CẢ conditions thỏa.

## Out of Scope
- Passport / fake location (Future Improvement).
- Discovery preferences (→ `discovery` module).
- Photo storage infrastructure (→ `storage` module — Profile chỉ dùng API của storage).
- KYC / face verification (Out of Scope).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-02, BR-03, BR-04, BR-05.

Key rules:
- Minimum age: 18 (tính chính xác ngày/tháng/năm).
- Phải có ít nhất 1 approved photo để discoverable.
- `isOnboarded = true` chỉ khi TẤT CẢ: verified, basic profile, age valid, approved photo, location, preferences.
- Backend KHÔNG tin raw photo URL từ client — phải verify uploadId/objectKey.

## Privacy / Security Notes
- Không expose DOB cho other users — chỉ trả `age`.
- Không expose exact lat/lng cho other users.
- Không có unrestricted `GET /profile/:id` — profile phải qua discovery hoặc match context.
- Self can view own full profile (dob, exact location).

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/profile | User | Tạo profile (onboarding step 1) |
| GET | /api/profile/me | User | Xem profile của mình |
| PATCH | /api/profile/me | User | Cập nhật profile |
| POST | /api/profile/photos/upload | User | Initiate photo upload |
| POST | /api/profile/photos/:photoId/confirm | User | Confirm photo upload |
| GET | /api/profile/photos | User | Danh sách photos |
| PUT | /api/profile/photos/order | User | Reorder photos |
| DELETE | /api/profile/photos/:photoId | User | Xóa photo |
| PUT | /api/profile/location | User | Set/update active location |
| GET | /api/profile/location | User | Xem location của mình |
| PATCH | /api/profile/visibility | User | Toggle hidden mode |
| GET | /api/profile/onboarding-status | User | Check onboarding eligibility |

**FORBIDDEN:**
```
GET /api/profile/:userId → KHÔNG có unrestricted profile lookup
```

## Data Model Requirements
*(Concept only — không phải final schema.)*

**Profile entity:**
- `id` (UUID)
- `userId` (FK → User, unique — 1 user 1 profile)
- `fullName`
- `dob` (Date) — KHÔNG expose cho others, tính `age` dynamically
- `gender` (enum: MALE, FEMALE, NON_BINARY, OTHER)
- `bio` (text, nullable)
- `interests` (array of strings)
- `jobTitle` (nullable)
- `company` (nullable)
- `school` (nullable)
- `createdAt`, `updatedAt`

**Photo entity:**
- `id` (UUID)
- `userId` (FK → User)
- `objectKey` (storage path — không lưu full URL)
- `status` (enum: PENDING, APPROVED, REJECTED)
- `order` (integer — display order)
- `createdAt`, `updatedAt`

**Location entity:**
- `id` (UUID)
- `userId` (FK → User, unique — active location)
- `latitude` (float)
- `longitude` (float)
- `updatedAt`

## Events
*(Target)*

| Event | Trigger | Consumers |
|---|---|---|
| `PROFILE.ONBOARDING_COMPLETE` | isOnboarded → true | Discovery (user becomes discoverable) |
| `PROFILE.PHOTO_APPROVED` | Photo approved | Eligibility recheck |
| `PROFILE.VISIBILITY_CHANGED` | Hidden toggle | Discovery (remove/add from pool) |

## Logging / Audit
- `PROFILE.VISIBILITY_CHANGED` — log userId, newState.
- `PROFILE.LOCATION_UPDATED` — log userId (NOT lat/lng).
- `PROFILE.PHOTO_UPLOADED` — log userId, photoId.
- `PROFILE.PHOTO_DELETED` — log userId, photoId.

## Testing Notes
- Unit: age calculation (exact day/month/year check), onboarding eligibility check.
- Integration: create profile, update profile, photo upload flow (with storage mock).
- Privacy: GET /me response must not expose DOB (only age), photo upload confirm must verify objectKey.

## Known Implementation Gaps
- **GAP-01:** In-memory repositories.
- **GAP-07:** `isOnboarded` business rule may be incorrect.
- **GAP-11:** Storage module không tồn tại — photo upload chưa có real backend.
- Photo approval workflow chưa rõ (auto vs manual).

## Open Questions
- Photo approval: auto-approve hay manual review?
- Gender enum: cần bao nhiêu options?
- DOB update limit: user có được đổi DOB sau khi set không? Bao nhiêu lần?
- Location stale policy: nếu location không update trong X ngày, có ảnh hưởng đến discoverability không?
