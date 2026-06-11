# UC050: Rewind (Hoàn tác lượt quẹt cuối cùng — Premium)

> **Revision**: v1 — Production-Grade
> - Chỉ cho phép hoàn tác lượt quẹt **gần nhất** (1 lần).
> - Chỉ dành cho Premium.
> - Giới hạn: 1 Rewind / ngày (Free không có quyền).

## 1. Context & Goal
Khi User vô tình quẹt trái (Pass) nhầm một Profile hấp dẫn, họ có thể sử dụng Rewind để hoàn tác. Rewind xóa bản ghi `Swipe` cuối cùng, cho phép Profile đó xuất hiện lại trong Feed. Đây là tính năng Premium.

## 2. Actors & Roles
- **User Premium**: Người dùng có gói Plus/Gold/Platinum.

## 3. Out of Scope (Non-goals)
- Rewind nhiều lượt liên tiếp (chỉ cho phép 1 lượt gần nhất).
- Rewind một Like đã tạo Match (không thể tháo Match bằng Rewind — dùng Unmatch UC060).

## 4. Data Model Impact
- Xóa (DELETE) bản ghi `Swipe` gần nhất của User.
- Nếu lượt quẹt gần nhất là Like và đã tạo Match, Rewind sẽ bị từ chối.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query (tìm Swipe gần nhất) | ≤ 15ms |
| DB Delete | ≤ 10ms |
| API Response Time (p95) | ≤ 100ms |

### 5.2 Business Limits
- **Premium**: **Không giới hạn** lượt Rewind.
- **Free**: Không có quyền sử dụng.

### 5.3 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "SWIPE_REWIND", userId, rewindedSwipeId, rewindedAction, timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, có gói Premium active.
- **Rules**:
  - WHEN User gọi `POST /api/swipe/rewind`, THE hệ thống SHALL:
    1. Kiểm tra User có Premium không.
    2. Tìm bản ghi `Swipe` gần nhất của User (`ORDER BY createdAt DESC LIMIT 1`).
  - IF User không có Premium, THEN hệ thống SHALL trả về HTTP 403 "Tính năng Rewind yêu cầu gói Premium".
  - IF không có lượt quẹt nào để hoàn tác (chưa quẹt bao giờ), THEN hệ thống SHALL trả về HTTP 400 "Không có lượt quẹt nào để hoàn tác".
  - IF lượt quẹt gần nhất (LIKE hoặc SUPER_LIKE) và ĐÃ tạo Match, THEN hệ thống SHALL trả về HTTP 409 "Không thể hoàn tác vì đã Match. Vui lòng dùng Unmatch".
  - ELSE, THE hệ thống SHALL xóa bản ghi `Swipe` gần nhất và trả về HTTP 200.
  - THE hệ thống SHALL hỗ trợ Rewind cả Like (chưa match) và Pass.

## 7. Acceptance Criteria
- **AC1:** User Premium quẹt trái User B, sau đó Rewind → Swipe bị xóa. HTTP 200.
- **AC2:** User Premium Like User B (chưa Match), sau đó Rewind → Swipe Like bị xóa. HTTP 200.
- **AC3:** User Free gọi Rewind → HTTP 403.
- **AC4:** User Premium Like User B (tạo Match), gọi Rewind → HTTP 409 "Đã Match".

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE User mới tạo tài khoản, chưa quẹt ai, gọi Rewind → HTTP 400.

- WHERE lượt quẹt gần nhất đã quá 24 giờ, THE hệ thống vẫn cho phép Rewind (không có time limit cho swipe age, chỉ có limit cho lượt Rewind/ngày).
