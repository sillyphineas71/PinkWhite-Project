# UC021: Đọc danh sách ảnh đại diện (Gallery)

> **Revision**: v2 — Production-Grade
> - Nằm trong kiến trúc Aggregated Profile API.

## 1. Context & Goal
Lấy danh sách hình ảnh của người dùng (từ 1 đến 9 tấm) theo đúng thứ tự (order) để render lên giao diện Card swipe.

## 2. Actors & Roles
- **User**: Người dùng có Access Token hợp lệ.

## 3. Data Model Impact
- Đọc từ bảng `Photo`.

## 4. Non-functional Requirements (NFR)
- End-point đọc Gallery sẽ được thiết kế gộp chung (Aggregated) vào API `GET /api/profile/:id` (xem UC017).
- Hệ thống nên có cơ chế Cache (Redis) ở Phase sau. Phase này chỉ query Database.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN Client gọi API xem profile của User, THE hệ thống SHALL truy vấn bảng `Photo` theo `profileId`.
  - THE hệ thống SHALL luôn luôn sắp xếp (Sort) kết quả trả về theo chiều Tăng dần (ASC) của cột `order`.
  - IF danh sách ảnh rỗng, THEN hệ thống SHALL trả về một mảng rỗng `[]` (Tuy nhiên logic UC020 và UC023 đã đảm bảo Profile luôn có ít nhất 1 ảnh).

## 6. Acceptance Criteria
- **AC1:** Query Profile thành công → JSON trả về thuộc tính `photos: [{id, url, order: 0}, {id, url, order: 1}]`.
