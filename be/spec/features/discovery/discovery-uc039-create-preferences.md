# UC039: Tạo/Thiết lập Preferences (Bộ lọc tìm kiếm)

> **Revision**: v1 — Production-Grade
> - Thiết lập lần đầu khi User hoàn tất Onboarding.
> - Bao gồm: Khoảng tuổi, Giới tính quan tâm, Khoảng cách tối đa.

## 1. Context & Goal
Sau khi hoàn tất Onboarding (`isOnboarded = true`), User cần thiết lập bộ lọc tìm kiếm (Preferences) để hệ thống Discovery biết nên gợi ý ai. Đây là bước bắt buộc trước khi User có thể bắt đầu quẹt (Swipe). Nếu User chưa tạo Preferences, hệ thống sẽ không trả về Feed.

## 2. Actors & Roles
- **User**: Người dùng đã hoàn tất Onboarding (`isOnboarded = true`).

## 3. Out of Scope (Non-goals)
- Advanced Filters (UC044 xử lý riêng — Premium only).
- Thuật toán scoring/ranking trong Feed.

## 4. Data Model Impact
Tạo bản ghi mới trong bảng `Preference`:
```prisma
model Preference {
  id            String   @id @default(uuid())
  userId        String   @unique
  minAge        Int      @default(18)
  maxAge        Int      @default(55)
  genderFilter  Gender   // Giới tính mà User muốn tìm
  maxDistance   Int      @default(50) // Đơn vị: km
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id])
}
```

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Insert | ≤ 30ms |
| API Response Time (p95) | ≤ 100ms |

### 5.2 Validation Rules
- `minAge` phải ≥ 18 và ≤ 100.
- `maxAge` phải ≥ `minAge` và ≤ 100.
- `maxDistance` phải ≥ 1 km và ≤ 200 km (Giới hạn Free tier). Premium có thể lên tới 500 km.
- `genderFilter` phải là một trong các giá trị Enum hợp lệ (`MALE`, `FEMALE`, `NON_BINARY`, `OTHER`, `ALL`).

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "PREFERENCE_CREATED", userId, timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `isOnboarded = true`, bảng `Preference` chưa có bản ghi cho `userId` này.
- **Rules**:
  - WHEN User gọi API tạo Preferences, THE Client SHALL gửi `{ minAge, maxAge, genderFilter, maxDistance }`.
  - IF `minAge > maxAge`, THEN hệ thống SHALL trả về HTTP 400 "Tuổi tối thiểu không được lớn hơn tuổi tối đa".
  - IF User là Free tier AND `maxDistance > 200`, THEN hệ thống SHALL trả về HTTP 400 "Khoảng cách tối đa cho gói miễn phí là 200km".
  - IF User là Premium tier AND `maxDistance > 500`, THEN hệ thống SHALL trả về HTTP 400 "Khoảng cách tối đa là 500km".
  - IF User đã có `Preference` tồn tại, THEN hệ thống SHALL trả về HTTP 409 "Preferences đã tồn tại, vui lòng dùng API cập nhật".
  - THE hệ thống SHALL lưu bản ghi `Preference` vào DB và trả về HTTP 201.

## 7. Acceptance Criteria
- **AC1:** User gửi `minAge=20, maxAge=30, genderFilter=FEMALE, maxDistance=50` → HTTP 201, DB insert thành công.
- **AC2:** User gửi `minAge=30, maxAge=20` → HTTP 400 "Tuổi tối thiểu không được lớn hơn tuổi tối đa".
- **AC3:** User đã có Preference, gọi API tạo lại → HTTP 409.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `minAge < 18`, THE hệ thống SHALL trả về HTTP 400 "Tuổi tối thiểu phải từ 18".
- WHERE `maxDistance` bằng 0 hoặc số âm, THE hệ thống SHALL trả về HTTP 400.
- WHERE `genderFilter` không phải giá trị Enum hợp lệ, THE hệ thống SHALL trả về HTTP 400 (Validation Error).
- WHERE User chưa hoàn tất Onboarding (`isOnboarded = false`), THE hệ thống SHALL trả về HTTP 403 "Vui lòng hoàn tất hồ sơ trước".
