# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial error handling spec cho dating/social matchmaking backend | Toàn bộ file |

---

# Error Handling — Dating / Social Matchmaking Platform

---

## EH-01: Global Exception Filter

### EH-01-01: Yêu cầu
- Backend phải có Global Exception Filter bắt tất cả unhandled exceptions.
- Filter phải transform exceptions thành standard error response format.
- Production: không expose stack trace.
- Development: có thể log stack trace internally.

### EH-01-02: Error response format chuẩn

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
  "requestId": "req-uuid-123",
  "timestamp": "2026-06-11T09:00:00.000Z"
}
```

### EH-01-03: Known Implementation Gap
- **Cần verify:** Global exception filter có tồn tại không? Format response có đúng chuẩn không?
- `main.ts` có `ValidationPipe` global nhưng không thấy custom exception filter.

---

## EH-02: Domain Error Classes

### EH-02-01: Tạo domain exceptions
Thay vì throw raw `HttpException`, nên có domain-specific exception classes:

```typescript
// Ví dụ concept — không implement trong task này
class DomainException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
    readonly details?: unknown
  ) {
    super({ code, message, details }, status);
  }
}

class AgeValidationException extends DomainException {
  constructor() {
    super('AGE_BELOW_MINIMUM', 'User must be at least 18 years old', 422);
  }
}
```

### EH-02-02: Domain error code list
Xem `spec/global/api-guidelines.md` section AG-09 cho full list.

---

## EH-03: HTTP Status Mapping

| Scenario | Status | Error Code |
|---|---|---|
| DTO validation fails | 400 | `VALIDATION_ERROR` |
| Malformed JSON | 400 | `BAD_REQUEST` |
| Login wrong credentials | 401 | `INVALID_CREDENTIALS` |
| JWT missing / expired / invalid | 401 | `TOKEN_INVALID` / `TOKEN_EXPIRED` |
| Refresh token invalid | 401 | `REFRESH_TOKEN_INVALID` |
| Account banned/suspended | 403 | `ACCOUNT_ACCESS_DENIED` |
| Email not verified (required context) | 403 | `EMAIL_NOT_VERIFIED` |
| User not onboarded | 403 | `NOT_ONBOARDED` |
| Chat not allowed (generic) | 403 | `CHAT_NOT_ALLOWED` |
| Resource not found | 404 | `NOT_FOUND` |
| Resource privacy-masked | 404 | `NOT_FOUND` |
| Duplicate email on register | 409 | `EMAIL_ALREADY_REGISTERED` |
| Match already exists | 409 | `MATCH_ALREADY_EXISTS` |
| Swipe already performed | 409 | `SWIPE_ALREADY_PERFORMED` |
| Age below minimum | 422 | `AGE_BELOW_MINIMUM` |
| Like quota exceeded | 429 | `LIKE_QUOTA_EXCEEDED` |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` |
| Unexpected server error | 500 | `INTERNAL_SERVER_ERROR` |

---

## EH-04: Generic Errors cho Auth Enumeration

### EH-04-01: Login failure
**KHÔNG ĐƯỢC:**
```json
{ "error": "USER_NOT_FOUND", "message": "No account with this email" }
{ "error": "WRONG_PASSWORD", "message": "Password is incorrect" }
```

**PHẢI LÀ:**
```json
{
  "statusCode": 401,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}
```

### EH-04-02: Forgot password
**KHÔNG ĐƯỢC:**
```json
{ "message": "Email not found in system" }
```

**PHẢI LÀ:**
```json
{
  "statusCode": 200,
  "message": "If this email address is registered, a password reset link has been sent"
}
```

### EH-04-03: Block privacy
**KHÔNG ĐƯỢC:**
```json
{ "error": "YOU_ARE_BLOCKED", "message": "This user has blocked you" }
```

**PHẢI LÀ:**
```json
{ "statusCode": 404, "error": "NOT_FOUND", "message": "Resource not found" }
```

---

## EH-05: Conflict Errors cho Duplicate Operations

### EH-05-01: Swipe duplicate
```json
{
  "statusCode": 409,
  "error": "SWIPE_ALREADY_PERFORMED",
  "message": "You have already swiped this user"
}
```

**Open Question:** Xem BR-07-03 — policy duplicate swipe chưa chốt.

### EH-05-02: Match duplicate
Match creation phải idempotent — worker không được tạo duplicate match.
Nếu match đã tồn tại khi worker retry: skip, không throw error.

---

## EH-06: Validation Error Shape

### EH-06-01: ValidationPipe output (NestJS default)
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

### EH-06-02: Target format (sau khi qua custom exception filter)
```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "email must be a valid email address" },
    { "field": "password", "message": "password must be at least 8 characters" }
  ],
  "requestId": "req-uuid-123"
}
```

---

## EH-07: Forbidden vs Not Found — Privacy Masking

### EH-07-01: Khi nào dùng 403 vs 404
| Scenario | Status | Lý do |
|---|---|---|
| User không phải participant của match | 403 | Permission denied (resource exists, permission fail) |
| Profile bị block — người dùng không nên biết resource tồn tại | 404 | Privacy masking |
| Account bị ban — người dùng biết account tồn tại là OK | 403 | Status denied |
| MatchId không tồn tại | 404 | Genuine not found |

**Rule tổng quát:**
- Nếu expose `403` có thể tiết lộ resource tồn tại theo cách nguy hại → dùng `404`.
- Nếu `403` không tiết lộ gì sensitive → dùng `403`.

---

## EH-08: RequestId / Correlation ID trong Errors

### EH-08-01: Yêu cầu
- Mọi error response phải có `requestId`.
- `requestId` phải match với request log để trace.
- Client có thể dùng `requestId` để report lỗi.

### EH-08-02: Lấy requestId
```typescript
// Trong exception filter
const requestId = request['requestId'] || randomUUID();
```

---

## EH-09: Production Error Response

### EH-09-01: Stack trace
- Production (`NODE_ENV=production`): KHÔNG bao gồm `stack` trong response.
- Development: Có thể log stack internally nhưng không trả về response.

### EH-09-02: Internal details
- KHÔNG expose DB error messages raw (e.g., Prisma error codes).
- KHÔNG expose file paths.
- KHÔNG expose dependency names.

### EH-09-03: Recommended exception filter behavior

```typescript
// Concept — không implement trong task này
if (isProduction) {
  return {
    statusCode,
    error: errorCode,
    message: userFriendlyMessage,
    requestId
  };
} else {
  return {
    statusCode,
    error: errorCode,
    message: userFriendlyMessage,
    requestId,
    debug: {
      originalMessage: exception.message,
      stack: exception.stack
    }
  };
}
```
