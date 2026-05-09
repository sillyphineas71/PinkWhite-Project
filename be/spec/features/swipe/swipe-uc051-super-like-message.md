# UC051: Đính kèm lời nhắn khi Super Like (Platinum Only)

> **Revision**: v1 — Production-Grade
> - Chỉ dành cho gói Platinum.
> - Tối đa 140 ký tự (giống Tweet cũ).
> - Profanity + URL filter.

## 1. Context & Goal
User có gói Platinum được phép gửi kèm một lời nhắn ngắn khi Super Like. Lời nhắn này sẽ hiển thị trên thẻ Profile của User khi Target xem qua Feed, giúp User nổi bật hơn và tăng tỷ lệ Match.

## 2. Actors & Roles
- **User Platinum**: Người dùng có gói Platinum active.

## 3. Out of Scope (Non-goals)
- Chat trực tiếp trước Match (chỉ có lời nhắn đính kèm Super Like).

## 4. Data Model Impact
- Cập nhật cột `message` trong bản ghi `Swipe` (action = SUPER_LIKE).

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Write/Update | ≤ 30ms |
| API Response Time (p95) | ≤ 150ms |

### 5.2 Validation & Security
- `message` tối đa **140 ký tự**.
- Áp dụng **Profanity Filter** và **URL Filter** giống UC024 (chặn từ cấm, chặn link).
- Chống XSS: Strip HTML tags.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, có gói Platinum active.
- **Rules**:
  - WHEN User gọi `POST /api/swipe/super-like` với body `{ targetId, message }`, THE hệ thống SHALL:
    1. Kiểm tra User có Platinum không.
    2. IF User không phải Platinum VÀ `message` không rỗng, THEN hệ thống SHALL trả về HTTP 403 "Gửi lời nhắn kèm Super Like yêu cầu gói Platinum".
    3. Validate `message`: max 140 ký tự, không chứa URL, không chứa từ cấm.
    4. Lưu `message` vào cột `Swipe.message`.
  - IF `message` chứa URL hoặc từ cấm, THEN hệ thống SHALL trả về HTTP 400 "Lời nhắn vi phạm tiêu chuẩn cộng đồng".
  - IF `message` vượt quá 140 ký tự, THEN hệ thống SHALL trả về HTTP 400 "Lời nhắn tối đa 140 ký tự".
  - THE hệ thống SHALL tự động trim khoảng trắng hai đầu của `message`.

## 7. Acceptance Criteria
- **AC1:** User Platinum Super Like kèm `message = "Hi!"` → HTTP 200, `Swipe.message` = "Hi!".
- **AC2:** User Plus Super Like kèm message → HTTP 403 "Yêu cầu gói Platinum".
- **AC3:** User Platinum gửi message 150 ký tự → HTTP 400.
- **AC4:** User Platinum gửi `message = "Add me on www.instagram.com"` → HTTP 400 "Vi phạm tiêu chuẩn".

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `message` chỉ toàn khoảng trắng (sau khi trim thành rỗng), THE hệ thống SHALL coi như không gửi message (lưu `null`).
- WHERE User Platinum gửi Super Like nhưng KHÔNG kèm message, THE hệ thống SHALL xử lý giống UC049 bình thường (message = null).
