# UC025: Đọc Bio và Sở thích

> **Revision**: v2 — Production-Grade
> - Nằm trong kiến trúc Aggregated Profile API.

## 1. Context & Goal
Trả về đoạn mô tả bản thân và danh sách Sở thích (Interests) của một User.

## 2. Actors & Roles
- **User**: Bất kỳ người dùng nào đã đăng nhập.

## 3. Data Model Impact
- Đọc từ bảng `Profile` kết hợp JOIN với bảng `Interest` thông qua bảng trung gian `ProfileInterest`.

## 4. Non-functional Requirements (NFR)
- End-point này được thiết kế gộp (Aggregated) vào API `GET /api/profile/:id` (xem UC017).

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN Client gọi API xem profile của User, THE hệ thống SHALL truy xuất trường `bio` từ bảng `Profile`.
  - THE hệ thống SHALL query danh sách các sở thích tương ứng và trả về một mảng chứa tên Sở thích (VD: `["Du lịch", "Đọc sách"]`) thay vì chỉ trả về UUID khô khan để Frontend không phải gọi API từ điển mapping.

## 6. Acceptance Criteria
- **AC1:** Query Profile thành công → JSON trả về chứa `bio` và `interests: ["Đọc sách", "Cà phê"]`.
