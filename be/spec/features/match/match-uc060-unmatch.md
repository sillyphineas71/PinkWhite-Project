# UC060: Hủy Tương hợp (Unmatch)

> **Revision**: v1 — Production-Grade
> - Thay đổi trạng thái Match.
> - Ẩn cuộc trò chuyện giữa 2 bên.

## 1. Context & Goal
Người dùng có quyền kết thúc sự kết nối với đối phương (Unmatch) bất cứ lúc nào nếu cảm thấy không phù hợp hoặc bị làm phiền. Sau khi Unmatch, cả hai sẽ không còn nhìn thấy nhau trong danh sách Match và không thể nhắn tin cho nhau nữa. Mục tiêu là trao quyền kiểm soát kết nối cho người dùng và bảo vệ sự riêng tư.

## 2. Actors & Roles
- **Active User**: Người dùng thực hiện lệnh Unmatch đối phương.

## 3. Out of Scope (Non-goals)
- Xóa vật lý (Hard Delete) tin nhắn chat (tin nhắn vẫn được lưu trữ trên server vì lý do pháp lý/CSKH).
- Báo cáo (Report) đối phương (đây là UC038 riêng).

## 4. Data Model Impact
- Cập nhật cột `status` trong bảng `Match` thành `UNMATCHED_BY_A` hoặc `UNMATCHED_BY_B` tùy thuộc vào ai là người Unmatch.
- UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 200ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- **Data Privacy**: Khi một người Unmatch, THE hệ thống SHALL KHÔNG gửi thông báo Push Notification nào cho người bị Unmatch để bảo vệ quyền riêng tư.
- Đối phương chỉ âm thầm biến mất khỏi danh sách của nhau.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "UNMATCH", userId, matchId }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Match đang ở trạng thái `ACTIVE`.
- **Rules**:
  - WHEN User gọi `POST /api/matches/:matchId/unmatch`, THE hệ thống SHALL:
    1. Kiểm tra tính hợp lệ của Match.
    2. Nếu User là `userAId`, đổi status thành `UNMATCHED_BY_A`.
    3. Nếu User là `userBId`, đổi status thành `UNMATCHED_BY_B`.
  - THE hệ thống SHALL trả về HTTP 200 OK.

## 7. Acceptance Criteria
- **AC1:** Unmatch thành công → Trạng thái Match thay đổi, trả về HTTP 200. Danh sách Match của cả hai bị mất người kia.
- **AC2:** Bị từ chối do không thuộc Match → Trả về HTTP 403.
- **AC3:** Unmatch một Match đã bị Unmatch trước đó → Trả về HTTP 400.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Match đã ở trạng thái `UNMATCHED_*`, THE hệ thống SHALL trả về HTTP 400 "Lượt Match đã bị hủy trước đó".
- WHERE `matchId` không tồn tại, THE hệ thống SHALL trả về HTTP 404 Not Found.
