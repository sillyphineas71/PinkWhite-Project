# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial API guidelines cho dating/social matchmaking backend | Toàn bộ file |

---

# API Guidelines — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa conventions cho toàn bộ REST API của backend. Mọi API phải tuân thủ.

---

## AG-01: API Prefix & Versioning

### AG-01-01: Global prefix
- Tất cả REST endpoints dùng prefix `/api`.
- Ví dụ: `POST /api/auth/register`, `GET /api/discovery/feed`.
- Cấu hình trong `main.ts`: `app.setGlobalPrefix('api')`.

### AG-01-02: API versioning
- **Open Question:** Có cần `/api/v1` prefix không, hay giữ `/api`?
- Hiện tại: không dùng version prefix (`/api` trực tiếp).
- Recommendation: Thêm `/api/v1` từ đầu nếu có kế hoạch public API — easier to version later.

### AG-01-03: Socket namespace
- Socket.IO namespace: `/realtime`.
- Không mix REST và Socket events.

---

## AG-02: REST Naming Conventions

### AG-02-01: Resource naming
- Dùng **noun, plural**, lowercase, kebab-case.
- Ví dụ đúng: `/matches`, `/swipes`, `/discovery/feed`, `/profile/photos`.
- Ví dụ sai: `/getMatches`, `/SwipeAction`, `/profilePhotos`.

### AG-02-02: HTTP method convention

| Method | Use case | Idempotent? |
|---|---|---|
| `GET` | Read data | Yes |
| `POST` | Create resource / action | No (generally) |
| `PUT` | Full update / replace | Yes |
| `PATCH` | Partial update | No (generally) |
| `DELETE` | Delete resource | Yes |

### AG-02-03: URL structure examples

```http
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
POST   /api/auth/verify-email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
PATCH  /api/auth/change-password
DELETE /api/auth/account

# Profile
POST   /api/profile
GET    /api/profile/me
PATCH  /api/profile/me
POST   /api/profile/photos/upload
POST   /api/profile/photos/:photoId/confirm
GET    /api/profile/photos
PUT    /api/profile/photos/order
DELETE /api/profile/photos/:photoId
PUT    /api/profile/location
GET    /api/profile/location
PATCH  /api/profile/visibility

# Discovery
GET    /api/discovery/feed
GET    /api/discovery/preferences
POST   /api/discovery/preferences
PUT    /api/discovery/preferences

# Swipe
POST   /api/swipes/like
POST   /api/swipes/pass
POST   /api/swipes/super-like
DELETE /api/swipes/last   (rewind)
GET    /api/swipes/likes-remaining
GET    /api/swipes/who-liked-me

# Match
GET    /api/matches
GET    /api/matches/:matchId
GET    /api/matches/:matchId/profile
POST   /api/matches/:matchId/unmatch

# Chat
GET    /api/chats
GET    /api/chats/:matchId/messages
POST   /api/chats/:matchId/messages
PATCH  /api/chats/:matchId/read

# Safety
POST   /api/safety/block
DELETE /api/safety/block/:targetId
GET    /api/safety/blocks
POST   /api/safety/report
```

### AG-02-04: FORBIDDEN patterns

```http
# ❌ Không có unrestricted profile lookup
GET /api/profile/:userId  → Returns full profile

# ❌ Không có verbicized route kiểu này (dùng noun + method thay thế)
POST /api/doSwipe
GET  /api/getMatches

# ❌ Không mix version conventions
GET /api/v1/matches  và  GET /api/swipes  (trong cùng app)
```

---

## AG-03: Success Response Format

