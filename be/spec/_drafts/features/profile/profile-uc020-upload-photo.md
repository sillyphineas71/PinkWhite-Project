# UC020: Tải lên ảnh đại diện

> **Revision**: v2 — Production-Grade
> - Giới hạn 9 ảnh. 5MB/ảnh.
> - Hỏi user có set Avatar (Index 0) không.
> - Hoàn tất Onboarding nếu là ảnh đầu tiên.

## 1. Context & Goal
Cốt lõi của app hẹn hò là thư viện ảnh. Việc upload ảnh được tách ra khỏi Onboarding Profile để sử dụng Pre-signed URL, giúp giảm tải trực tiếp cho Server.

## 2. Actors & Roles
- **User**: Người dùng đã tạo Profile.

## 3. Data Model Impact
- Tạo bản ghi mới trong bảng `Photo`. Cập nhật `User.isOnboarded = true` (nếu là ảnh đầu tiên).

## 4. Non-functional Requirements (NFR)
- **Direct Cloud Upload:** Hệ thống Backend chỉ cấp Pre-signed URL (Cloudinary/AWS S3). Client sẽ đẩy trực tiếp file lên Cloud.
- **Performance:** Cấp URL ≤ 50ms.
- **Limits:** Max 9 bản ghi Photo / 1 Profile. File max 5MB (Client và Cloud chặn).
- **Concurrency Risk:** Chấp nhận rủi ro nhỏ về race condition (user có thể lách luật up lên 10 ảnh nếu bắn 2 request xin URL cùng lúc ở mili-giây) để tối ưu tốc độ phản hồi API, không dùng DB Lock.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHEN user yêu cầu Upload ảnh mới, THE hệ thống SHALL đếm số lượng `Photo` hiện có.
  - IF số lượng ảnh ≥ 9, THEN hệ thống SHALL trả về HTTP 400 (Tối đa 9 ảnh).
  - THE hệ thống SHALL cấp 1 Pre-signed URL (kèm Token sống trong 5 phút). Quá trình generate URL này SHALL cấu hình cứng (Strict Policy) ở phía Cloud S3 chỉ chấp nhận định dạng `image/jpeg`, `image/png` và giới hạn dung lượng file tối đa `5MB`.
  - Sau khi upload lên Cloud xong, WHEN Client gọi API Confirm `(url, isAvatar)`, THE hệ thống SHALL lưu vào DB với `order = max(order) + 1`.
  - IF `isAvatar = true`, THEN hệ thống SHALL set ảnh này thành `order = 0` (đẩy các ảnh khác lùi lại) và set cờ `isAvatar = true`.
  - IF đây là bức ảnh đầu tiên (trước đó đếm = 0), THEN hệ thống SHALL tự động set `User.isOnboarded = true` (Chốt luồng Onboarding Bước 2).

## 6. Acceptance Criteria
- **AC1:** User đã có 9 ảnh, xin URL upload ảnh 10 → HTTP 400.
- **AC2:** User mới tinh chưa có ảnh (isOnboarded=false) confirm upload ảnh đầu tiên → DB tạo Photo, `isOnboarded` chuyển thành `true`.
