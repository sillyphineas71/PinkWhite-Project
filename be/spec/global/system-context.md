# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial system context diagram và core domain flows | Toàn bộ file |

---

# System Context — Dating / Social Matchmaking Platform

Tài liệu này mô tả kiến trúc hệ thống ở mức high-level: các actor, external systems, và luồng domain chính.

---

## SC-01: C4-Style Context Diagram

```mermaid
flowchart LR
  User["Web User\n(Dating App)"]
  Admin["Admin / Moderator"]
  FE["Frontend Web App\n(React + Vite)"]
  BE["NestJS Backend API\n(REST + WebSocket)"]
  DB[("PostgreSQL\n(via Prisma)")]
  Redis[("Redis\n(Session / Presence / Cache)")]
  Storage[("Object Storage\n(S3 / Cloudinary / Local)")]
  Email["Email Provider\n(Nodemailer / SMTP)"]
  Push["Push Notification\n(Future Scope)"]
  OAuth["Google OAuth\n(id_token verify)"]
  Socket["Socket.IO Gateway\n(/realtime namespace)"]

  User --> FE
  Admin --> FE
  FE -->|"REST /api/*"| BE
  FE -->|"WebSocket"| Socket
  Socket -->|"auth + rooms"| BE
  BE --> DB
  BE --> Redis
  BE --> Storage
  BE --> Email
  BE --> Push
  BE --> OAuth
  BE -->|"emit events"| Socket
```

**Ghi chú trạng thái hiện tại (2026-06-11):**
- `PostgreSQL` → Chưa connected production. `prisma/schema.prisma` chưa có model.
- `Redis` → Đã setup nhưng chưa fully integrated (session/presence chưa dùng).
- `Storage` → Chưa implement, không có module.
- `Email` → Đã có Nodemailer config, dùng trong auth flows.
- `Push` → Placeholder, luôn throw Error.
- `OAuth` → Đã implement Google OAuth server-side verify.
- `Socket` → Placeholder gateway, chưa có auth, chỉ có ping/pong.

---

## SC-02: Core Domain Flow

```mermaid
flowchart TD
  Register["Đăng ký / Đăng nhập\n(Email + Password\nhoặc Google OAuth)"]
  Verify["Xác thực Email\n(Gửi verification link)"]
  Onboarding["Hoàn thành Onboarding\n(Name + DOB + Gender)"]
  Photo["Upload ảnh\n& chờ Approved"]
  Location["Cài đặt\nActive Location"]
  Preferences["Set Discovery\nPreferences"]
  Feed["Nhận Discovery Feed\n(Filtered candidates)"]
  Swipe["Swipe\nLike / Pass / Super Like"]
  Mutual{"Mutual Like?"}
  Match["Tạo Match\n(idempotent)"]
  Chat["Chat\n(active match only)"]
  Safety["Unmatch / Block / Report"]

  Register --> Verify
  Verify --> Onboarding
  Onboarding --> Photo
  Photo --> Location
  Location --> Preferences
  Preferences --> Feed
  Feed --> Swipe
  Swipe --> Mutual
  Mutual -->|"Có (Yes)"| Match
  Mutual -->|"Không (No)"| Feed
  Match --> Chat
  Chat --> Safety
  Safety -->|"Unmatch → ẩn chat"| Feed
  Safety -->|"Block → mutual invisible"| Feed
```

---

## SC-03: Event-Driven Match Target Architecture

Đây là **target architecture** cho production. Hiện tại chưa được implement (dùng direct service call).

```mermaid
sequenceDiagram
  participant Client
  participant API as Swipe API
  participant DB as PostgreSQL
  participant Outbox as Outbox / Event Store
  participant Worker as Match Processor
  participant Notify as Notification / Realtime

  Client->>API: POST /api/swipes/like
  API->>DB: Begin transaction
  API->>DB: Create swipe record
  API->>Outbox: Create SWIPE_CREATED event
  API->>DB: Commit transaction
  API-->>Client: 201 Created (swipe accepted)
  
  Note over Worker: Async processing
  Worker->>Outbox: Consume SWIPE_CREATED event
  Worker->>DB: Check mutual like (target đã like requester chưa?)
  alt Mutual like exists
    Worker->>DB: Create match (idempotent - skip if exists)
    Worker->>Notify: Emit MATCH_CREATED event
    Notify-->>Client: Socket event: match:new
    Notify->>Notify: Create in-app notification (async)
    Note over Notify: Push/FCM/APNs are future/out of scope for phase 1.
  else No mutual like
    Worker->>Outbox: Mark event processed (no match)
  end
```

**Trạng thái hiện tại:** In-memory mock, không có outbox, không có worker. Match được check và tạo trực tiếp trong service call sau khi swipe.

---

## SC-04: Auth Flow

