# UC041: Cập nhật Preferences

> **Revision**: v1 — Production-Grade
> - Partial update: Chỉ gửi trường cần đổi.
> - Cùng validation rules với UC039.

## 1. Context & Goal
Cho phép User thay đổi bộ lọc tìm kiếm bất cứ lúc nào (ví dụ: mở rộng phạm vi tuổi, đổi giới tính quan tâm, tăng khoảng cách). Khi Preferences thay đổi, Feed (UC042) sẽ tự động trả về kết quả mới ở lần gọi tiếp theo.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập, đã có Preferences.

## 3. Out of Scope (Non-goals)
- Xóa Preferences (không hỗ trợ — luôn phải có ít nhất 1 bộ lọc).
- Invalidate cache Feed cũ (hiện tại chưa có cache layer).

## 4. Data Model Impact
- Cập nhật bảng `Preference` theo `userId`. Sử dụng `PATCH` (Partial Update).

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Update | ≤ 20ms |
| API Response Time (p95) | ≤ 100ms |

### 5.2 Validation Rules
- Tương tự UC039: `minAge ≥ 18`, `maxAge ≤ 100`, `minAge ≤ maxAge`, `maxDistance ≥ 1`.
- Khi chỉ gửi 1 trường (VD: chỉ đổi `maxDistance`), hệ thống phải lấy giá trị hiện tại của các trường còn lại từ DB để cross-validate (VD: đảm bảo `minAge ≤ maxAge` vẫn đúng sau khi chỉ đổi `minAge`).

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "PREFERENCE_UPDATED", userId, changedFields: [...], timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `Preference` đã tồn tại.
- **Rules**:
  - WHEN User gọi `PATCH /api/discovery/preferences` với body chứa ít nhất 1 trường, THE hệ thống SHALL merge giá trị mới với giá trị cũ trong DB.
  - THE hệ thống SHALL thực hiện validation trên bộ giá trị đã merge (không chỉ giá trị mới).
  - IF `minAge > maxAge` (sau khi merge), THEN hệ thống SHALL trả về HTTP 400.
  - IF User là Free tier AND `maxDistance > 200` (sau khi merge), THEN hệ thống SHALL trả về HTTP 400.
  - IF User là Premium tier AND `maxDistance > 500` (sau khi merge), THEN hệ thống SHALL trả về HTTP 400.
  - THE hệ thống SHALL cập nhật DB và trả về HTTP 200 kèm Preference mới.

## 7. Acceptance Criteria
- **AC1:** User chỉ gửi `{ maxDistance: 100 }` → Hệ thống cập nhật `maxDistance`, các trường khác giữ nguyên. HTTP 200.
- **AC2:** User gửi `{ minAge: 40 }` nhưng `maxAge` hiện tại trong DB = 35 → HTTP 400 "Tuổi tối thiểu không được lớn hơn tuổi tối đa".
- **AC3:** User chưa tạo Preference, gọi PATCH → HTTP 404.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE body trống `{}`, THE hệ thống SHALL trả về HTTP 400 "Cần ít nhất 1 trường để cập nhật".
- WHERE `genderFilter` không phải giá trị Enum hợp lệ, THE hệ thống SHALL trả về HTTP 400.
- WHERE User chưa có Preference, THE hệ thống SHALL trả về HTTP 404 "Vui lòng tạo Preferences trước".
