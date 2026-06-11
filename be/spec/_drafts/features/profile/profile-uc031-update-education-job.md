# UC031: Cập nhật thông tin Học vấn / Nghề nghiệp

> **Revision**: v2 — Production-Grade
> - Nằm trên màn hình Edit Profile, tách API riêng biệt với Update Bio.
> - Giới hạn 100 ký tự.

## 1. Context & Goal
Cho phép User điền thêm thông tin về trường học, công ty và chức danh nghề nghiệp. Các thông tin này giúp hồ sơ trở nên đáng tin cậy hơn.

## 2. Actors & Roles
- **User**: Người dùng sở hữu Profile.

## 3. Data Model Impact
- Cập nhật các cột `company`, `jobTitle`, `school` trong `Profile`.

## 4. Non-functional Requirements (NFR)
- **Security:** Chống XSS injection. Tích hợp bộ lọc từ khóa (Banned words) và chặn tuyệt đối các đường link URL.
- **Validation:** Mỗi trường (School, Company, JobTitle) dài tối đa 100 ký tự. Không cho truyền chuỗi chỉ toàn khoảng trắng.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHILE user đang ở tab chỉnh sửa Học vấn / Nghề nghiệp, THE Client SHALL gọi API PATCH tách biệt (chỉ mang theo các trường `company`, `jobTitle`, `school`).
  - IF bất kỳ trường nào có độ dài > 100 ký tự, THEN hệ thống SHALL trả về HTTP 400 (Lỗi vượt quá giới hạn ký tự).
  - IF bất kỳ trường nào chứa từ khóa cấm hoặc URL, THEN hệ thống SHALL từ chối và trả về HTTP 400 (Vi phạm nội dung).
  - THE hệ thống SHALL tự động trim (cắt khoảng trắng hai đầu) trước khi lưu.
  - THE hệ thống SHALL lưu thông tin vào DB và trả về HTTP 200.

## 6. Acceptance Criteria
- **AC1:** Gửi `school` dài 105 ký tự → HTTP 400.
- **AC2:** Gửi `company = "    "` (chỉ toàn space) → DB lưu dạng rỗng (hoặc null), tùy theo framework xử lý.
- **AC3:** Cập nhật thành công → HTTP 200.
