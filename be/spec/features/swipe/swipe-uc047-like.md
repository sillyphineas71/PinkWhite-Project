# UC047: Quẹt phải (Like một người dùng)

> **Revision**: v1 — Production-Grade
> - Hành động cốt lõi của app Dating: Thể hiện sự quan tâm đến một Profile.
> - Trigger kiểm tra Match (UC056) ngay lập tức.
> - Giới hạn lượt Like cho Free tier.

## 1. Context & Goal
Khi User thấy một Profile phù hợp trong Feed, họ quẹt phải (hoặc nhấn nút Heart) để thể hiện sự quan tâm. Hệ thống ghi nhận hành động này vào bảng `Swipe`, rồi ngay lập tức kiểm tra xem người kia đã Like mình chưa. Nếu có → kích hoạt Match (UC056).

## 2. Actors & Roles
- **User (Swiper)**: Người thực hiện hành động Like.
- **Target**: Người nhận được lượt Like.

## 3. Out of Scope (Non-goals)
- Super Like (UC049 xử lý).
- Thông báo Push cho Target khi bị Like (Module Notification).
- Kích hoạt Match (UC056 xử lý — nhưng được gọi inline từ UC047).

## 4. Data Model Impact
Tạo bản ghi mới trong bảng `Swipe`:
```prisma
model Swipe {
  id         String    @id @default(uuid())
  swiperId   String
  targetId   String
  action     SwipeAction  // LIKE | PASS | SUPER_LIKE
  message    String?      // Chỉ dùng cho Super Like Platinum (UC051)
  createdAt  DateTime  @default(now())

  swiper     User      @relation("SwipesGiven", fields: [swiperId], references: [id])
  target     User      @relation("SwipesReceived", fields: [targetId], references: [id])

  @@unique([swiperId, targetId])
  @@index([targetId, action])
}

enum SwipeAction {
  LIKE
  PASS
  SUPER_LIKE
}
```

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Write (INSERT Swipe) | ≤ 30ms |
| Match Check Query | ≤ 20ms |
| API Response Time (p95) | ≤ 150ms |
| Throughput | ≥ 200 req/s |

### 5.2 Rate Limiting & Business Limits
- **Free tier**: Giới hạn **100 lượt Like / 24 giờ** (rolling window). Khi hết lượt → HTTP 429 kèm thông báo thời gian reset.
- **Premium tier (Plus/Gold/Platinum)**: Unlimited Likes.

### 5.3 Idempotency
- THE hệ thống SHALL đảm bảo constraint `@@unique([swiperId, targetId])`. Nếu User Like cùng 1 người 2 lần → Trả về kết quả Like hiện tại mà không tạo bản ghi mới (upsert behavior).

### 5.4 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "SWIPE_LIKE", swiperId, targetId, isMatch: true/false, timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `isOnboarded = true`.
- **Rules**:
  - WHEN User gọi `POST /api/swipe/like` với body `{ targetId }`, THE hệ thống SHALL:
    1. Kiểm tra lượt Like còn lại (Free tier).
    2. Kiểm tra `targetId` có tồn tại, không bị ban, không bị xóa.
    3. Kiểm tra User không tự Like chính mình.
    4. Kiểm tra User chưa Block Target và Target chưa Block User.
    5. Tạo (hoặc upsert) bản ghi `Swipe` với `action = LIKE`.
    6. Kiểm tra Match: Query xem Target đã Like User trước đó chưa (`WHERE swiperId = targetId AND targetId = swiperId AND action IN (LIKE, SUPER_LIKE)`).
  - IF Target đã Like User trước đó (Mutual Like), THEN hệ thống SHALL:
    1. Kích hoạt UC056: Tạo bản ghi Match (Mock MatchRepository).
    2. Trả về response có `isMatch: true` và `matchId`.
  - IF không phải Mutual Like, THEN hệ thống SHALL trả về `isMatch: false`.
  - THE hệ thống SHALL trả về HTTP 200:
    ```json
    {
      "swipeId": "uuid",
      "action": "LIKE",
      "isMatch": false,
      "likesRemaining": 95
    }
    ```
  - IF `isMatch = true`, response bổ sung:
    ```json
    {
      "swipeId": "uuid",
      "action": "LIKE",
      "isMatch": true,
      "matchId": "uuid",
      "matchedUser": { "userId": "...", "fullName": "...", "photos": [...] }
    }
    ```

## 7. Acceptance Criteria
- **AC1:** User A like User B (B chưa like A) → HTTP 200, `isMatch: false`, `likesRemaining` giảm 1.
- **AC2:** User A like User B (B đã like A trước đó) → HTTP 200, `isMatch: true`, bản ghi `Match` được tạo.
- **AC3:** User Free đã dùng hết 100 lượt Like trong 24h → HTTP 429 "Hết lượt Like hôm nay".
- **AC4:** User A like chính mình → HTTP 400 "Không thể Like chính mình".
- **AC5:** User A like User B lần 2 → HTTP 200, trả về kết quả hiện tại (idempotent), không tạo bản ghi mới.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `targetId` không tồn tại trong hệ thống, THE hệ thống SHALL trả về HTTP 404.
- WHERE Target đã bị ban hoặc đã xóa tài khoản, THE hệ thống SHALL trả về HTTP 404 "Người dùng không tồn tại".
- WHERE User đã block Target hoặc Target đã block User, THE hệ thống SHALL trả về HTTP 403 "Không thể tương tác với người dùng này".
- WHERE DB insert thất bại (unique constraint violation do race condition), THE hệ thống SHALL catch lỗi và trả về kết quả Swipe hiện tại (idempotent).
