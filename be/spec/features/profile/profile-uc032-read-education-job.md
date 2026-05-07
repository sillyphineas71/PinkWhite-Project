# UC032: Đọc thông tin Học vấn / Nghề nghiệp

> **Revision**: v2 — Production-Grade
> - Nằm trong kiến trúc Aggregated Profile API.

## 1. Context & Goal
Trả về thông tin chức danh, công ty và trường học của User. Thông tin này thường được hiển thị ngay bên dưới tên và tuổi trên các giao diện thẻ quẹt.

## 2. Actors & Roles
- **User**: Bất kỳ người dùng nào đã đăng nhập.

## 3. Data Model Impact
- Đọc từ bảng `Profile`.

## 4. Non-functional Requirements (NFR)
- End-point này được thiết kế gộp (Aggregated) vào API `GET /api/profile/:id` (xem UC017).

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN Client gọi API xem profile của User, THE hệ thống SHALL truy xuất và trả về các trường `company`, `jobTitle`, `school`.
  - IF các trường này đang là `null`, THEN hệ thống SHALL trả về `null` (hoặc ẩn khỏi JSON response tùy chuẩn giao tiếp).

## 6. Acceptance Criteria
- **AC1:** Query Profile thành công → JSON trả về chứa thông tin `company`, `jobTitle`, `school`.
