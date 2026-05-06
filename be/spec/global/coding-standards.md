# Coding Standards

- Backend dùng NestJS + TypeScript.
- Module phải tách rõ controller, service, DTO, gateway nếu có realtime.
- DTO phải validate bằng `class-validator`.
- Không đặt business logic quan trọng trong controller.
- Không hardcode secret hoặc credential.
- Prisma là data access layer chính.

