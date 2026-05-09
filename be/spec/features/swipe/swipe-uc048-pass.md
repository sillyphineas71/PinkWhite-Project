# UC048: Quẹt trái (Pass một người dùng)

> **Revision**: v1 — Production-Grade
> - Đánh dấu "Không quan tâm" — Target sẽ biến mất khỏi Feed.
> - Không tạo Match. Không giới hạn lượt.

## 1. Context & Goal
Khi User không quan tâm đến một Profile, họ quẹt trái (hoặc nhấn nút X). Hệ thống ghi nhận hành động này để đảm bảo Profile đó không xuất hiện lại trong Feed (UC042). Pass là hành động miễn phí, không giới hạn.

## 2. Actors & Roles
- **User (Swiper)**: Người thực hiện hành động Pass.
- **Target**: Người bị Pass.

## 3. Out of Scope (Non-goals)
- Rewind (UC050 xử lý — hoàn tác Pass).

## 4. Data Model Impact
- Tạo bản ghi `Swipe` với `action = PASS`. Sử dụng cùng bảng với UC047.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Write (INSERT Swipe) | ≤ 20ms |
| API Response Time (p95) | ≤ 100ms |

### 5.2 Rate Limiting
- **Không giới hạn** lượt Pass (khác với Like).

### 5.3 Idempotency
- Giống UC047: Nếu User Pass cùng 1 người 2 lần → Trả về kết quả hiện tại.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `isOnboarded = true`.
- **Rules**:
  - WHEN User gọi `POST /api/swipe/pass` với body `{ targetId }`, THE hệ thống SHALL:
    1. Kiểm tra `targetId` hợp lệ, không phải chính mình.
    2. Tạo (hoặc upsert) bản ghi `Swipe` với `action = PASS`.
  - THE hệ thống SHALL KHÔNG kiểm tra Match (vì đây là hành động từ chối).
  - THE hệ thống SHALL trả về HTTP 200:
    ```json
    { "swipeId": "uuid", "action": "PASS" }
    ```

## 7. Acceptance Criteria
- **AC1:** User A pass User B → HTTP 200, User B không xuất hiện lại trong Feed của User A.
- **AC2:** User A pass chính mình → HTTP 400.
- **AC3:** User A pass User B lần 2 → HTTP 200 (idempotent).

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `targetId` không tồn tại, THE hệ thống SHALL trả về HTTP 404.
- WHERE User đã Like Target trước đó (có bản ghi Swipe action=LIKE), THE hệ thống SHALL trả về HTTP 409 "Bạn đã Like người này, không thể chuyển thành Pass. Sử dụng Rewind để hoàn tác".
