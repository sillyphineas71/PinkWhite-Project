# Danh sách Use Cases - Tinder Web Clone

Dưới đây là danh sách tổng hợp khoảng 90+ Use Cases cho một hệ thống Dating App quy mô lớn. Danh sách này bao phủ từ các tính năng cơ bản (Core) cho đến các tính năng Nâng cao (Premium/Monetization) và Admin. Mỗi Use Case này có thể trở thành một file Spec độc lập (hoặc gom nhóm các Use Case liên quan vào chung 1 file Spec).

## 1. Authentication & Authorization (Auth)
*Đã có spec cơ bản, nhưng cần mở rộng cho hệ thống lớn*
- **UC001**: Đăng ký tài khoản bằng Email & Password (`auth-register.md`)
- **UC002**: Đăng nhập bằng Email & Password (`auth-login.md`)
- **UC003**: Đăng xuất khỏi thiết bị hiện tại (`auth-login.md`)
- **UC004**: Lấy thông tin user hiện tại (Get `/me`) (`auth-login.md`)
- **UC005**: Xác thực Email (Gửi OTP / Verification Link)
- **UC006**: Yêu cầu khôi phục mật khẩu (Forgot Password)
- **UC007**: Thực thi khôi phục mật khẩu (Reset Password)
- **UC008**: Thay đổi mật khẩu khi đang đăng nhập (Change Password)
- **UC009**: Đăng ký / Đăng nhập bằng Google OAuth (`auth/auth-uc009-google-oauth.md`)
- ~~**UC010**: Facebook OAuth~~ (Đã loại khỏi scope)
- ~~**UC011**: Apple ID~~ (Đã loại khỏi scope)
- **UC012**: Xóa tài khoản (Soft Delete)
- **UC013**: Khôi phục tài khoản đã xóa (Undo Soft Delete trong 30 ngày)
- **UC014**: Xin cấp lại Access Token (Refresh Token)
- **UC015**: Đăng xuất khỏi TẤT CẢ thiết bị (Force Logout All)

## 2. User Profile & Onboarding
*Quản lý hồ sơ người dùng, các thông tin định danh và giới thiệu bản thân*
- **UC016**: Tạo thông tin cá nhân cơ bản (Tên, Tuổi, Giới tính) lúc Onboarding
- **UC017**: Đọc thông tin cá nhân cơ bản
- **UC018**: Cập nhật thông tin cá nhân cơ bản
- **UC019**: Xóa thông tin cá nhân cơ bản (chuyển về mặc định)
- **UC020**: Tải lên ảnh đại diện (Upload tới S3/Cloudinary)
- **UC021**: Đọc danh sách ảnh đại diện (Gallery)
- **UC022**: Cập nhật thứ tự hiển thị của ảnh đại diện
- **UC023**: Xóa ảnh đại diện
- **UC024**: Cập nhật Bio (Giới thiệu bản thân) và Sở thích (Interests)
- **UC025**: Đọc Bio và Sở thích
- **UC026**: Cập nhật vị trí hiện tại (GPS Coordinates)
- **UC027**: Đọc vị trí hiện tại
- **UC028**: Cập nhật vị trí tùy chỉnh (Tính năng Passport - Premium)
- **UC029**: Gửi yêu cầu xác thực khuôn mặt (KYC - Upload Selfie)
- **UC030**: Đọc trạng thái xác thực khuôn mặt (Verified Blue Tick)
- **UC031**: Cập nhật thông tin Học vấn / Nghề nghiệp
- **UC032**: Đọc thông tin Học vấn / Nghề nghiệp
- **UC033**: Cập nhật Lifestyle (Hút thuốc, Uống rượu, Thú cưng...)
- **UC034**: Đọc Lifestyle
- **UC035**: Block một người dùng khác (Ngăn không cho xuất hiện)
- **UC036**: Đọc danh sách người dùng đã Block
- **UC037**: Unblock người dùng
- **UC038**: Report (Báo cáo) một người dùng (Fake, Spam, Lừa đảo)

## 3. Discovery & Preferences (Feed)
*Bộ máy lọc và gợi ý người dùng tiềm năng*
- **UC039**: Tạo/Thiết lập Preferences (Khoảng tuổi, Giới tính quan tâm, Khoảng cách tối đa)
- **UC040**: Đọc Preferences hiện tại
- **UC041**: Cập nhật Preferences
- **UC042**: Lấy danh sách Feed (Query những user phù hợp preference, chưa từng quẹt, tính khoảng cách)
- **UC043**: Làm mới Feed (Kéo để tải thêm user tiềm năng)
- **UC044**: Áp dụng Advanced Filters (Lọc theo Chiều cao, Học vấn, Chỉ người đã verify - Premium)
- **UC045**: Bật/Tắt chế độ Ẩn danh (Hide my profile)
- **UC046**: Đọc trạng thái Ẩn danh hiện tại

