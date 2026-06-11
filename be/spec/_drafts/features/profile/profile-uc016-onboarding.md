# UC016: Tạo thông tin cá nhân cơ bản (Onboarding - Bước 1)

> **Revision**: v2 — Production-Grade
> - Hỗ trợ giới tính mở rộng (Non-binary / LGBT).
> - Tính tuổi bắt buộc ≥ 18.
> - Đây là bước 1 trong luồng Onboarding đa bước.

## 1. Context & Goal
Sau khi xác thực tài khoản qua Module Auth, User phải cung cấp các thông tin định danh cốt lõi (Tên, Ngày sinh, Giới tính, Sở thích tìm kiếm) để hệ thống khởi tạo `Profile`. User chưa được tính là hoàn thành Onboarding (`isOnboarded = false`) cho đến khi upload thành công ảnh đầu tiên (xem UC020).

## 2. Actors & Roles
- **User**: Người dùng mới đã đăng ký, `isOnboarded = false`.

## 3. Data Model Impact
- Tạo bản ghi mới trong bảng `Profile`.

## 4. Non-functional Requirements (NFR)
### 4.1 Performance SLA
- Logic Validation (Tính Age từ DOB): ≤ 5ms.
- DB Insert: ≤ 30ms.
- API Response Time (p95): ≤ 100ms.

### 4.2 Security
- **Age Calculation:** Bắt buộc tính toán số tuổi dựa trên `dob` ở phía Server (sử dụng chuẩn múi giờ UTC), tuyệt đối không nhận tham số `age` từ Client truyền lên.

## 5. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `Profile` chưa tồn tại.
- **Rules**:
  - WHILE user điền form Onboarding (Bước 1), THE Client SHALL gửi `fullName`, `dob`, `gender`, `searchGender`.
  - IF `dob` tính ra nhỏ hơn 18 tuổi, THEN hệ thống SHALL từ chối tạo Profile và trả về HTTP 400 (Lỗi Validation: Phải đủ 18 tuổi).
  - THE hệ thống SHALL lưu lại `dobUpdatedAt` và `genderUpdatedAt` là thời điểm hiện tại.
  - Sau khi lưu DB thành công, THE hệ thống SHALL trả về HTTP 201 kèm yêu cầu tiếp tục Bước 2 (Upload ảnh). Trạng thái `isOnboarded` vẫn là `false`.

## 6. Acceptance Criteria
- **AC1:** Nhập `dob` tính ra 17 tuổi 364 ngày → HTTP 400 "Yêu cầu đủ 18 tuổi".
- **AC2:** Tạo Profile thành công với `gender = NON_BINARY` → HTTP 201, DB được insert, `isOnboarded` vẫn `false`.
