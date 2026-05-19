# UC058: Xem chi tiết Profile của một Match

> **Revision**: v2 — Production-Grade
> - Trả về hồ sơ hoàn chỉnh của đối phương trong lượt Match.
> - Kiểm tra quyền sở hữu chặt chẽ.
> - **v2**: Thêm kiểm tra Ghost Data (đối phương bị Banned/Deleted).

## 1. Context & Goal
Trước khi trò chuyện, người dùng thường muốn xem lại chi tiết hồ sơ (Profile) của người mình đã Match để tìm chủ đề bắt chuyện. Mục tiêu là cung cấp đầy đủ thông tin Bio, Sở thích, Học vấn, v.v.

## 2. Actors & Roles
- **Active User**: Người dùng thuộc về lượt Match đang cần xem.

## 3. Out of Scope (Non-goals)
- Thay đổi thông tin của đối phương.
- Xem Profile của người dùng chưa Match.

## 4. Data Model Impact
- Đọc bảng `Match` để xác thực quyền.
- **Đọc bảng `User`** để kiểm tra `isBanned` và `deletedAt` của đối phương.
- Đọc bảng `Profile`, `Photo`, `Location` của đối phương.
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| API Response Time (p95) | ≤ 300ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- **Authorization Check**: Chỉ có người dùng tham gia trong Match (`userAId` hoặc `userBId`) mới có quyền xem Profile thông qua API này.
- Bắt buộc kiểm tra `status = ACTIVE`.
- Bắt buộc kiểm tra đối phương chưa bị Banned và chưa xóa tài khoản.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "GET_MATCH_PROFILE", userId, targetId, matchId }`.
- Ghi log `WARN` nếu phát hiện có nỗ lực truy cập trái phép.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Tham số `matchId` hợp lệ.
- **Rules**:
  - WHEN User gọi `GET /api/matches/:matchId/profile`, THE hệ thống SHALL:
    1. Kiểm tra sự tồn tại của Match.
    2. Xác minh User hiện tại là một trong hai bên của Match.
    3. Đảm bảo Match đang ở trạng thái `ACTIVE`.
    4. **Kiểm tra Ghost Data**: Xác minh đối phương có `isBanned = false` VÀ `deletedAt IS NULL`.
  - IF điều kiện xác minh quyền thất bại (bước 2, 3), THEN hệ thống SHALL trả về HTTP 403 Forbidden.
  - IF đối phương đã bị Banned hoặc đã xóa tài khoản (bước 4), THEN hệ thống SHALL trả về HTTP 410 Gone kèm message "Tài khoản đối phương không còn khả dụng".
  - IF tất cả điều kiện thành công, THE hệ thống SHALL trả về toàn bộ thông tin Profile của người dùng còn lại.

## 7. Acceptance Criteria
- **AC1:** Xem chi tiết thành công → Trả về HTTP 200 kèm JSON Profile (bao gồm ảnh, bio, thông tin sở thích).
- **AC2:** Bị từ chối do không thuộc về Match → Trả về HTTP 403.
- **AC3:** Bị từ chối do Match đã bị Unmatch trước đó → Trả về HTTP 403.
- **AC4:** Đối phương đã bị Banned → Trả về HTTP 410 Gone "Tài khoản đối phương không còn khả dụng".
- **AC5:** Đối phương đã xóa tài khoản (Soft Delete) → Trả về HTTP 410 Gone.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE `matchId` không tồn tại trong CSDL, THE hệ thống SHALL trả về HTTP 404 Not Found.
- WHERE đối phương đã xóa tài khoản (Soft Delete) hoặc bị Banned, THE hệ thống SHALL trả về HTTP 410 Gone "Tài khoản đối phương không còn khả dụng".
