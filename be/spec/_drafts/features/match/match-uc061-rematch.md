# UC061: Khôi phục Hủy Tương hợp (Rematch)

> **Revision**: v2 — Production-Grade
> - Hoàn tác lệnh Unmatch.
> - Dành riêng cho Premium User.
> - **v2**: Thêm kiểm tra Ghost Data — chặn Rematch nếu đối phương đã bị Banned hoặc xóa tài khoản.

## 1. Context & Goal
Tính năng độc quyền dành cho gói Premium. Nếu người dùng lỡ tay bấm Unmatch, họ có thể "hối hận" và khôi phục lại lượt Match đó để tiếp tục trò chuyện. Mục tiêu là tạo ra giá trị gia tăng để thu hút người dùng nâng cấp Premium.

## 2. Actors & Roles
- **Premium User**: Người dùng có gói đăng ký trả phí hợp lệ và là người ĐÃ CHỦ ĐỘNG bấm Unmatch trước đó.

## 3. Out of Scope (Non-goals)
- Khôi phục nếu đối phương cũng đã xóa tài khoản.
- Khôi phục nếu chính mình là người BỊ đối phương Unmatch.

## 4. Data Model Impact
- Cập nhật `status` trong bảng `Match` từ `UNMATCHED_*` quay trở lại `ACTIVE`.
- **Đọc bảng `User`** để kiểm tra `isBanned` và `deletedAt` của đối phương trước khi cho phép Rematch.
- UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 200ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Chỉ cho phép chính người đã chủ động Unmatch được quyền khôi phục. Người bị Unmatch sẽ không có quyền thực hiện tính năng này.

### 5.4 Observability
- THE hệ thống SHALL ghi log `INFO`: `{ action: "REMATCH", userId, matchId }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Match đang ở trạng thái `UNMATCHED_*`. User gọi API đang là Premium.
- **Rules**:
  - WHEN User gọi `POST /api/matches/:matchId/rematch`, THE hệ thống SHALL:
    1. Kiểm tra gói cước hiện tại của User. IF là Free, THEN trả về HTTP 403.
    2. Kiểm tra xem User có phải là người đã ra lệnh Unmatch hay không. (VD: Trạng thái là `UNMATCHED_BY_A` thì chỉ `userAId` được gọi).
    3. **Kiểm tra Ghost Data**: Xác minh đối phương có `isBanned = false` VÀ `deletedAt IS NULL`. IF đối phương đã bị Banned hoặc đã xóa tài khoản, THEN trả về HTTP 410 Gone.
  - IF tất cả kiểm tra thành công, THE hệ thống SHALL cập nhật trạng thái Match về `ACTIVE` và trả về HTTP 200 OK.

## 7. Acceptance Criteria
- **AC1:** Rematch thành công (Premium User) → Đổi status thành ACTIVE, hiển thị lại trong danh sách Match.
- **AC2:** Bị chặn do là Free User → Trả về HTTP 403 "Tính năng dành riêng cho Premium".
- **AC3:** Bị chặn do là người BỊ unmatch → Trả về HTTP 403 "Bạn không có quyền khôi phục lượt Match này".
- **AC4:** Đối phương đã bị Banned → Trả về HTTP 410 Gone "Tài khoản đối phương không còn khả dụng".
- **AC5:** Đối phương đã xóa tài khoản → Trả về HTTP 410 Gone.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE Match đang ở trạng thái `ACTIVE` (không cần Rematch), THE hệ thống SHALL trả về HTTP 400 Bad Request.
- WHERE đối phương đã bị Khóa tài khoản (Banned) hoặc xóa tài khoản, THE hệ thống SHALL trả về HTTP 410 Gone "Tài khoản đối phương không còn khả dụng".