### AG-03-01: Standard success response

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req-uuid-123",
    "timestamp": "2026-06-11T09:00:00.000Z"
  }
}
```

### AG-03-02: Paginated response

```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "next-cursor-string",
    "hasMore": true,
    "limit": 20
  },
  "meta": {
    "requestId": "req-uuid-123",
    "timestamp": "2026-06-11T09:00:00.000Z"
  }
}
```

### AG-03-03: Simple success (no data)

```json
{
  "success": true,
  "meta": {
    "requestId": "req-uuid-123"
  }
}
```

### AG-03-04: HTTP Status codes cho success

| Status | Use case |
|---|---|
| `200 OK` | Read, Update thành công |
| `201 Created` | Create resource thành công |
| `204 No Content` | Delete, action không có body trả về |

---

## AG-04: Error Response Format

### AG-04-01: Standard error response

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    }
  ],
  "requestId": "req-uuid-123"
}
```

### AG-04-02: Domain error response (no field details)

```json
{
  "statusCode": 409,
  "error": "SWIPE_ALREADY_PERFORMED",
  "message": "You have already swiped this user",
  "requestId": "req-uuid-123"
}
```

### AG-04-03: HTTP Status codes cho errors

| Status | Use case |
|---|---|
| `400 Bad Request` | Validation error, malformed request |
| `401 Unauthorized` | Missing/invalid auth |
| `403 Forbidden` | Auth OK nhưng không có permission |
| `404 Not Found` | Resource không tồn tại (hoặc privacy-masked) |
| `409 Conflict` | Duplicate resource, conflict state |
| `422 Unprocessable` | Semantic validation failed (e.g., age < 18) |
| `429 Too Many Requests` | Rate limit / quota exceeded |
| `500 Internal Server Error` | Unexpected server error |

### AG-04-04: Privacy-masked errors
- Khi resource không tìm thấy vì block/privacy: trả `404 Not Found`, không trả `403 Forbidden` (để tránh tiết lộ resource tồn tại).
- Khi auth fails (login wrong password/email): trả `401` với generic message.

### AG-04-05: KHÔNG expose trong production
- Stack trace
- Internal error details
- DB error messages raw
- File paths

---

## AG-05: Pagination

### AG-05-01: Cursor-based pagination (preferred)
Dùng cho:
- Discovery feed (avoid duplicate/skip issues khi data thay đổi)
- Chat messages (realtime data)
- Match list

```http
GET /api/discovery/feed?cursor=<base64-encoded-cursor>&limit=20
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6IjEyMyIsInRpbWVzdGFtcCI6IjIwMjYtMDYtMTFUMDk6MDA6MDAuMDAwWiJ9",
    "hasMore": true,
    "limit": 20
  }
}
```

Cursor encoding: Base64-encoded JSON chứa last item's `id` + `timestamp` (opaque với client).

### AG-05-02: Offset-based pagination (chỉ dùng khi phù hợp)
Dùng cho:
- Static lists (blocked users, notifications)
- Admin list pages

```http
GET /api/safety/blocks?page=1&limit=20
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### AG-05-03: Default limits
- Discovery feed: default 20, max 50.
- Chat messages: default 30, max 100.
- Match list: default 20, max 50.

---

## AG-06: Auth Cookie Convention

### AG-06-01: Cookie names
| Cookie | Purpose | TTL |
|---|---|---|
| `access_token` | Short-lived JWT | 15 phút |
| `refresh_token` | Long-lived refresh JWT | 7 ngày |

### AG-06-02: Cookie attributes (production)
```
HttpOnly: true
Secure: true
SameSite: Strict (hoặc Lax nếu cần OAuth flows)
Path: /api
Domain: <production domain>
```

### AG-06-03: Refresh endpoint
```http
POST /api/auth/refresh
Cookie: refresh_token=<token>
→ 200 OK + new Set-Cookie (new access_token + refresh_token)
```

---

## AG-07: CSRF Header Convention

**Open Question: CSRF strategy chưa chốt.**

Gợi ý nếu dùng custom header pattern:
```http
X-Requested-With: XMLHttpRequest
```
Tất cả mutation requests (POST, PUT, PATCH, DELETE) phải gửi header này.

Gợi ý nếu dùng Double Submit Cookie:
- Server set CSRF token trong non-HttpOnly cookie.
- Client gửi CSRF token trong header `X-CSRF-Token`.
- Server verify header == cookie value.

---

## AG-08: Validation Convention

### AG-08-01: DTO validation
- Tất cả input phải qua DTO validation với `class-validator`.
- `ValidationPipe` được set global: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Không cho phép unknown fields qua.

### AG-08-02: Common validation decorators
```typescript
@IsEmail()
@IsString()
@IsNotEmpty()
@IsEnum(Gender)
@IsDateString()
@Min(18)
@Max(100)
@IsLatitude()
@IsLongitude()
@MaxLength(500)
@IsArray()
@ArrayMaxSize(10)
```

### AG-08-03: Validation error response
NestJS `ValidationPipe` trả về:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than 8 characters"],
  "error": "Bad Request"
}
```

