# UC022: Cập nhật thứ tự hiển thị ảnh

> **Revision**: v2 — Production-Grade
> - Bulk Update. Cập nhật isAvatar.

## 1. Context & Goal
Cho phép user tự do kéo thả để thay đổi vị trí các bức ảnh trong Gallery. Thứ tự ảnh rất quan trọng vì ảnh ở Index 0 sẽ làm ảnh đại diện chính (Avatar) hiển thị đầu tiên khi user khác quẹt.

## 2. Actors & Roles
- **User**: Người dùng sở hữu Profile.

## 3. Data Model Impact
- Cập nhật cột `order` và `isAvatar` trong bảng `Photo`.

## 4. Non-functional Requirements (NFR)
- DB Bulk Update (Sử dụng Prisma Transaction hoặc `CASE WHEN` raw query): ≤ 40ms.
- API Response (p95): ≤ 100ms.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN Client gọi API đổi thứ tự, THE Client SHALL gửi một mảng chứa toàn bộ các `photoId` theo thứ tự mới từ trái sang phải (VD: `[id3, id1, id2]`).
  - THE hệ thống SHALL kiểm tra số lượng ID gửi lên phải bằng số lượng ảnh hiện có trong DB.
  - THE hệ thống SHALL thực hiện Bulk Update cột `order` từ `0` đến `n-1` tương ứng với mảng gửi lên.
  - THE hệ thống SHALL tự động set `isAvatar = true` cho bức ảnh nằm ở vị trí đầu tiên (`order = 0`) và set `isAvatar = false` cho các bức ảnh còn lại.

## 6. Acceptance Criteria
- **AC1:** Gửi lên mảng thiếu ID (2 ID trong khi DB có 3 ảnh) → HTTP 400 "Mảng ID không hợp lệ".
- **AC2:** Gửi mảng hợp lệ `[id2, id1]` → DB cập nhật `id2.order=0, id2.isAvatar=true` và `id1.order=1, id1.isAvatar=false` thành công trong ≤ 40ms.
