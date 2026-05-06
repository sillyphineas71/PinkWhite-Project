# Backend - Social Matchmaking Platform

NestJS backend cho Social Matchmaking Platform.

## Stack

- NestJS + TypeScript
- Prisma + PostgreSQL
- Redis
- Socket.IO
- Swagger
- Firebase Cloud Messaging placeholder

## Spec Flow

Backend spec nằm trong `spec/`.

- Feature spec: `spec/features/`
- Module spec: `spec/modules/`
- Quy ước chung: `spec/global/`
- Agent instruction: `AGENTS.md`

Không implement feature backend khi chưa có spec hoặc yêu cầu rõ.

## Local Commands

```bash
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
```

Từ root có thể bật PostgreSQL và Redis:

```bash
npm run db:up
```

## Runtime URLs

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/docs`
- Socket namespace: `http://localhost:3000/realtime`
