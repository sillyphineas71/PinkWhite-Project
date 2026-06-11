# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial testing strategy cho dating/social matchmaking backend | Toàn bộ file |

---

# Testing Strategy — Dating / Social Matchmaking Platform

---

## TS-01: Overview

### TS-01-01: Testing pyramid

```
          [E2E Tests]
         (few, slow, critical flows)

     [Integration Tests]
    (API-level, DB interaction)

[Unit Tests]
(business logic, utils, validators)
```

### TS-01-02: Testing philosophy
- Unit tests: test business logic, domain rules, utils in isolation.
- Integration tests: test API endpoints với real (test) database trong tương lai.
- E2E tests: test full user flows từ client perspective.
- Không rely vào in-memory mock behavior làm production truth.

---

## TS-02: Unit Tests

### TS-02-01: Priority unit tests

#### Age calculation
```
Test: calculateAge(dob, today)
- dob = 2000-06-11, today = 2018-06-10 → 17 (dưới 18)
- dob = 2000-06-11, today = 2018-06-11 → 18 (đúng 18)
- dob = 2000-12-31, today = 2018-12-30 → 17 (chưa đủ tuổi dù cùng năm)
- dob = 2000-01-01, today = 2026-06-11 → 26
```

#### Password validation
```
Test: password strength rules
- < 8 chars → fail
- empty → fail
- "password123" → pass (nếu không có complexity requirement)
```

#### Onboarding eligibility check
```
Test: isOnboardingComplete(user, profile, photo, location, preferences)
- Thiếu email verified → false
- Thiếu approved photo → false
- Thiếu location → false
- Tuổi < 18 → false
- Account banned → false
- Tất cả điều kiện OK → true
```

#### Discovery eligibility
```
Test: isEligibleForDiscovery(candidate, requester)
- candidate is hidden → false
- candidate is banned → false
- candidate email not verified → false
- requester blocked candidate → false
- candidate blocked requester → false
- already swiped candidate → false
- candidate not in preference range → false
- candidate is requester → false
- all OK → true
```

#### Swipe rules
```
Test: validateSwipeAction(requester, target, swipeType)
- requester == target → error CANNOT_SWIPE_SELF
- target not eligible → error TARGET_NOT_ELIGIBLE
- already swiped → error SWIPE_ALREADY_PERFORMED (or defined behavior)
- like quota exceeded → error LIKE_QUOTA_EXCEEDED
- all OK → success
```

#### Match creation idempotency
```
Test: createMatchIdempotent(userIdA, userIdB)
- First call → match created
- Second call (same pair) → returns existing match, not duplicate
```

#### Block rule
```
Test: applyBlockEffect(blockerId, blockedId)
- Mutual invisibility: both blocked and blocker become invisible to each other
- Active match becomes hidden
```

#### Chat permission
```
Test: canSendMessage(senderId, matchId)
- Match not found → false
- Sender not participant → false
- Match unmatched → false
- Block exists between pair → false
- All OK → true
```

### TS-02-02: Location utility
```
Test: calculateDistanceKm(lat1, lng1, lat2, lng2)
- Known coordinates → expected distance using PostGIS ST_Distance / ST_DWithin
- Same coordinates → 0 km
- Latitude out of range → error
- (Note: Haversine may only exist as a fallback/helper, PostGIS is the target discovery query)
```

### TS-02-03: Response masking utils
```
Test: maskProfileForDiscovery(profile)
- response.dob should be undefined
- response.age should be number
- response.exactLocation should be undefined
- response.distanceLabel should be string

Test: maskProfileForMatch(profile)
- response.dob should be undefined
- response.exactLocation should be undefined
```

---

## TS-03: Integration Tests

### TS-03-01: Auth integration tests

```
Test: POST /api/auth/register
- Valid data → 201
- Duplicate email → 409
- Invalid email format → 400
- Password too short → 400

Test: POST /api/auth/login
- Valid credentials → 200 + Set-Cookie
- Wrong password → 401 generic error (not "wrong password")
- Non-existent email → 401 generic error (not "email not found")
- Banned account → 403

Test: POST /api/auth/refresh
- Valid refresh token → 200 + new cookies
- Invalid/expired refresh token → 401
- Used refresh token (rotation) → 401 (old token invalidated)

Test: POST /api/auth/logout
- Valid session → 200 + cookie cleared
- Verify session is revoked (subsequent refresh fails)

Test: POST /api/auth/logout-all
- All sessions revoked
```

### TS-03-02: Onboarding integration tests

```
Test: Full onboarding flow
POST /api/profile → 201
PUT /api/profile/location → 200
POST /api/discovery/preferences → 201
[Photo upload — needs storage mock]
GET /api/profile/onboarding-status → { complete: true }
```