**Note:** Cần custom global exception filter để transform về format chuẩn AG-04-01.

---

## AG-09: Domain Error Code Convention

### AG-09-01: Error code format
```
<MODULE>_<ENTITY>_<CONDITION>
```

### AG-09-02: Auth error codes

| Code | Status | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Login failed (generic) |
| `EMAIL_ALREADY_REGISTERED` | 409 | Register duplicate email |
| `ACCOUNT_ACCESS_DENIED` | 403 | Account banned/suspended |
| `EMAIL_NOT_VERIFIED` | 403 | Email chưa verify |
| `TOKEN_EXPIRED` | 401 | JWT expired |
| `TOKEN_INVALID` | 401 | JWT malformed/invalid |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token không hợp lệ |
| `RESET_TOKEN_EXPIRED` | 410 | Reset password token expired |
| `RECOVERY_WINDOW_EXPIRED` | 410 | Account restore window expired |

### AG-09-03: Profile error codes

| Code | Status | Description |
|---|---|---|
| `PROFILE_ALREADY_EXISTS` | 409 | Profile đã tồn tại |
| `PROFILE_NOT_FOUND` | 404 | Profile chưa tạo |
| `AGE_BELOW_MINIMUM` | 422 | Tuổi < 18 |
| `NOT_ONBOARDED` | 403 | Chưa hoàn thành onboarding |

### AG-09-04: Swipe error codes

| Code | Status | Description |
|---|---|---|
| `CANNOT_SWIPE_SELF` | 400 | Swipe chính mình |
| `TARGET_NOT_ELIGIBLE` | 404 | Target không eligible |
| `SWIPE_ALREADY_PERFORMED` | 409 | Đã swipe target này |
| `LIKE_QUOTA_EXCEEDED` | 429 | Hết lượt like |
| `SUPER_LIKE_QUOTA_EXCEEDED` | 429 | Hết lượt super like |

### AG-09-05: Match error codes

| Code | Status | Description |
|---|---|---|
| `MATCH_NOT_FOUND` | 404 | Match không tồn tại |
| `MATCH_NOT_ACTIVE` | 403 | Match đã unmatch |

### AG-09-06: Chat error codes

| Code | Status | Description |
|---|---|---|
| `CHAT_NOT_ALLOWED` | 403 | Không được phép chat (generic) |
| `MESSAGE_NOT_FOUND` | 404 | Message không tồn tại |

### AG-09-07: Safety error codes

| Code | Status | Description |
|---|---|---|
| `CANNOT_BLOCK_SELF` | 400 | Block chính mình |
| `CANNOT_REPORT_SELF` | 400 | Report chính mình |

---

## AG-10: RequestId / Correlation ID

### AG-10-01: Request ID
- Mỗi request phải có `requestId` (UUID).
- Tạo trong interceptor hoặc middleware: `X-Request-Id` header hoặc auto-generated.
- Log phải include `requestId`.
- Error response phải include `requestId`.

### AG-10-02: Recommendation
```typescript
// Interceptor: generate requestId nếu không có trong header
const requestId = req.headers['x-request-id'] || randomUUID();
req['requestId'] = requestId;
res.setHeader('X-Request-Id', requestId);
```
