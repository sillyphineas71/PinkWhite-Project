# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial logging, monitoring và audit spec cho dating/social matchmaking backend | Toàn bộ file |

---

# Logging / Monitoring / Audit — Dating / Social Matchmaking Platform

---

## LMA-01: Application Logs

### LMA-01-01: Structured logging requirements
- Tất cả logs phải là **structured JSON** format (không phải plain text cho production).
- Log level: `error`, `warn`, `info`, `debug`.
- Production: log level `info` trở lên.
- Development: log level `debug` trở lên.

### LMA-01-02: Required log fields

```json
{
  "timestamp": "2026-06-11T09:00:00.000Z",
  "level": "info",
  "requestId": "req-uuid-123",
  "userId": "usr-uuid-xxx",
  "module": "SwipeService",
  "action": "LIKE",
  "status": "success",
  "durationMs": 45,
  "message": "Swipe recorded"
}
```

### LMA-01-03: Request logging
Mỗi HTTP request phải log:
- `requestId`
- `method` + `path` (không log query string nếu có sensitive data)
- `statusCode`
- `durationMs`
- `userId` (nếu authenticated)

### LMA-01-04: Logger hiện tại
- Project dùng NestJS built-in `Logger`.
- **Known Gap:** Chưa có structured JSON logger (sẽ cần pino hoặc winston cho production).

---

## LMA-02: Sensitive Log Ban List

### LMA-02-01: TUYỆT ĐỐI KHÔNG LOG

| Data | Lý do |
|---|---|
| `password` / `passwordHash` | Credential leak |
| JWT `access_token` (raw) | Token hijack |
| JWT `refresh_token` (raw) | Session hijack |
| Cookie raw value | Token leak |
| OAuth `id_token` / `access_token` | Third-party credential |
| Exact `latitude` / `longitude` | Location privacy |
| Message content / chat body | Chat privacy |
| Private photo URL | Content privacy |
| Email raw (nếu không mask) | PII leak |
| Report description (sensitive) | Moderation privacy |
| `SMTP_PASSWORD` | Email credential |
| Reset password token raw | Security token |
| Verification token raw | Security token |

### LMA-02-02: Acceptable alternatives

| Sensitive data | Log alternative |
|---|---|
| Email | Masked: `hai***@gmail.com` |
| UserId | OK to log (UUID) |
| Exact location | Only log action "location updated", NOT the coordinates |
| Message content | Only log "message sent", NOT the content |
| Token | Only log "token issued/revoked", NOT the token value |
| Photo URL | Only log photoId, NOT the URL |

---

## LMA-03: Audit Events

### LMA-03-01: Định nghĩa Audit Event
Audit event là record về action quan trọng liên quan đến tài khoản, an toàn, quyền riêng tư.
Audit events phải được lưu persistently (không chỉ trong application logs).

### LMA-03-02: Auth & Account Audit Events

| Event | Trigger | Data cần ghi |
|---|---|---|
| `AUTH.LOGIN_SUCCESS` | User login thành công | userId, ip, userAgent, timestamp |
| `AUTH.LOGIN_FAILURE` | Login sai credentials | email (masked), ip, timestamp |
| `AUTH.LOGOUT` | User logout | userId, sessionId, timestamp |
| `AUTH.LOGOUT_ALL` | Force logout all | userId, timestamp |
| `AUTH.TOKEN_REFRESH` | Refresh token used | userId, timestamp |
| `AUTH.PASSWORD_CHANGED` | Password changed | userId, timestamp |
| `AUTH.PASSWORD_RESET_REQUESTED` | Forgot password | email (masked), ip, timestamp |
| `AUTH.PASSWORD_RESET_COMPLETED` | Reset password done | userId, timestamp |
| `AUTH.EMAIL_VERIFIED` | Email verification | userId, timestamp |
| `AUTH.ACCOUNT_DELETED` | Soft delete | userId, timestamp |
| `AUTH.ACCOUNT_RESTORED` | Account restored | userId, timestamp |
| `AUTH.GOOGLE_OAUTH_LOGIN` | OAuth login | userId, timestamp |

### LMA-03-03: Profile & Privacy Audit Events

