# UC049: Vuốt lên (Super Like một người dùng)

> **Revision**: v1 — Production-Grade
> - Tương tự Like nhưng có hiệu ứng nổi bật (Target nhận thông báo đặc biệt).
> - Giới hạn 1 lượt Super Like / 24 giờ (Free tier).
> - Premium tier: 5 Super Likes / 24 giờ.

## 1. Context & Goal
Super Like là hành động cao hơn Like thông thường. Khi User Super Like, Target sẽ thấy một viền xanh đặc biệt trên Profile của User (trên Tinder thật là viền xanh dương với ngôi sao). Điều này giúp User nổi bật hơn trong mắt Target. Super Like cũng trigger kiểm tra Match giống Like.

## 2. Actors & Roles
- **User (Swiper)**: Người thực hiện Super Like.
- **Target**: Người nhận Super Like.

## 3. Out of Scope (Non-goals)
- Đính kèm lời nhắn khi Super Like (UC051 — Platinum only).
- Hiệu ứng UI phía Frontend.

## 4. Data Model Impact
- Tạo bản ghi `Swipe` với `action = SUPER_LIKE`. Sử dụng cùng bảng UC047.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Write | ≤ 30ms |
| Match Check Query | ≤ 20ms |
| API Response Time (p95) | ≤ 150ms |

### 5.2 Rate Limiting & Business Limits
- **Free tier**: **1 Super Like / 24 giờ** (rolling window).
- **Plus**: **5 Super Likes / 24 giờ**.
- **Gold/Platinum**: **5 Super Likes / 24 giờ**.
- Khi hết lượt → HTTP 429.

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "SWIPE_SUPER_LIKE", swiperId, targetId, isMatch, superLikesRemaining, timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `isOnboarded = true`.
- **Rules**:
  - WHEN User gọi `POST /api/swipe/super-like` với body `{ targetId }`, THE hệ thống SHALL:
    1. Kiểm tra lượt Super Like còn lại (đếm `Swipe` với `action = SUPER_LIKE` trong 24h qua).
    2. Áp dụng toàn bộ validation giống UC047 (targetId hợp lệ, không self-like, không block).
    3. Tạo (hoặc upsert) bản ghi `Swipe` với `action = SUPER_LIKE`.
    4. Kiểm tra Match giống UC047.
  - THE hệ thống SHALL trả về HTTP 200:
    ```json
    {
      "swipeId": "uuid",
      "action": "SUPER_LIKE",
      "isMatch": false,
      "superLikesRemaining": 0
    }
    ```
  - IF đã có bản ghi `Swipe` (action=LIKE) cho cặp này trước đó, THE hệ thống SHALL nâng cấp thành `SUPER_LIKE` (UPDATE action).

## 7. Acceptance Criteria
- **AC1:** User Free Super Like lần 1 trong ngày → HTTP 200, `superLikesRemaining: 0`.
- **AC2:** User Free Super Like lần 2 trong ngày → HTTP 429 "Hết lượt Super Like hôm nay".
- **AC3:** User Plus Super Like lần 5 → HTTP 200, `superLikesRemaining: 0`.
- **AC4:** Super Like + Target đã Like User → `isMatch: true`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE User đã Pass Target trước đó, THE hệ thống SHALL trả về HTTP 409 "Bạn đã Pass người này. Sử dụng Rewind trước khi Super Like".
- WHERE `targetId` không tồn tại, THE hệ thống SHALL trả về HTTP 404.
- WHERE User tự Super Like chính mình, THE hệ thống SHALL trả về HTTP 400.
