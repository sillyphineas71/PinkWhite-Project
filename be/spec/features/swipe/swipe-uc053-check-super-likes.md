# UC053: Kiểm tra số lượt Super Like còn lại

> **Revision**: v1 — Production-Grade
> - Tương tự UC052 nhưng cho Super Like.

## 1. Context & Goal
Frontend cần hiển thị số lượt Super Like còn lại (thường hiện trên nút ngôi sao xanh). Free tier có 1 lượt/ngày, Premium có 5 lượt/ngày.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập.

## 3. Out of Scope (Non-goals)
- Mua thêm Super Like (Module Monetization — UC078).

## 4. Data Model Impact
- Đọc bảng `Swipe` (đếm `action = SUPER_LIKE` trong 24h). Không thay đổi DB.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Count Query | ≤ 15ms |
| API Response Time (p95) | ≤ 50ms |

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập.
- **Rules**:
  - WHEN User gọi `GET /api/swipe/super-likes/remaining`, THE hệ thống SHALL:
    1. Đếm số `Swipe` có `action = SUPER_LIKE` trong 24h qua.
    2. Xác định max Super Like theo tier (Free: 1, Plus/Gold/Platinum: 5).
  - THE hệ thống SHALL trả về HTTP 200:
    ```json
    {
      "tier": "FREE",
      "maxSuperLikes": 1,
      "superLikesUsed": 1,
      "superLikesRemaining": 0,
      "resetsAt": "2026-05-10T08:00:00Z"
    }
    ```

## 7. Acceptance Criteria
- **AC1:** User Free đã dùng 1 Super Like → `superLikesRemaining: 0`.
- **AC2:** User Plus chưa dùng Super Like nào → `superLikesRemaining: 5`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE JWT không hợp lệ, THE hệ thống SHALL trả về HTTP 401.