```mermaid
sequenceDiagram
  participant Client
  participant API as Auth API
  participant Redis
  participant DB as PostgreSQL
  participant Email as Email Provider

  Client->>API: POST /api/auth/register
  API->>DB: Check email unique
  API->>API: Hash password (bcrypt)
  API->>DB: Create user record
  API->>Email: Send verification email
  API-->>Client: 201 Created (user created)

  Client->>API: POST /api/auth/login
  API->>DB: Find user by email
  API->>API: Verify password hash
  API->>API: Check account status (active?)
  API->>API: Generate access_token (15m)
  API->>API: Generate refresh_token (7d)
  API->>Redis: Store refresh token session
  API-->>Client: 200 OK + Set-Cookie (HTTP-only)

  Note over Client,API: Subsequent requests
  Client->>API: GET /api/auth/me (with cookie)
  API->>API: Verify JWT from cookie
  API->>API: Check account status
  API-->>Client: 200 OK + user data

  Note over Client,API: Token refresh
  Client->>API: POST /api/auth/refresh (with refresh cookie)
  API->>Redis: Validate refresh token
  API->>Redis: Revoke old refresh token
  API->>API: Generate new token pair
  API->>Redis: Store new refresh token
  API-->>Client: 200 OK + Set-Cookie (new tokens)
```

---

## SC-05: Discovery & Swipe Flow

```mermaid
sequenceDiagram
  participant Client
  participant DiscoveryAPI as Discovery API
  participant SwipeAPI as Swipe API
  participant DB as PostgreSQL

  Client->>DiscoveryAPI: GET /api/discovery/feed
  DiscoveryAPI->>DB: Query eligible candidates
  Note over DiscoveryAPI,DB: Filter: active, onboarded, verified,\nnot hidden, not blocked, not swiped,\nfits preference, not self
  DiscoveryAPI->>DiscoveryAPI: Calculate distances
  DiscoveryAPI->>DiscoveryAPI: Mask exact location → distance label
  DiscoveryAPI-->>Client: List of limited profiles (age, not dob)

  Client->>SwipeAPI: POST /api/swipes/like {targetId}
  SwipeAPI->>SwipeAPI: Check requester eligible
  SwipeAPI->>DB: Check target eligible
  SwipeAPI->>DB: Check not already swiped (idempotency)
  SwipeAPI->>DB: Check quota (likes remaining)
  SwipeAPI->>DB: Create swipe record
  SwipeAPI->>DB: Check mutual like
  alt Mutual like
    SwipeAPI->>DB: Create match (idempotent)
    SwipeAPI-->>Client: 201 + {matched: true, matchId}
  else No mutual
    SwipeAPI-->>Client: 201 + {matched: false}
  end
```

---

## SC-06: Chat Permission Flow

```mermaid
flowchart TD
  SendMessage["Client: Send Message\nPOST /api/chats/:matchId/messages"]
  AuthCheck["Auth check\nJWT valid?"]
  AccountCheck["Account status check\nactive?"]
  MatchCheck["Match exists?\n(matchId valid)"]
  ParticipantCheck["Requester is participant\nof this match?"]
  ActiveCheck["Match is active?\n(not unmatched)"]
  BlockCheck["Block exists\nbetween pair?"]
  StoreMessage["Store message\nin DB"]
  EmitRealtime["Emit via Socket.IO\nto match room"]

  SendMessage --> AuthCheck
  AuthCheck -->|"No"| Err401["401 Unauthorized"]
  AuthCheck -->|"Yes"| AccountCheck
  AccountCheck -->|"No"| Err403["403 Forbidden"]
  AccountCheck -->|"Yes"| MatchCheck
  MatchCheck -->|"No"| Err404["404 Not Found"]
  MatchCheck -->|"Yes"| ParticipantCheck
  ParticipantCheck -->|"No"| Err403
  ParticipantCheck -->|"Yes"| ActiveCheck
  ActiveCheck -->|"Unmatched"| Err403Chat["403 Chat no longer available"]
  ActiveCheck -->|"Active"| BlockCheck
  BlockCheck -->|"Blocked"| Err403Chat
  BlockCheck -->|"No block"| StoreMessage
  StoreMessage --> EmitRealtime
```

---

## SC-07: Runtime URLs

| URL | Mô tả |
|---|---|
| `http://localhost:3000/api` | REST API base |
| `http://localhost:3000/api/health` | Health check endpoint |
| `http://localhost:3000/docs` | Swagger UI |
| `http://localhost:3000/realtime` | Socket.IO namespace |

---

## SC-08: Deployment Target (Future)

Đây là target deployment architecture — **chưa implement, ghi để định hướng**:

```mermaid
flowchart LR
  CDN["CDN\n(Static FE)"]
  LB["Load Balancer"]
  API1["NestJS API\nInstance 1"]
  API2["NestJS API\nInstance 2"]
  Redis["Redis Cluster\n(Session + Socket adapter)"]
  PG["PostgreSQL\n(Primary + Replica)"]
  S3["Object Storage\n(S3)"]

  CDN --> LB
  LB --> API1
  LB --> API2
  API1 --> Redis
  API2 --> Redis
  API1 --> PG
  API2 --> PG
  API1 --> S3
  API2 --> S3
```

**Notes:**
- Socket.IO scaling cần Redis adapter khi chạy nhiều instances.
- Redis session phải shared giữa all instances.
- PostgreSQL replica cho read queries (discovery feed) — Future Improvement.
