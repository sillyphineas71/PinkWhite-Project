# UC063-A: Typing Indicator ("Đang gõ...")

> **Revision**: v1 — Production-Grade
> - Phát event "Đang gõ..." qua Socket.IO.
> - Trạng thái ephemeral (không lưu DB).

## 1. Context & Goal
Giúp người dùng biết khi nào đối phương đang gõ tin nhắn, tạo cảm giác cuộc trò chuyện diễn ra realtime và liền mạch. Đây là tính năng tiêu chuẩn trên các ứng dụng chat (Tinder, Messenger).

## 2. Actors & Roles
- **Sender**: Người đang gõ chữ.
- **Receiver**: Người đang mở cuộc trò chuyện và nhìn thấy trạng thái.

## 3. Out of Scope (Non-goals)
- Lưu trữ lịch sử "đang gõ" vào DB.
- Trạng thái "đang ghi âm".

## 4. Data Model Impact
- **Không có**. Chỉ chuyển tiếp (relay) sự kiện qua bộ nhớ tạm của Socket.IO (In-memory pub/sub).

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Socket Relay Latency | ≤ 50ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ thành viên Match `ACTIVE` mới nhận được trạng thái của nhau.
- Event Typing cần được debounce/throttle ở phía Client (vd: gửi 1 lần mỗi 2 giây) để tránh spam server.

### 5.4 Observability
- Không log event này để tránh làm rác hệ thống (quá nhiều sự kiện).

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Cả 2 User thuộc Match `ACTIVE` và đang kết nối Socket.
- **Rules**:
  - WHEN Sender phát sự kiện Socket `chat:typing` với payload `{ matchId, isTyping: boolean }`, THE hệ thống SHALL:
    1. Xác thực Sender thuộc Match và Match đang `ACTIVE`.
    2. Relay sự kiện `chat:typing` tới Receiver (kèm `userId` của Sender và trạng thái `isTyping`).
  - IF Receiver đang offline, THEN hệ thống sẽ lặng lẽ bỏ qua sự kiện này.

## 7. Acceptance Criteria
- **AC1:** Sender gõ chữ → Receiver thấy "Đang gõ...".
- **AC2:** Sender ngừng gõ → Receiver thấy mất chữ "Đang gõ...".
- **AC3:** Sender gõ khi Receiver offline → Hệ thống không crash, không lưu DB.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Match đã bị Unmatch, THE hệ thống SHALL chặn event.
