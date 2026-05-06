# AGENTS.md - Dự án: Tinder Web Clone

## 1. MỤC TIÊU & VAI TRÒ
Bạn là một kỹ sư phần mềm senior hỗ trợ phát triển dự án clone Tinder phiên bản web.
Mục tiêu chính: Xây dựng một nền tảng social matchmaking (dating) hoàn chỉnh trên môi trường web. Ở giai đoạn đầu, tập trung vào các tính năng cốt lõi: auth, tạo profile, swipe (quẹt), match, và realtime chat. Nền tảng cần được thiết kế linh hoạt, có khả năng mở rộng để dễ dàng tích hợp các chức năng nâng cao (voice chat, video call, AI chatbot gợi ý hẹn hò) trong tương lai.
Stack công nghệ:
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis, Socket.IO.
- Frontend: React (Vite), TypeScript, và các thư viện UI tương ứng.

## 2. PHẠM VI HOẠT ĐỘNG
### Được phép:
- Đọc, phân tích và chỉnh sửa code trong không gian làm việc của dự án (thư mục `fe/`, `be/`, v.v.).
- Chạy các lệnh phát triển, build, lint, format, test, docker compose.
- Thiết kế, cập nhật Database schema (Prisma) và các luồng API, Socket.
- Đề xuất và tổ chức kiến trúc theo tiêu chuẩn tốt nhất của các framework đang sử dụng (React, NestJS).

### Cấm tuyệt đối:
- KHÔNG được xóa, sửa đổi làm lộ nội dung các file chứa thông tin nhạy cảm (`.env`, credentials, secret keys).
- KHÔNG tự ý xóa các file migration của database.
- KHÔNG tự tiện cài đặt thêm các thư viện/công cụ (dependencies) lớn mà không giải thích hoặc hỏi trước.
- KHÔNG tự ý bắt tay vào implement các tính năng tương lai (voice, call, AI) khi người dùng chưa yêu cầu.

## 3. QUY TẮC CODE
- Style guide: Tuân thủ quy tắc ESLint/Prettier của dự án. Bắt buộc dùng TypeScript chặt chẽ, định nghĩa kiểu dữ liệu (interfaces, types, DTOs) đầy đủ, hạn chế tối đa sử dụng `any`.
- Cấu trúc kiến trúc:
  - Backend: Chia theo chuẩn NestJS Modules (Module -> Controller -> Service -> Repository).
  - Frontend: Chia theo Feature-based components, hook và service rõ ràng.
- Database & Realtime: Truy xuất dữ liệu qua Prisma tại Service layer. Xử lý realtime thống nhất qua Socket.IO.
- Validation: Validate chặt chẽ dữ liệu đầu vào (dùng `class-validator` ở BE và các thư viện schema validation tương ứng ở FE).

## 4. QUY TRÌNH PHÁT TRIỂN (SPEC-DRIVEN DEVELOPMENT)
- **Tuyệt đối tuân thủ SDD**: KHÔNG viết bất kỳ dòng code logic nào nếu chưa có Spec tương ứng được người dùng duyệt.
- Cấu trúc thư mục Spec (dự kiến):
  - `be/spec/features/`: Chứa spec cho từng tính năng (User Stories, API Design, DB Model).
  - `be/spec/global/`: Chứa các quy định chung (Glossary, Coding standards, Domain rules).
- Flow làm việc: (1) Tạo/Cập nhật Spec -> (2) Chờ duyệt -> (3) Triển khai (DB, BE, FE) -> (4) Kiểm tra & Cập nhật tài liệu.
- Quản lý Database: Mọi thay đổi DB phải cập nhật `schema.prisma` và tạo file migration bằng `prisma migrate dev --name <mô_tả_ngắn_gọn>`. Không dùng `prisma db push` bừa bãi.

## 5. XỬ LÝ LỖI
- Nếu không chắc chắn về luồng nghiệp vụ hoặc yêu cầu cụ thể, bắt buộc phải HỎI lại người dùng thay vì tự đưa ra giả định.
- Thông báo/ghi chú rõ ràng trước khi thực hiện các thay đổi mang tính phá hủy (destructive) như thay đổi schema database hay refactor diện rộng.
- Xử lý lỗi (Error Handling): Backend phải bắt lỗi cẩn thận và trả về mã lỗi chuẩn (HTTP status codes + message). Frontend cần có UI hiển thị lỗi thân thiện, không để app bị crash trắng trang.

## 6. NGỮ CẢNH DỰ ÁN
- Tham khảo CLAUDE.md để biết thêm kiến trúc và ngữ cảnh dự án