# UC018: Cập nhật thông tin cá nhân cơ bản

> **Revision**: v2 — Production-Grade
> - Giới hạn đổi Ngày sinh và Giới tính: 60 ngày/lần.
> - Tuổi đổi xong vẫn phải ≥ 18.

## 1. Context & Goal
Cho phép user sửa đổi thông tin cá nhân (Tên, Ngày sinh, Giới tính, Đối tượng tìm kiếm). Tuy nhiên, để tránh gian lận thuật toán hoặc fake profile, một số trường nhạy cảm sẽ bị khóa thay đổi trong một khoảng thời gian.

## 2. Actors & Roles
- **User**: Người dùng chủ sở hữu Profile.

## 3. Data Model Impact
- Cập nhật bảng `Profile` (các trường `fullName`, `dob`, `gender`, `searchGender`, `dobUpdatedAt`, `genderUpdatedAt`).

## 4. Non-functional Requirements (NFR)
- DB Update: ≤ 30ms.
- API Rate Limit: Tối đa 20 lần đổi / 1 ngày.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHILE user thực hiện cập nhật `Profile`, THE hệ thống SHALL hỗ trợ Partial Update (PATCH - chỉ sửa những trường được gửi lên).
  - IF user gửi lên `dob` hoặc `gender` mới, THE hệ thống SHALL tính toán thời gian từ lúc tạo Profile (`createdAt`). IF khoảng cách < 24h (Grace Period), THEN hệ thống SHALL cho phép cập nhật tự do không bị giới hạn.
  - ELSE (Sau Grace Period), THE hệ thống SHALL kiểm tra `dobUpdatedAt` / `genderUpdatedAt`. IF khoảng cách hiện tại so với lần đổi cuối < 60 ngày, THEN hệ thống SHALL từ chối HTTP 429 "Chỉ được đổi 60 ngày một lần".
  - IF `dob` mới tính ra < 18 tuổi (theo giờ máy chủ UTC), THEN hệ thống SHALL từ chối HTTP 400.
  - THE hệ thống SHALL cập nhật thành công và ghi nhận lại `dobUpdatedAt` / `genderUpdatedAt` mới.

## 6. Acceptance Criteria
- **AC1:** User đổi `dob` lần đầu tiên, hệ thống ghi nhận thành công và cập nhật `dobUpdatedAt`.
- **AC2:** 10 ngày sau, User đổi `dob` tiếp → HTTP 429 kèm thông báo chờ đủ 60 ngày.
- **AC3:** Đổi `fullName` hoặc `searchGender` không bị ảnh hưởng bởi giới hạn 60 ngày.
