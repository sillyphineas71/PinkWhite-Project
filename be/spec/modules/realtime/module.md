# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial realtime module spec | Toàn bộ file |

---

# Realtime Module

## Goal
Quản lý Socket.IO connections, authentication, room management và delivery của realtime events.

## Responsibilities
- Authenticate socket connections (extract JWT từ cookie trong handshake).
- Attach userId vào socket data sau khi authenticate.
- Manage match rooms (join/leave).
- Emit events tới correct rooms/users.
- Track online presence (Redis).
- Handle disconnect gracefully (cleanup presence).

## Out of Scope
- Message persistence (→ `chat` module — realtime chỉ deliver).
- Match creation (→ `match` module).
- Business logic quyết định khi nào emit event.

## Main Business Rules
- Socket PHẢI authenticate trước khi join bất kỳ room nào.
- User chỉ được join room của match mà họ là participant.
- Room naming không được predictable từ userIds (dùng matchId hoặc hashed).
- Unauthenticated socket không được nhận private events.

## Privacy / Security Notes
- Không emit private data của user A tới socket của user B.
- Room names dùng matchId (UUID) — không predictable.
- Socket disconnect phải cleanup presence state trong Redis.
- **Known Gap:** Hiện tại gateway không authenticate — bất kỳ ai đều connect được.

## API Surface (Socket Events)

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join:match` | `{matchId}` | Join match room |
| `leave:match` | `{matchId}` | Leave match room |
| `typing:start` | `{matchId}` | Bắt đầu gõ |
| `typing:stop` | `{matchId}` | Ngừng gõ |
| `ping` | — | Heartbeat |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `connected` | `{socketId}` | Connection confirmed |
| `match:new` | `{matchId, matchedAt, profile}` | New match notification |
| `message:new` | `{matchId, message}` | New message received |
| `message:read` | `{matchId, readAt}` | Read receipt |
| `typing:start` | `{matchId, userId}` | Typing indicator |
| `typing:stop` | `{matchId, userId}` | Typing stopped |
| `pong` | `{timestamp}` | Heartbeat response |

## Data Model Requirements
*(No DB — realtime is stateless with Redis for presence)*

**Redis keys:**
- `presence:{userId}` → socket connection info (TTL: 60s, refreshed on heartbeat)
- `socket:{socketId}` → userId mapping

## Events Consumed
| Event | From | Action |
|---|---|---|
| `MATCH_CREATED` | Match module | Emit `match:new` to both users |
| `MESSAGE_SENT` | Chat module | Emit `message:new` to match room |
| `MESSAGE_READ` | Chat module | Emit `message:read` to match room |

## Logging / Audit
- Log: socket connected (socketId, userId sau auth).
- Log: socket disconnected (socketId).
- Log: user joined/left room (userId, matchId).
- KHÔNG log message content.

## Testing Notes
- Unit: socket auth extracts userId from JWT cookie.
- Unit: join room verifies participant.
- Integration: connection without auth → rejected.

## Known Implementation Gaps
- **GAP-06:** Realtime gateway KHÔNG authenticate socket connections.
- **GAP-08:** CORS hardcoded, không đọc từ env.
- Không có room management.
- Không có Redis presence tracking.
- Chỉ có ping/pong placeholder.

## Open Questions
- Socket.IO scaling: khi nào cần Redis adapter? (xem OQ-04-02)
- Typing indicator TTL: bao lâu tắt nếu client không gửi `typing:stop`?
- Online status exposure: match partner thấy online status hay không? (xem privacy matrix PR-02)
