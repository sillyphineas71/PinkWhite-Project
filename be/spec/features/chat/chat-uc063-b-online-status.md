# UC063-B: Online/Offline Status (Trạng thái hoạt động)

> **Revision**: v1 — Production-Grade
> - Dùng Redis để theo dõi trạng thái kết nối Socket.IO.
> - Phát event khi user online/offline.

## 1. Context & Goal
Cho phép người dùng biết đối phương hiện có đang online (đang mở ứng dụng) hay không. Tính năng này tăng cơ hội tương tác tức thì. Tinder thường hiển thị dấu chấm xanh lá hoặc "Vừa mới truy cập".

## 2. Actors & Roles
- **Active User**: Bất kỳ user nào đang đăng nhập.

## 3. Out of Scope (Non-goals)
- Hiển thị "Lần cuối truy cập" (Last seen at) nếu user đã offline quá lâu (có thể implement ở phase sau, hiện tại chỉ tập trung trạng thái Online/Offline trực tiếp).

## 4. Data Model Impact
- Dùng **Redis** (In-memory Store) để lưu trạng thái.
- Key: `user_status:{userId}`
- Value: `online`
- TTL (Time-to-Live): Tương đương phiên Socket (hoặc tự động xóa khi disconnect).

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Cập nhật Redis | ≤ 10ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ những người ĐÃ MATCH mới có quyền subscribe/nghe event online/offline của nhau.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "USER_ONLINE_STATUS", userId, status: "ONLINE|OFFLINE" }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User kết nối/ngắt kết nối Socket.IO.
- **Rules**:
  - WHEN User kết nối Socket thành công, THE hệ thống SHALL:
    1. SET key `user_status:{userId}` = `online` trên Redis.
    2. Phát sự kiện `user:statusChanged` (`{ userId, status: "ONLINE" }`) tới tất cả các phòng (rooms) của những người đã Match với User này.
  - WHEN User ngắt kết nối Socket (disconnect/timeout), THE hệ thống SHALL:
    1. XÓA key `user_status:{userId}` khỏi Redis.
    2. Phát sự kiện `user:statusChanged` (`{ userId, status: "OFFLINE" }`) tới tất cả các Match của User này.
  - WHEN một User (A) mở app và muốn biết trạng thái của Match (B), User A gọi API `GET /api/chat/status/:partnerId`, THE hệ thống SHALL đọc Redis và trả về `status: "ONLINE"` hoặc `"OFFLINE"`.

## 7. Acceptance Criteria
- **AC1:** B mở app → A (đã Match với B) thấy chấm xanh "Online".
- **AC2:** B đóng app → A thấy B mất chấm xanh ("Offline").
- **AC3:** C (chưa Match với B) KHÔNG thể nhận được event trạng thái của B.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Redis bị lỗi/down, THE hệ thống SHALL mặc định coi tất cả User là OFFLINE và không gây crash luồng Socket chính.
