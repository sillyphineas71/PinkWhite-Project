# UC052: Kiểm tra số lượt Like còn lại

> **Revision**: v1 — Production-Grade
> - Trả về số lượt Like đã dùng, còn lại, và thời gian reset.
> - Dùng cho cả Free và Premium.

## 1. Context & Goal
Frontend cần biết User còn bao nhiêu lượt Like trong ngày để hiển thị UI counter (ví dụ: "Còn 15 lượt Like"). Với Premium (Unlimited), API trả về trạng thái đặc biệt. Cũng cho phép hiển thị thời gian reset khi User hết lượt.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Kiểm tra lượt Super Like (UC053 xử lý).
- Mua thêm lượt Like (Module Monetization).

## 4. Data Model Impact
- Đọc bảng `Swipe` (đếm số bản ghi `action = LIKE` trong 24h qua của User).
- Không thay đổi DB.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Count Query | ≤ 15ms |
| API Response Time (p95) | ≤ 50ms |

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `GET /api/swipe/likes/remaining`, THE hệ thống SHALL:
    1. Đếm số `Swipe` có `action = LIKE` trong 24h qua (rolling window từ `NOW() - 24h`).
    2. Xác định tier của User (Free/Premium).
  - IF User là Premium, THEN hệ thống SHALL trả về:
    ```json
    { "tier": "PREMIUM", "isUnlimited": true, "likesUsed": 42 }
    ```
  - IF User là Free, THEN hệ thống SHALL trả về:
    ```json
    {
      "tier": "FREE",
      "isUnlimited": false,
      "maxLikes": 100,
      "likesUsed": 85,
      "likesRemaining": 15,
      "resetsAt": "2026-05-10T08:00:00Z"
    }
    ```
  - `resetsAt` = thời điểm bản ghi `Swipe(action=LIKE)` cũ nhất trong window 24h hết hiệu lực (để Frontend countdown).

## 7. Acceptance Criteria
- **AC1:** User Free đã Like 50 lần hôm nay → Response `likesRemaining: 50`.
- **AC2:** User Premium đã Like 200 lần → Response `isUnlimited: true, likesUsed: 200`.
- **AC3:** User Free chưa Like ai hôm nay → Response `likesRemaining: 100`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE JWT không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
- WHERE User chưa Onboarding, THE hệ thống vẫn trả về data bình thường (likesUsed: 0).
