# UC056: Kích hoạt Match (Trigger Match)

> **Revision**: v2 — Production-Grade
> - Tự động tạo Match khi phát hiện Mutual Like.
> - Bắt lỗi Unique Violation để ngăn chặn Race Condition.
> - **v2**: Thay `hasUnreadMessage` (Boolean chung) bằng `unreadCountA` / `unreadCountB` riêng biệt cho từng User.

## 1. Context & Goal
Hệ thống Match (Tương hợp) là cơ chế trung tâm của ứng dụng. Một Match được tạo ra khi có sự đồng thuận từ hai phía (Mutual Like). Mọi hoạt động giao tiếp (Chat) sau này đều dựa trên bản ghi Match này.
Mục tiêu là đảm bảo rằng khi hai người dùng thích nhau, họ sẽ ngay lập tức được kết nối một cách an toàn và không bị trùng lặp dữ liệu.

## 2. Actors & Roles
- **System**: Thực thi ngầm các logic kiểm tra Mutual Like và lưu bản ghi Match mà không cần người dùng gọi trực tiếp một API tạo Match nào.

## 3. Out of Scope (Non-goals)
- Gửi thông báo Push Notification (nằm trong Module Notifications - UC082+).
- Xử lý gửi tin nhắn đầu tiên tự động.

## 4. Data Model Impact
- Đọc bảng `Swipe` (kiểm tra Mutual Like).
- Ghi vào bảng `Match`:
  - `userAId` và `userBId`: Lưu theo thứ tự từ điển (`userAId < userBId`) để tạo UNIQUE CONSTRAINT.
  - `status`: `ACTIVE`.
  - `unreadCountA`: `0` (Số tin nhắn chưa đọc của UserA — khởi tạo bằng 0).
  - `unreadCountB`: `0` (Số tin nhắn chưa đọc của UserB — khởi tạo bằng 0).
  - `lastInteractionAt`: `CURRENT_TIMESTAMP`.
- INSERT.

> **Lý do thiết kế `unreadCountA` / `unreadCountB` thay vì `hasUnreadMessage` chung:**
> Trạng thái "đã đọc" của 2 người trong 1 cuộc chat là hoàn toàn độc lập. Nếu A nhắn cho B, chỉ B mới có tin chưa đọc, A thì không. Dùng 1 cờ Boolean chung sẽ khiến việc reset trạng thái của 1 bên vô tình xóa mất trạng thái của bên còn lại.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query (Insert Match) | ≤ 100ms |

### 5.2 Scalability & Data Integrity
- Bắt buộc có cơ chế khóa Unique (`userAId`, `userBId`) tại DB level để chống Race Condition tạo ra 2 bản ghi Match giữa cùng 2 người nếu họ quẹt cùng lúc.
- Phải có cronjob self-healing quét định kỳ để tạo Match bù nếu hệ thống vô tình miss mutual like do rớt mạng hoặc crash.

### 5.3 Security & Privacy
- ID của Match được sinh bằng thuật toán UUIDv4 khó đoán.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "MATCH_CREATED", userAId, userBId, matchId }`.
- Ghi log `WARN`: khi bắt được lỗi `UNIQUE_VIOLATION`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Hai người dùng đều có trạng thái `isOnboarded = true` và tài khoản không bị ban.
- **Rules**:
  - WHEN hệ thống phát hiện có lượt Like/Super Like chéo nhau giữa User A và User B (Mutual Like) từ Swipe Service, THE hệ thống SHALL:
    1. Chuẩn hóa ID của hai User theo thứ tự từ điển (A < B).
    2. Cố gắng INSERT bản ghi Match mới với `unreadCountA = 0`, `unreadCountB = 0`.
  - IF DB ném lỗi Unique Constraint (nghĩa là bản ghi Match giữa 2 user này đã tồn tại do Request chạy song song), THEN hệ thống SHALL bắt lỗi (catch) và kết thúc tiến trình êm đẹp mà không ném lỗi ra ngoài.

## 7. Acceptance Criteria
- **AC1:** User A quẹt phải User B, và User B đã quẹt phải User A trước đó → Tạo thành công 1 bản ghi Match với `unreadCountA = 0`, `unreadCountB = 0`. Trả về `isMatch = true` cho Swipe API.
- **AC2:** Race Condition (User A và User B quẹt phải nhau cùng một mini-second) → DB chỉ lưu đúng 1 bản ghi Match, request còn lại catch được `UNIQUE_VIOLATION` và cũng trả về `isMatch = true`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE DB ném lỗi Unique Constraint, THE hệ thống SHALL catch lỗi và coi như thao tác thành công (Idempotent).
- WHERE một trong hai User đã bị khóa (Banned), THE hệ thống SHALL hủy bỏ việc tạo Match.
