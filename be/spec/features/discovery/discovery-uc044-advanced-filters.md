# UC044: Áp dụng Advanced Filters (Premium Only)

> **Revision**: v1 — Production-Grade
> - Chỉ dành cho User có gói Premium (Plus/Gold/Platinum).
> - Bổ sung thêm bộ lọc: Chỉ người đã Verify, Lọc theo Lifestyle.

## 1. Context & Goal
Ngoài Preferences cơ bản (Tuổi, Giới tính, Khoảng cách), User Premium có thể bật thêm các bộ lọc nâng cao để thu hẹp kết quả Feed. Ví dụ: chỉ hiển thị người đã xác thực khuôn mặt (Verified), hoặc lọc theo tiêu chí Lifestyle (không hút thuốc, có thú cưng).

## 2. Actors & Roles
- **User Premium**: Người dùng đang có gói subscription active.

## 3. Out of Scope (Non-goals)
- Xử lý thanh toán / kiểm tra gói Premium (Module Monetization đảm nhiệm).
- KYC / Verify khuôn mặt (đã loại khỏi scope ở v1).

## 4. Data Model Impact
- Mở rộng bảng `Preference` thêm các cột:
```prisma
  // Advanced Filters — chỉ áp dụng cho Premium
  onlyVerified    Boolean  @default(false)
  onlyHasPhoto    Boolean  @default(true)
  lifestyleSmoking  String?  // "NEVER" | "SOMETIMES" | "REGULARLY"
  lifestyleDrinking String?  // "NEVER" | "SOCIALLY" | "FREQUENTLY"
  lifestylePets     String?  // "HAS_PETS" | "NO_PETS"
```

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Update (filter fields) | ≤ 20ms |
| API Response Time (p95) | ≤ 100ms |

### 5.2 Security
- THE hệ thống SHALL kiểm tra trạng thái Premium của User trước khi cho phép lưu Advanced Filters.
- IF User không có Premium, THEN hệ thống SHALL từ chối và trả về HTTP 403.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, đã có Preferences, có gói Premium active.
- **Rules**:
  - WHEN User Premium gọi `PATCH /api/discovery/preferences/advanced`, THE Client SHALL gửi body chứa các trường filter nâng cao.
  - IF User không có gói Premium active, THEN hệ thống SHALL trả về HTTP 403 "Tính năng này yêu cầu gói Premium".
  - THE hệ thống SHALL lưu các advanced filter vào bảng `Preference`.
  - THE hệ thống SHALL áp dụng các filter này trong logic query của UC042 (Feed):
    - IF `onlyVerified = true`, THEN Feed chỉ trả về User có `isVerified = true`.
    - IF `lifestyleSmoking = "NEVER"`, THEN Feed chỉ trả về User có trường smoking = "NEVER".
  - THE hệ thống SHALL trả về HTTP 200 kèm Preference đã cập nhật.

## 7. Acceptance Criteria
- **AC1:** User Premium bật `onlyVerified = true` → Feed chỉ hiển thị User đã verify.
- **AC2:** User Free gọi API Advanced Filters → HTTP 403.
- **AC3:** User Premium đặt `lifestyleSmoking = "NEVER"` → Feed loại trừ tất cả User có `smoking ≠ NEVER`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE User Premium hết hạn giữa chừng, THE hệ thống SHALL vẫn giữ dữ liệu Advanced Filters trong DB nhưng UC042 SHALL bỏ qua chúng khi query (fallback về Basic Filters).
- WHERE giá trị `lifestyleSmoking` không hợp lệ (ví dụ: "INVALID_VALUE"), THE hệ thống SHALL trả về HTTP 400.
