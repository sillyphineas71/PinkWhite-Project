# CLAUDE.md - Dự án Tinder Web Clone v1.0

## TL;DR (Đọc trước - 60 giây)
> Đây là hệ thống nền tảng Social Matchmaking (Dating) mô phỏng các tính năng cốt lõi của Tinder.
> Backend: NestJS + Prisma ORM + PostgreSQL + Redis.
> Frontend: React (Vite) + Tailwind CSS + shadcn/ui.
> Realtime/Event-driven: Socket.IO cho Chat và Notifications.
> Phương pháp phát triển: Spec-Driven Development (SDD).

## KIẾN TRÚC HỆ THỐNG

### Các Module/Service chính (Backend):
| Module | Trách nhiệm |
|---|---|
| AuthModule | Xử lý Đăng ký/Đăng nhập, xác thực JWT, quản lý phiên làm việc. |
| UserModule | Quản lý User Profile, Bio, Upload ảnh Avatar/Gallery. |
| DiscoveryModule| Gợi ý danh sách người dùng tiềm năng dựa trên Preference. |
| SwipeModule | Xử lý logic Quẹt (Like/Pass), ghi nhận tương tác. |
| MatchModule | Lưu trữ cặp đôi Match, cấp quyền mở khóa Chat. |
| ChatModule | Xử lý gửi/nhận tin nhắn Realtime qua Socket.IO. |

### Flow xử lý Match cơ bản:
User A -> Gọi API `SwipeModule` (Like User B) -> Ghi nhận vào DB.
-> Hệ thống check "B đã like A chưa?".
- Nếu CÓ: Tạo bản ghi `Match` -> Gửi sự kiện Socket (MatchEvent) cho cả A và B.
- Nếu KHÔNG: Chỉ lưu trạng thái Like một chiều.

## QUYẾT ĐỊNH KIẾN TRÚC QUAN TRỌNG (ADR)

### ADR-001: Sử dụng Prisma thay vì TypeORM
- **Lý do:** Prisma cung cấp Type-safety hoàn hảo, migration dễ quản lý, cực kỳ phù hợp với hệ sinh thái TypeScript của NestJS trong các dự án cần tốc độ phát triển nhanh.
- **Trade-off:** Khó viết các câu raw SQL cực kỳ phức tạp (dù hiếm gặp trong app dating cơ bản).

### ADR-002: Bắt buộc dùng Repository Pattern
- **Lý do:** Giúp tách biệt hoàn toàn Logic Nghiệp Vụ (Service) khỏi Logic Truy Xuất Dữ Liệu (ORM). Giúp dễ viết Unit Test và dễ bảo trì.
- **Quy định:** `Controller` -> `Service` -> `Repository` -> `Prisma`. Service KHÔNG được import Prisma trực tiếp.

### ADR-003: Dùng Redis cho Realtime State
- **Lý do:** Để biết user nào đang online và đang kết nối tới Socket server nào (chuẩn bị cho scale nhiều instance).

### ADR-004: Lưu trữ JWT Token bằng HTTP-only Cookie
- **Lý do:** Tăng cường tối đa tính bảo mật, ngăn chặn tấn công XSS (Cross-Site Scripting) không cho phép mã độc JavaScript ở Client đọc được token.
- **Trade-off:** Cần cấu hình CORS (`credentials: true`) kỹ lưỡng giữa Frontend và Backend.

## PATTERNS ĐƯỢC SỬ DỤNG

### Error Handling Pattern
- **Backend:** Xử lý lỗi tập trung bằng `Global Exception Filter` của NestJS. Trả về cấu trúc thống nhất:
  ```json
  {
    "statusCode": 400,
    "message": ["email must be an email"],
    "error": "Bad Request"
  }
  ```
- **Frontend:** Dùng Interceptor của Axios để bắt mã lỗi 401 (hết hạn token) -> Tự động gọi refresh token hoặc đá văng ra trang Login. Hiển thị lỗi qua Toast notification.

## FILE STRUCTURE QUAN TRỌNG

### Thư mục Backend (`/be`)
```text
/be/src
  /common       # Guards, Interceptors, Filters, Utils dùng chung toàn cục
  /modules      # Các feature modules (chia theo Domain Driven Design)
    /auth
      /controllers
      /services
      /repositories
      /dto
/be/spec        # Nơi chứa các tài liệu Spec theo chuẩn SDD (Cốt lõi)
/be/prisma      # Chứa schema.prisma và lịch sử migrations
```

### Thư mục Frontend (`/fe`)
```text
/fe/src
  /components   # UI Components dùng chung (shadcn/ui, buttons, inputs)
  /features     # Gói gọn logic/UI theo từng tính năng (Auth, Swipe, Chat)
  /hooks        # Custom React hooks (useAuth, useSocket)
  /services     # File gọi API (Axios config)
  /store        # Global state (Zustand)
```

## NHỮNG GÌ ĐÃ KHÔNG HOẠT ĐỘNG (Lessons Learned)
*(Mục này sẽ được cập nhật liên tục trong quá trình chúng ta code và nhận ra các sai lầm/bottleneck để tránh lặp lại)*
- [YYYY-MM] Chưa có dữ liệu.
