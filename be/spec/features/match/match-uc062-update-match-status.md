# UC062: Cập nhật trạng thái Match (Đã đọc/Chưa đọc)

> **Revision**: v2 — Production-Grade
> - Reset bộ đếm tin nhắn chưa đọc khi user mở giao diện Chat.
> - Yêu cầu phản hồi siêu nhanh.
> - **v2**: Thay `hasUnreadMessage` bằng `unreadCountA`/`unreadCountB` — chỉ reset cột của User đang gọi API.

## 1. Context & Goal
Để hỗ trợ việc hiển thị icon "Chấm đỏ" (New Message Badge) trên giao diện danh sách Match, hệ thống cần một API để đánh dấu rằng người dùng đã vào xem tin nhắn. Mục tiêu là giữ cho Notification Badges trên UI luôn chính xác **cho từng người dùng riêng biệt**.

> **Lý do thiết kế:**
> Trạng thái "đã đọc" của 2 người trong 1 cuộc chat là hoàn toàn độc lập. Khi A mở Chat, chỉ reset bộ đếm của A (`unreadCountA = 0`). Bộ đếm của B (`unreadCountB`) không bị ảnh hưởng. Điều này ngăn chặn bug "chấm đỏ biến mất" khi người kia vừa đọc tin.

## 2. Actors & Roles
- **Active User**: Người dùng nhận tin nhắn mới và vừa mở cuộc trò chuyện.

## 3. Out of Scope (Non-goals)
- Realtime Read Receipt trong lúc đang chat (Cái này xử lý bằng Socket.IO - Module 6). API này chỉ dùng khi người dùng VÀO màn hình Chat từ danh sách.

## 4. Data Model Impact
- Cập nhật trường `unreadCountA` hoặc `unreadCountB` trong bảng `Match` thành `0`, tùy thuộc vào User nào đang gọi API.
- UPDATE (chỉ update đúng 1 cột của phía User gọi, KHÔNG chạm vào cột của đối phương).

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 100ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ tác động lên bộ đếm tin nhắn chưa đọc của phía User hiện tại, tuyệt đối không ảnh hưởng phía đối phương.

### 5.4 Observability
- Không ghi log (để tránh spam log do API gọi quá nhiều lần).

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Match đang `ACTIVE`. User hiện tại là thành viên của Match.
- **Rules**:
  - WHEN User gọi `PATCH /api/matches/:matchId/read`, THE hệ thống SHALL:
    1. Kiểm tra tính hợp lệ của Match (tồn tại, ACTIVE, User thuộc về Match).
    2. Xác định User hiện tại là `userAId` hay `userBId`.
    3. IF User hiện tại là `userAId`, THEN cập nhật `unreadCountA = 0`.
    4. IF User hiện tại là `userBId`, THEN cập nhật `unreadCountB = 0`.
  - THE hệ thống SHALL trả về HTTP 200 OK.

## 7. Acceptance Criteria
- **AC1:** User A đánh dấu đã đọc → `unreadCountA` về 0, `unreadCountB` KHÔNG bị thay đổi. Trả về HTTP 200.
- **AC2:** User B đánh dấu đã đọc → `unreadCountB` về 0, `unreadCountA` KHÔNG bị thay đổi. Trả về HTTP 200.
- **AC3:** Bị chặn do không thuộc Match → Trả về HTTP 403.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Match không tồn tại, THE hệ thống SHALL trả về HTTP 404.
- WHERE Token hết hạn, THE hệ thống SHALL trả về HTTP 401.
- WHERE User không thuộc Match, THE hệ thống SHALL trả về HTTP 403.