| Event | Trigger | Data cần ghi |
|---|---|---|
| `PROFILE.VISIBILITY_CHANGED` | Hidden mode toggle | userId, newState, timestamp |
| `PROFILE.LOCATION_UPDATED` | Location set/update | userId, timestamp (KHÔNG log lat/lng) |
| `PROFILE.PHOTO_UPLOADED` | Photo upload completed | userId, photoId, timestamp |
| `PROFILE.PHOTO_DELETED` | Photo deleted | userId, photoId, timestamp |

### LMA-03-04: Match & Swipe Audit Events

| Event | Trigger | Data cần ghi |
|---|---|---|
| `MATCH.CREATED` | Match từ mutual like | matchId, userIdA, userIdB, timestamp |
| `MATCH.UNMATCHED` | User unmatch | matchId, initiatorId, timestamp |

### LMA-03-05: Safety Audit Events

| Event | Trigger | Data cần ghi |
|---|---|---|
| `SAFETY.USER_BLOCKED` | Block user | blockerId, blockedId, timestamp |
| `SAFETY.USER_UNBLOCKED` | Unblock user | blockerId, blockedId, timestamp |
| `SAFETY.REPORT_SUBMITTED` | Report user | reporterId, reportedId, reason, reportId, timestamp |
| `SAFETY.ACCOUNT_BANNED` | Admin ban | userId, adminId, reason, timestamp |
| `SAFETY.ACCOUNT_SUSPENDED` | Admin suspend | userId, adminId, reason, suspendedUntil, timestamp |
| `SAFETY.MODERATION_ACTION` | Moderator action on report | reportId, moderatorId, action, timestamp |

---

## LMA-04: Monitoring Requirements

### LMA-04-01: Health checks
- `GET /api/health` phải check:
  - Application status
  - DB connection (PostgreSQL) — hiện tại mock/not connected
  - Redis connection — hiện tại mock/not connected
- Response format:
```json
{
  "service": "matchmaking-api",
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  },
  "timestamp": "2026-06-11T09:00:00.000Z"
}
```

### LMA-04-02: Metrics to track

| Metric | Alert condition |
|---|---|
| HTTP error rate (5xx) | > 1% in 5 minutes |
| Auth failure rate | > 50 failures/minute from single IP |
| Report submission rate | Spike > 3x baseline |
| Block rate | Spike > 3x baseline |
| DB connection errors | Any error |
| Redis connection errors | Any error |
| Queue/outbox lag | > 30 seconds (khi implement) |
| WebSocket connection count | Drop sudden > 50% |
| API p99 latency | > 2 seconds |

### LMA-04-03: Current state
- **Known Gap:** Chưa có monitoring infrastructure. Cần setup (Prometheus + Grafana, hoặc DataDog, hoặc CloudWatch) trước production.

---

## LMA-05: Log Format cho Common Events

### LMA-05-01: Swipe action log
```json
{
  "timestamp": "2026-06-11T09:00:00.000Z",
  "level": "info",
  "requestId": "req-uuid-123",
  "userId": "usr-uuid-aaa",
  "module": "SwipeService",
  "action": "SWIPE",
  "swipeType": "LIKE",
  "targetId": "usr-uuid-bbb",
  "resulted": "MATCH",
  "matchId": "match-uuid-ccc"
}
```
*Không log target profile data, không log location.*

### LMA-05-02: Auth login log
```json
{
  "timestamp": "2026-06-11T09:00:00.000Z",
  "level": "info",
  "requestId": "req-uuid-123",
  "action": "LOGIN",
  "status": "success",
  "userId": "usr-uuid-aaa",
  "ip": "192.168.1.x",
  "userAgent": "Mozilla/5.0..."
}
```
*Không log email raw.*

### LMA-05-03: Error log
```json
{
  "timestamp": "2026-06-11T09:00:00.000Z",
  "level": "error",
  "requestId": "req-uuid-123",
  "userId": "usr-uuid-aaa",
  "module": "AuthService",
  "action": "REFRESH_TOKEN",
  "error": "REFRESH_TOKEN_INVALID",
  "message": "Refresh token not found in session store"
}
```
*Stack trace: chỉ trong development, không trong production response.*

---

## LMA-06: Log Retention

### LMA-06-01: Recommended retention
| Log type | Retention |
|---|---|
| Application logs | 30 ngày (production) |
| Audit events | 1 năm (minimum) |
| Security events (login failure, ban) | 2 năm |
| Error logs | 90 ngày |

**Open Question:** Retention policy chính thức chưa chốt. Cần business/legal input.
