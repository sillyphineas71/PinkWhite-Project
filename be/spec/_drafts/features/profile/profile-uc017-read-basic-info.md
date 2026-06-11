# UC017: Đọc thông tin cá nhân cơ bản

> **Revision**: v2 — Production-Grade
> - Nằm trong kiến trúc Aggregated Profile API.

## 1. Context & Goal
Trả về các thông tin định danh cơ bản của một User. Thông tin này được hiển thị trên thẻ (Card) quẹt hoặc màn hình chi tiết Profile.

## 2. Actors & Roles
- **User**: Bất kỳ người dùng nào đã đăng nhập.

## 3. Data Model Impact
- Đọc từ bảng `Profile`.

## 4. Non-functional Requirements (NFR)
- Tối ưu hóa API: End-point đọc Profile sẽ được thiết kế gộp (Aggregated) trả về toàn bộ dữ liệu ở UC017, UC021, UC025, UC032 chung trong 1 file JSON (VD: `GET /api/profile/:id`).
- Thời gian DB Query (Bao gồm các JOIN liên quan): ≤ 40ms.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN Client gọi API xem profile của một User, THE hệ thống SHALL truy vấn bảng `Profile` qua `userId`.
  - IF profile là của người khác (khác session user), THEN hệ thống SHALL chỉ trả về `age` (tính toán từ `dob`), và ẩn đi `dob` gốc để bảo vệ quyền riêng tư.
  - IF profile là của chính mình (`/me`), THEN hệ thống SHALL trả về cả `dob` gốc và `age`.

## 6. Acceptance Criteria
- **AC1:** User A xem Profile của User B → JSON trả về có `age: 25`, tuyệt đối không có `dob`.
- **AC2:** User A xem Profile của chính mình → JSON trả về có cả `dob: "2000-01-01"` và `age: 26`.