## 4. Swipe Action & Interaction
*Hành động cốt lõi của ứng dụng Dating*
- **UC047**: Quẹt phải (Like một người dùng)
- **UC048**: Quẹt trái (Pass một người dùng)
- **UC049**: Vuốt lên (Super Like một người dùng)
- **UC050**: Rewind (Hoàn tác lượt quẹt trái cuối cùng - Premium)
- **UC051**: Đính kèm lời nhắn khi Super Like (Tính năng Platinum)
- **UC052**: Kiểm tra số lượt Like còn lại (Free tier limit)
- **UC053**: Kiểm tra số lượt Super Like còn lại
- **UC054**: Xem danh sách "Who Liked Me" (Những người đã quẹt phải mình - Premium Gold)
- **UC055**: Đọc lịch sử các lượt đã Pass (Để sau này có thể Rewind)

## 5. Match System
*Hệ thống tương hợp khi cả 2 cùng Like*
- **UC056**: Kích hoạt Match (Hệ thống tự động chạy khi có Mutual Like)
- **UC057**: Đọc danh sách các lượt Match hiện có
- **UC058**: Xem chi tiết Profile của một Match
- **UC059**: Tìm kiếm Match theo Tên
- **UC060**: Hủy Tương hợp (Unmatch)
- **UC061**: Khôi phục Hủy Tương hợp (Rematch - Premium)
- **UC062**: Cập nhật trạng thái Match (Đã đọc, Chưa đọc tin nhắn)

## 6. Realtime Chat & Messaging
*Trò chuyện qua Socket.IO*
- **UC063**: Gửi tin nhắn Text
- **UC064**: Lấy lịch sử tin nhắn của một Match (Phân trang / Cursor)
- **UC065**: Cập nhật trạng thái tin nhắn (Đã nhận, Đã xem - Read Receipts)
- **UC066**: Thu hồi tin nhắn (Unsend)
- **UC067**: Gửi tin nhắn Hình ảnh / GIF
- **UC068**: Gửi tin nhắn Voice (Ghi âm)
- **UC069**: Thả cảm xúc (React / Heart) vào một tin nhắn
- **UC070**: Gọi Audio Call (WebRTC qua Socket signaling)
- **UC071**: Gọi Video Call
- **UC072**: Xem danh sách các cuộc trò chuyện gần đây (Inbox Snippet)

## 7. Monetization & Premium (In-App Purchases)
*Gói cước và vật phẩm*
- **UC073**: Mua gói Subscription (Tinder Plus/Gold/Platinum qua Stripe/Apple/Google)
- **UC074**: Đọc thông tin Gói cước hiện tại và Ngày hết hạn
- **UC075**: Nâng cấp Gói cước (Từ Plus lên Gold)
- **UC076**: Hủy gia hạn Gói cước
- **UC077**: Mua gói vật phẩm tiêu hao (Boosts)
- **UC078**: Mua gói vật phẩm tiêu hao (Super Likes)
- **UC079**: Kích hoạt Boost (Tăng hiển thị profile x10 lần trong 30 phút)
- **UC080**: Đọc trạng thái Boost và thời gian còn lại
- **UC081**: Đọc số lượng Boost / Super Like còn trong kho

## 8. Notifications & System Settings
*Thông báo đẩy và cài đặt app*
- **UC082**: Đăng ký Device Token (FCM/APNs) để nhận Push Notification
- **UC083**: Đọc cài đặt thông báo (Push, Email)
- **UC084**: Cập nhật cài đặt thông báo (Tắt thông báo tin nhắn, Bật thông báo Match)
- **UC085**: Lấy danh sách In-App Notifications
- **UC086**: Đánh dấu Notification đã đọc
- **UC087**: Xóa Notification

## 9. Admin / Backoffice (Internal Tools)
*Hệ thống quản trị*
- **UC088**: Tìm kiếm và Đọc danh sách User (Admin)
- **UC089**: Khóa (Ban) / Tạm ngưng (Suspend) User (Kích hoạt Rule HTTP 403 khi login)
- **UC090**: Đọc danh sách các User bị Report
- **UC091**: Xử lý Report (Đánh dấu đã giải quyết, cảnh cáo user)
- **UC092**: Duyệt yêu cầu KYC / Verify khuôn mặt bằng tay
- **UC093**: Đọc Dashboard Analytics (Tổng user, Số lượt Match, Doanh thu)
- **UC094**: Gửi tin nhắn hệ thống (Broadcast Announcement) tới toàn bộ User
