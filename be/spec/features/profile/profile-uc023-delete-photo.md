# UC023: Xóa ảnh đại diện

> **Revision**: v2 — Production-Grade
> - Cấm xóa nếu chỉ còn 1 ảnh (Luôn đảm bảo Profile có ≥ 1 ảnh).

## 1. Context & Goal
User có quyền xóa những bức ảnh cũ hoặc xấu. Hệ thống sẽ xóa file gốc trên Cloud và sắp xếp lại thứ tự ảnh trong DB. Tuy nhiên, để đảm bảo chất lượng Profile, không cho phép User xóa trắng toàn bộ ảnh.

## 2. Actors & Roles
- **User**: Người dùng sở hữu Profile.

## 3. Data Model Impact
- Xóa bản ghi trong bảng `Photo`.

## 4. Non-functional Requirements (NFR)
- Trigger webhook / queue message xóa ảnh vật lý trên S3/Cloudinary: Phải chạy background (Async) để không block luồng Response của API.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN user gọi API xóa một `photoId`, THE hệ thống SHALL đếm tổng số ảnh hiện tại của user đó.
  - IF tổng số ảnh hiện tại = 1, THEN hệ thống SHALL từ chối xóa và trả về HTTP 400 "Bắt buộc phải có tối thiểu 1 ảnh trong hồ sơ".
  - THE hệ thống SHALL xóa bản ghi `Photo` khỏi DB.
  - Ngay sau khi xóa, THE hệ thống SHALL tự động tính toán lại (Normalize) cột `order` của các ảnh còn lại (Ví dụ: Đang có 0, 1, 2. Xóa 1 thì ảnh 2 phải tụt xuống order = 1).
  - IF ảnh bị xóa đang là ảnh đầu tiên (`order = 0`), THE hệ thống SHALL chuyển cờ `isAvatar = true` cho ảnh được đẩy lên đầu (order mới = 0).
  - Cuối cùng, THE hệ thống SHALL gửi 1 background job (bất đồng bộ) để xóa file gốc trên S3/Cloudinary.

## 6. Acceptance Criteria
- **AC1:** User có 1 ảnh, bấm xóa → HTTP 400 "Tối thiểu 1 ảnh".
- **AC2:** User xóa ảnh ở giữa → DB tự normalize lại `order` cho các ảnh phía sau.
- **AC3:** Lệnh xóa vật lý trên S3 không ảnh hưởng đến tốc độ API (Response ≤ 100ms).
