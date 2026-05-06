# System Architecture

Backend hiện tại:

- NestJS app expose REST API dưới `/api`.
- Swagger docs ở `/docs`.
- Socket.IO namespace `/realtime`.
- PostgreSQL qua Prisma.
- Redis dùng cho cache/session/presence sau này.
- Firebase notification hiện là placeholder service.

Luồng domain chính:

```text
Account -> Profile -> Preference -> Discovery -> Swipe -> Match -> Chat -> Safety/Notification
```

