# Auth Module

Trạng thái: draft.

NestJS structure dự kiến:

- `AuthModule`
- `AuthController`
- `AuthService`
- DTO cho register/login/refresh.
- Guard/strategy cho private route.

Dependency dự kiến:

- PrismaService.
- ConfigService.
- Token/session service.