### TS-03-03: Discovery integration tests

```
Test: GET /api/discovery/feed
- Response MUST NOT contain dob (only age)
- Response MUST NOT contain exact lat/lng
- Response MUST NOT contain banned users
- Response MUST NOT contain hidden users
- Response MUST NOT contain already-swiped users
- Response MUST NOT contain blocked users
- Response MUST NOT contain self
```

### TS-03-04: Swipe integration tests

```
Test: POST /api/swipes/like
- Like target → 201 {matched: false}
- Like target that already liked requester → 201 {matched: true, matchId}
- Like same target again → 409 (or defined idempotency behavior)
- Like self → 400

Test: Match idempotency race simulation
- Simulate two "like" requests arriving nearly simultaneously
- Verify only ONE match record created
```

### TS-03-05: Unmatch / Block integration tests

```
Test: POST /api/matches/:matchId/unmatch
- After unmatch: GET /api/chats/:matchId/messages → 403

Test: POST /api/safety/block {targetId}
- After block A→B:
  - A's feed MUST NOT contain B
  - B's feed MUST NOT contain A (if also blocked)
  - If had active match: match hidden from both

Test: Privacy response does not expose dob or exact location
- GET /api/discovery/feed → no dob, no lat/lng
- GET /api/matches/:id/profile → no dob, no lat/lng
```

---

## TS-04: E2E Tests

### TS-04-01: Full core loop E2E

```
1. Register User A
2. Verify User A email
3. Complete User A onboarding (profile + photo + location + preferences)
4. Register User B
5. Verify User B email
6. Complete User B onboarding
7. User A gets discovery feed → B appears
8. User A likes B → {matched: false}
9. User B likes A → {matched: true, matchId}
10. User A sends message to match
11. User B receives message
12. User A unmatches → message sending fails (403)
```

### TS-04-02: Unhappy auth flow E2E

```
1. Attempt login with wrong password → 401 generic
2. Attempt login with unknown email → 401 generic (same message)
3. Attempt forgot password for unknown email → 200 generic ("if email exists...")
4. Register with existing email → 409
```

### TS-04-03: Block & privacy E2E

```
1. User A blocks User B
2. User B attempts to access A's profile → 404 (not "you are blocked")
3. User A's feed does not contain B
4. User B's feed does not contain A
```

### TS-04-04: Account deletion E2E

```
1. User A registers + onboards
2. User A deletes account (soft delete)
3. User A attempts login → 403
4. User B's feed does not contain A
5. Within 30 days: restore account → 200
6. User A can login again
```

---

## TS-05: Test Environment Requirements

### TS-05-01: Mock external services
- Email provider (Nodemailer): mock/stub trong tests — không gửi email thật.
- Storage provider: mock/stub trong tests.
- Firebase push notification: mock/stub.
- Google OAuth: mock id_token verification.

### TS-05-02: Test database (integration/e2e)
- Cần PostgreSQL test database riêng (không dùng production DB).
- Seed test data trước mỗi test suite.
- Clean up sau mỗi test (hoặc dùng transactions).
- **Hiện tại:** Tests mock PrismaService — cần update khi DB được implement.

### TS-05-03: API prefix consistency
- Tests PHẢI dùng đúng global prefix `/api`.
- E2E tests hiện tại dùng `/health` (không có `/api` prefix) — **Known Gap:** cần verify.
- `main.ts` set `app.setGlobalPrefix('api')`, nên health endpoint phải là `/api/health`.
- **Verify:** E2E test `app.e2e-spec.ts` test `/health` không phải `/api/health` — có thể sai.

### TS-05-04: Cookie handling trong tests
- Tests gửi cookie-based auth phải handle cookie jar (supertest supports this).
- Verify cookie attributes trong test (HttpOnly, etc.) khi relevant.

---

## TS-06: Test File Naming Convention

```
src/
  modules/
    auth/
      services/
        auth.service.spec.ts      # unit tests
      controllers/
        auth.controller.spec.ts   # controller unit tests
test/
  app.e2e-spec.ts                 # health E2E
  auth.e2e-spec.ts                # auth E2E
  profile.e2e-spec.ts             # profile E2E
  discovery.e2e-spec.ts           # discovery E2E
  swipe.e2e-spec.ts               # swipe E2E
  match.e2e-spec.ts               # match E2E
```

---

## TS-07: Test Commands

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

---

## TS-08: Coverage Targets (Production)

| Layer | Minimum coverage |
|---|---|
| Business logic utils | 90% |
| Service layer | 80% |
| Controller layer | 70% |
| E2E (critical paths) | All P0 use cases |

**Hiện tại:** Coverage chưa được measure. Cần setup sau khi chuyển sang Prisma.
