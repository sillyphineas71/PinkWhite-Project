# Social Matchmaking Platform

Spec-driven full-stack dating platform foundation.

## Stack

- FE: React, Vite, TypeScript, React Router, TanStack Query, Socket.IO client.
- BE: NestJS, Prisma, PostgreSQL, Redis, Socket.IO, Swagger, Firebase notification placeholder.
- Infra local: Docker Compose for PostgreSQL and Redis.

## Local Run

```bash
npm install
npm run db:up
npm run db:generate
npm run dev
```

FE: http://localhost:5173

API: http://localhost:3000/api/health

Swagger: http://localhost:3000/docs

Socket namespace: http://localhost:3000/realtime

## Spec Flow

Backend specs live in `be/spec/`. Frontend specs are intentionally deferred.

Start with `be/spec/features/`, then update the related module docs in `be/spec/modules/` before implementation.
