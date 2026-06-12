# Social Matchmaking Platform API

> **A robust, production-oriented/spec-driven backend project for a modern Dating and Social Matchmaking platform.**

This project implements the core backend infrastructure required to power a high-scale dating application (similar to Tinder, Bumble, or Hinge). It is built with a strong emphasis on specification-driven development, data consistency, privacy by design, and scalable architecture.

## 🌟 Why This Project is Interesting
Building a dating platform backend presents unique engineering challenges. This project addresses them through:
- **Specification-First Development**: Every module, use case, and database table is meticulously documented before a single line of code is written.
- **Privacy & Safety by Design**: Built-in mechanisms to ensure user privacy (e.g., hiding exact coordinates, blurring photos) and safety (e.g., blocking, reporting).
- **Production-Oriented Database Design**: Utilizing PostgreSQL with PostGIS for high-performance geospatial queries, partial unique constraints, and robust business logic embedded in check constraints.
- **Event-Driven Architecture Readiness**: Implementation of the Outbox pattern (`outbox_events`) to reliably decouple matching and notification logic.

## 🛠 Tech Stack
- **Framework:** NestJS v11 (TypeScript)
- **Database:** PostgreSQL + PostGIS Extension
- **ORM:** Prisma v6 (with UUIDv7 strategy)
- **Realtime:** Socket.IO v4 (for live chat and typing indicators)
- **Authentication:** Cookie-based JWT (Access + Refresh tokens)
- **Caching/Session:** Redis (ioredis)
- **Testing:** Jest + Supertest

## 🏛 Architecture Highlights
- **Domain-Driven Module Boundaries:** Clean separation of concerns between `auth`, `profile`, `discovery`, `swipe`, `match`, `chat`, and `safety`.
- **Geospatial Discovery:** Leveraging PostGIS `geography(Point,4326)` and GIST indexes for efficient radius-based discovery feeds.
- **Idempotent Match Engine:** Safe, atomic matching processes triggered by mutual swipe events.
- **Scalable Chat:** Persistent messaging integrated seamlessly with Socket.IO for real-time delivery.

## 📊 Current Status
- **Database Status:** ✅ **Ready**. The database schema is fully baseline-approved with **21 domain models** and applied to the local environment (`match_dev`). It includes advanced raw SQL integrations (PostGIS, partial indexes, and check constraints).
- **Implementation Status:** 🚧 **In Progress**. The database and migrations are locally ready. The repository layer is currently transitioning from in-memory mocks to Prisma ORM. Runtime persistence refactor is next.

### Implemented vs Planned
| Feature | Status | Notes |
|---------|--------|-------|
| **Database Schema** | ✅ Completed | Fully migrated local DB with PostGIS |
| **Auth & Security** | ✅ Persistence Done | Postgres-backed auth and profile |
| **Discovery & Swiping** | 🚧 Planned | Awaiting Prisma integration |
| **Matching Engine** | ✅ Persistence Done | Postgres-backed match creation |
| **Realtime Chat** | 🚧 Persistence Done | Postgres-backed messaging, NO realtime sockets yet |
| **Payments/Monetization**| ⏳ Planned | VNPAY prepaid schema ready |

*Note: Features like video/voice calls, live streaming, and recurring billing via Stripe/Apple IAP are explicitly out of scope for Phase 1.*

## 🚀 Local Setup

### 1. Prerequisites
- Node.js (v20+)
- PostgreSQL (v15+) with **PostGIS extension** installed
- Redis server
- Yarn or npm

### 2. Environment Configuration
Copy the sanitized environment template:
```bash
cp .env.example .env
```
Update `.env` with your local database credentials and JWT secrets.

### 3. Database Initialization
Generate the Prisma client and apply the migrations to your local database:
```bash
npm install
npm run db:generate
npm run db:migrate
```

### 4. Running the Application
```bash
# Watch mode for development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## 💻 Useful Commands
- `npm run db:generate`: Generate Prisma client
- `npm run db:migrate`: Run database migrations
- `npm run db:studio`: Open Prisma Studio to view data
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm run test`: Run unit tests
- `npm run test:e2e`: Run end-to-end tests

## 📚 Documentation Map
This repository is heavily spec-driven. Dive into the documentation to understand the engineering decisions:
- [CLAUDE.md](./CLAUDE.md): Agent rules and technical boundaries.
- [AGENTS.md](./AGENTS.md): Strict guidelines for automated assistants.
- [spec/global/business-rules.md](./spec/global/business-rules.md): Core dating rules (quotas, matching, recycling).
- [spec/global/privacy-rules.md](./spec/global/privacy-rules.md): Data visibility and exposure restrictions.
- [spec/global/open-questions.md](./spec/global/open-questions.md): Tracking technical decisions and future scope.
- [spec/database/DATABASE_SOURCE_OF_TRUTH.md](./spec/database/DATABASE_SOURCE_OF_TRUTH.md): Detailed explanation of the 21-table architecture.
- [spec/use-cases/USE_CASE_CATALOG.md](./spec/use-cases/USE_CASE_CATALOG.md): Complete index of all system features and their current statuses.
