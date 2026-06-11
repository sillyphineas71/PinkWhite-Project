# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial core flows documentation với Mermaid diagrams | Toàn bộ file |

---

# Core Flows — Dating / Social Matchmaking Platform

Tài liệu này mô tả chi tiết các luồng nghiệp vụ cốt lõi bằng Mermaid diagrams kèm notes về privacy, security và implementation gaps.

---

## FLOW-01: Registration / Login Flow

### Goal
Cho phép user tạo tài khoản mới hoặc đăng nhập vào tài khoản cũ.

### Actor
Guest (chưa authenticated)

### Preconditions
- Không cần precondition (public endpoint)

### Main Flow

```mermaid
flowchart TD
  Start(["Client gửi POST /api/auth/register"])
  ValidateDTO["Validate DTO\n(email format, password min length)"]
  CheckEmailUnique["Check email unique trong DB"]
  HashPassword["Hash password\n(bcrypt, BCRYPT_ROUNDS)"]
  CreateUser["Tạo user record\n(isEmailVerified: false, isOnboarded: false)"]
  SendEmail["Gửi verification email\n(async, có thể fail silently)"]
  Return201["201 Created\n(user basic info, không trả password)"]

  Start --> ValidateDTO
  ValidateDTO -->|"Fail"| Err400["400 Bad Request\n(validation errors)"]
  ValidateDTO -->|"OK"| CheckEmailUnique
  CheckEmailUnique -->|"Đã tồn tại"| Err409["409 Conflict\n(email already registered)"]
  CheckEmailUnique -->|"OK"| HashPassword
  HashPassword --> CreateUser
  CreateUser --> SendEmail
  SendEmail --> Return201
```

### Login Flow

```mermaid
flowchart TD
  Start(["Client gửi POST /api/auth/login"])
  ValidateDTO["Validate DTO"]
  FindUser["Tìm user theo email"]
  CheckPassword["Verify password hash\n(bcrypt.compare)"]
  CheckStatus["Check account status\n(active?)"]
  CheckVerified["Check email verified\n(warning nếu chưa verify)"]
  GenTokens["Generate access_token + refresh_token"]
  StoreSession["Lưu refresh session\nvào Redis/DB"]
  SetCookies["Set HTTP-only cookies\naccess_token + refresh_token"]
  Return200["200 OK\n(user basic info)"]

  Start --> ValidateDTO
  ValidateDTO -->|"Fail"| Err400["400 Bad Request"]
  ValidateDTO -->|"OK"| FindUser
  FindUser -->|"Not found"| ErrGeneric["401 Generic error\n(không tiết lộ email/password cụ thể sai)"]
  FindUser -->|"Found"| CheckPassword
  CheckPassword -->|"Fail"| ErrGeneric
  CheckPassword -->|"OK"| CheckStatus
  CheckStatus -->|"banned/suspended/deleted"| Err403["403 Forbidden\n(account access denied)"]
  CheckStatus -->|"active"| CheckVerified
  CheckVerified -->|"Chưa verify"| WarnUnverified["Cho phép login\nnhưng warning email unverified"]
  CheckVerified -->|"OK"| GenTokens
  WarnUnverified --> GenTokens
  GenTokens --> StoreSession
  StoreSession --> SetCookies
  SetCookies --> Return200
```

### Privacy / Security Notes
- Error message cho login failure phải generic (anti-enumeration).
- Cookie phải HttpOnly, Secure (production), SameSite.
- Account status check bắt buộc sau JWT verify.

### Implementation Gaps
- **CSRF protection** chưa rõ cho mutation endpoints.
- **Account status guard** trong `JwtAccessGuard` chưa verify.
- **In-memory repo** — data reset khi restart server.

---

## FLOW-02: Onboarding Completion Flow

### Goal
User hoàn thành tất cả bước onboarding để trở thành discoverable.

### Actor
Authenticated User (email verified)

### Preconditions
- User đã đăng ký và email verified.

### Main Flow

```mermaid
flowchart TD
  Step1["Bước 1: Tạo basic profile\nPOST /api/profile\n(name, dob, gender)"]
  ValidateAge["Validate tuổi >= 18\n(tính chính xác theo ngày/tháng/năm)"]
  Step2["Bước 2: Upload ảnh\nPOST /api/profile/photos/upload"]
  WaitApproval["Chờ ảnh được approved\n(pending → approved)"]
  Step3["Bước 3: Cài đặt location\nPUT /api/profile/location\n(lat, lng)"]
  Step4["Bước 4: Set preferences\nPOST /api/discovery/preferences\n(hoặc dùng default)"]
  CheckEligibility["System check onboarding eligibility\n(tất cả điều kiện BR-02-01)"]
  SetOnboarded["Set isOnboarded = true\n(chỉ khi TẤT CẢ conditions thỏa)"]
  Discoverable["User trở thành discoverable\nXuất hiện trong feed của người khác"]

  Step1 --> ValidateAge
  ValidateAge -->|"Dưới 18"| Err422["422 Unprocessable\n(age validation failed)"]
  ValidateAge -->|"OK"| Step2
  Step2 --> WaitApproval
  WaitApproval -->|"Rejected"| RetryPhoto["User upload lại ảnh"]
  RetryPhoto --> WaitApproval
  WaitApproval -->|"Approved"| Step3
  Step3 --> Step4
  Step4 --> CheckEligibility
  CheckEligibility -->|"Chưa đủ điều kiện"| Incomplete["Return list of missing conditions"]
  CheckEligibility -->|"Đủ điều kiện"| SetOnboarded
  SetOnboarded --> Discoverable
```

### Privacy / Security Notes
- DOB phải được validate server-side, không tin client-side age check.
- Photo approval flow phải có — auto-approve hay manual review cần chốt.

### Implementation Gaps
- **isOnboarded business rule**: Hiện tại chưa rõ `isOnboarded` được set như thế nào và khi nào — cần review.
- **Photo approval flow**: Chưa có storage module, chưa có approval flow.
- **Onboarding eligibility check endpoint**: Cần verify tồn tại.

---

## FLOW-03: Discovery Feed Flow

### Goal
User nhận danh sách candidates phù hợp để swipe.

### Actor
Authenticated User (onboarded)

### Preconditions
- User đã onboarded (có profile, location, preferences, approved photo).
- User không ở hidden mode.

### Main Flow

```mermaid
flowchart TD
  Request["GET /api/discovery/feed\n(optional: cursor, limit)"]
  AuthCheck["JWT Auth + Account Status"]
  OnboardCheck["Check user đã onboarded?"]
  LoadPrefs["Load user's preferences\n(ageRange, gender, maxDistanceKm)"]
  QueryCandidates["Query candidates từ DB\n(eligible filter)"]
  Filter1["Filter: active + onboarded + verified\n+ not hidden + has photo"]
  Filter2["Filter: not blocked (both directions)\nnot already swiped"]
  Filter3["Filter: fits preferences\n(age, gender, distance)"]
  Filter4["Exclude self"]
  CalcDistance["Tính khoảng cách\n(PostGIS ST_Distance / ST_DWithin)"]
  MaskLocation["Mask location\n→ distanceLabel (không trả lat/lng)"]
  MaskDOB["Mask DOB\n→ chỉ trả age (số nguyên)"]
  Return["200 OK\nList of limited profiles + pagination cursor"]

  Request --> AuthCheck
  AuthCheck -->|"Fail"| Err401["401 Unauthorized"]
  AuthCheck -->|"OK"| OnboardCheck
  OnboardCheck -->|"Chưa onboarded"| Err403["403 Forbidden (not onboarded)"]
  OnboardCheck -->|"OK"| LoadPrefs
  LoadPrefs --> QueryCandidates
  QueryCandidates --> Filter1
  Filter1 --> Filter2
  Filter2 --> Filter3
  Filter3 --> Filter4
  Filter4 --> CalcDistance
  CalcDistance --> MaskLocation
  MaskLocation --> MaskDOB
  MaskDOB --> Return
```

### Privacy / Security Notes
- KHÔNG trả exact lat/lng trong response.
- KHÔNG trả DOB — chỉ trả `age`.
- KHÔNG trả `userId` trực tiếp trong discovery context (dùng cách approach khác để prevent user enumeration) — **Open Question: cần chốt**.
- Response phải exclude tất cả private fields.

- **In-memory repo**: Discovery filtering hiện dùng mock data. (Chờ migrate sang Prisma).
- **Distance calculation**: Dùng PostGIS `ST_Distance` cho production.
- **Mutual preference filtering**: Chưa rõ có filter hay không.
- **Cursor pagination**: Cần verify implementation.

---

## FLOW-04: Swipe Like / Pass Flow

### Goal
User thực hiện swipe action (like/pass/super like) lên một candidate.

### Actor
Authenticated User (onboarded)

### Preconditions
- User đã onboarded.
- Target đã xuất hiện trong discovery feed của user.

### Main Flow

```mermaid
sequenceDiagram
  participant Client
  participant API as Swipe API
  participant DB

  Client->>API: POST /api/swipes/like {targetId}
  API->>API: Auth + account status check
  API->>API: Check requester is onboarded
  API->>DB: Find target — is target eligible?
  alt Target not eligible
    API-->>Client: 404 Not Found (target not available)
  end
  API->>DB: Upsert `swipe_states` (idempotency check)
  alt Already swiped
    API-->>Client: 409 Conflict (already swiped) OR 200 OK (idempotent)
  end
  API->>DB: Check like quota (rolling 24h)
  alt Quota exceeded
    API-->>Client: 429 Too Many Requests (like quota exceeded)
  end
  API->>DB: Create `swipe_events` (LIKE)
  API->>DB: Create `outbox_events` (SWIPE_CREATED)
  API-->>Client: 201 Created {status: pending_match}
  Note right of API: Match processor sẽ chạy async để tạo match nếu có mutual like
```

### Alternative Flows
- **Pass flow**: Tương tự like nhưng không check quota, không tạo match. Action = `PASS`.
- **Super Like flow**: Như like nhưng check super like quota riêng.
- **Rewind**: Chỉ áp dụng cho last swipe, trong điều kiện rõ (cần chốt).

### Privacy / Security Notes
- Response khi target not eligible phải generic (không tiết lộ tại sao — blocked/hidden/banned).
- Swipe target không được expose exact location.

### Implementation Gaps
- **Event-driven match**: Hiện tại match được tạo trong cùng request (inline) do mock repo. Target architecture dùng `swipe_events` + `outbox_events` + match processor.

---

## FLOW-05: Mutual Like → Match Flow

### Goal
Khi có mutual like, hệ thống tạo match và notify cả 2 users.

### Actor
System (triggered by swipe)

### Preconditions
- User A đã like User B.
- User B vừa like User A.

### Main Flow

```mermaid
flowchart TD
  Worker["Match Processor (Worker)"]
  PollOutbox["Poll/Listen outbox_events\n(SWIPE_CREATED)"]
  CheckMutual["Check: User A đã like User B chưa?"]
  NoMutual["Không có mutual\nKết thúc"]
  MutualExists["Mutual like exists!"]
  CheckExistingMatch["Check: Đã có active match\ngiữa A và B chưa?"]
  AlreadyMatched["Match đã tồn tại\n(idempotent — skip)"]
  CreateMatch["Tạo/Update `matches` record\n(status: active, matchedAt: now)"]
  CreateNotify["Tạo in-app notification\ncho cả 2 users"]
  EmitSocket["Emit Socket.IO realtime event\ncho active clients"]

  Worker --> PollOutbox
  PollOutbox --> CheckMutual
  CheckMutual -->|"Không"| NoMutual
  CheckMutual -->|"Có"| MutualExists
  MutualExists --> CheckExistingMatch
  CheckExistingMatch -->|"Đã có match"| AlreadyMatched
  CheckExistingMatch -->|"Chưa có"| CreateMatch
  CreateMatch --> CreateNotify
  CreateNotify --> EmitSocket
```

### Privacy / Security Notes
- Match notification không được expose userId của người kia theo cách có thể enumerate — dùng matchId.
- Notification không gửi nếu một trong 2 đã block nhau.

### Implementation Gaps
- **Idempotency**: Database đã có unique constraint `(user_a_id, user_b_id)` cho match pair.
- **Race condition**: Đã giải quyết ở schema, nhưng runtime worker cần xử lý.
- **Realtime gateway**: Chưa có auth, chưa có match rooms.
- **Notification**: Notification lưu DB phase 1, push/FCM là future.

---

## FLOW-06: Chat Permission Flow

### Goal
Xác định user có được phép gửi message trong một conversation hay không.

### Actor
Authenticated User

### Preconditions
- User đã login.
- User muốn gửi message tới một matchId.

### Main Flow

```mermaid
flowchart TD
  SendMsg["POST /api/chats/:matchId/messages"]
  Auth["JWT Auth OK?"]
  AccountStatus["Account status active?"]
  FindMatch["Match :matchId tồn tại?"]
  IsParticipant["User là participant\ncủa match này?"]
  IsActive["Match status active?\n(chưa unmatch)"]
  BlockCheck["Có block giữa pair?"]
  Store["Lưu message vào DB"]
  Emit["Emit message qua Socket.IO\ntới match room"]

  SendMsg --> Auth
  Auth -->|"No"| E401["401 Unauthorized"]
  Auth -->|"Yes"| AccountStatus
  AccountStatus -->|"No"| E403["403 Forbidden"]
  AccountStatus -->|"Yes"| FindMatch
  FindMatch -->|"No"| E404["404 Not Found"]
  FindMatch -->|"Yes"| IsParticipant
  IsParticipant -->|"No"| E403
  IsParticipant -->|"Yes"| IsActive
  IsActive -->|"Unmatched"| E403Chat["403 Chat no longer available"]
  IsActive -->|"Active"| BlockCheck
  BlockCheck -->|"Blocked"| E403Chat
  BlockCheck -->|"OK"| Store
  Store --> Emit
```

### Privacy / Security Notes
- `403 Chat no longer available` phải là generic — không tiết lộ lý do (unmatch vs block).
- Message content phải không được log.
- Chỉ participants mới có thể read messages — không có public read.

### Implementation Gaps
- **Chat module**: Chưa có (`src/modules/chat` chưa tồn tại).
- **Socket authentication**: Gateway hiện tại không authenticate.

---

## FLOW-07: Block / Report Flow

### Goal
User bảo vệ bản thân bằng cách block hoặc report người khác.

### Actor
Authenticated User

### Preconditions
- User đã login.

### Block Flow

```mermaid
flowchart TD
  BlockRequest["POST /api/safety/block\n{targetId}"]
  Auth["Auth + account status OK?"]
  CheckSelf["Block chính mình?"]
  CheckExisting["Block đã tồn tại?"]
  CreateBlock["Tạo block record"]
  HideMatch["Ẩn active match\n(nếu có)"]
  DisableChat["Disable chat\ngiữa pair"]
  SuppressNotify["Suppress notifications\ngiữa pair"]
  HideDiscovery["Mutual invisible\ntrong discovery"]
  Return200["200 OK"]

  BlockRequest --> Auth
  Auth -->|"No"| E401["401 Unauthorized"]
  Auth -->|"Yes"| CheckSelf
  CheckSelf -->|"Yes"| E400["400 Bad Request"]
  CheckSelf -->|"No"| CheckExisting
  CheckExisting -->|"Đã block"| Return200Idempotent["200 OK (idempotent)"]
  CheckExisting -->|"Chưa"| CreateBlock
  CreateBlock --> HideMatch
  HideMatch --> DisableChat
  DisableChat --> SuppressNotify
  SuppressNotify --> HideDiscovery
  HideDiscovery --> Return200
```

### Report Flow

```mermaid
flowchart TD
  ReportRequest["POST /api/safety/report\n{targetId, reason, description}"]
  Auth["Auth + account status OK?"]
  CheckSelf["Report chính mình?"]
  CreateReport["Tạo report record\n(status: pending)"]
  OptionalBlock["User muốn block kèm report?"]
  CreateBlock["Tạo block record"]
  NotifyModeration["Flag for moderator review"]
  Return200["201 Created\n(report submitted)"]

  ReportRequest --> Auth
  Auth -->|"No"| E401["401 Unauthorized"]
  Auth -->|"Yes"| CheckSelf
  CheckSelf -->|"Yes"| E400["400 Bad Request"]
  CheckSelf -->|"No"| CreateReport
  CreateReport --> OptionalBlock
  OptionalBlock -->|"Yes"| CreateBlock
  CreateBlock --> NotifyModeration
  OptionalBlock -->|"No"| NotifyModeration
  NotifyModeration --> Return200
```

### Privacy / Security Notes
- Blocked user nhận generic error — không biết mình bị block.
- Report detail là sensitive data — không log, không expose.
- Multiple reports có thể trigger auto-flag — **Open Question: threshold là bao nhiêu?**

### Implementation Gaps
- **Safety module**: Chưa có (`src/modules/safety` chưa tồn tại).
- Block không được apply vào discovery/match/chat queries hiện tại vì module chưa có.

---

## FLOW-08: Account Deletion / Restoration Flow

### Goal
User xóa tài khoản (soft delete) và có thể khôi phục trong 30 ngày.

### Actor
Authenticated User

### Deletion Flow

```mermaid
flowchart TD
  DeleteRequest["DELETE /api/auth/account"]
  Auth["Auth + account status OK?"]
  ConfirmPassword["Verify current password\n(hoặc yêu cầu confirm step)"]
  SoftDelete["Set account_status = deleted\nSet deleted_at = now\nSet deletion_scheduled_at = now + 30 days\nSet anonymized_at = null"]
  RevokeSessions["Revoke tất cả sessions"]
  HideFromDiscovery["Không xuất hiện\ntrong discovery nữa"]
  HideMatches["Ẩn account\nkhỏi match partner's view"]
  Return200["200 OK\n(account scheduled for deletion)"]
  HardDeleteJob["[30 ngày sau]\nanonymize user data"]

  DeleteRequest --> Auth
  Auth -->|"No"| E401["401 Unauthorized"]
  Auth -->|"Yes"| ConfirmPassword
  ConfirmPassword -->|"Fail"| E401
  ConfirmPassword -->|"OK"| SoftDelete
  SoftDelete --> RevokeSessions
  RevokeSessions --> HideFromDiscovery
  HideFromDiscovery --> HideMatches
  HideMatches --> Return200
  Return200 -.->|"30 ngày sau"| HardDeleteJob
```

### Restoration Flow

```mermaid
flowchart TD
  RestoreRequest["POST /api/auth/restore\n(trong 30 ngày)"]
  FindAccount["Tìm account theo email"]
  CheckDeleted["Account ở trạng thái deleted?"]
  CheckWindow["Còn trong 30-day window?"]
  Restore["Xóa deleted_at, deletion_scheduled_at\nRestore account_status = active"]
  SendVerification["Gửi email verification lại\n(nếu cần)"]
  Return200["200 OK\n(account restored)"]

  RestoreRequest --> FindAccount
  FindAccount -->|"Not found"| E404["404 Not Found"]
  FindAccount -->|"Found"| CheckDeleted
  CheckDeleted -->|"Không phải deleted"| E409["409 Conflict"]
  CheckDeleted -->|"OK"| CheckWindow
  CheckWindow -->|"Quá 30 ngày"| E410["410 Gone\n(recovery window expired)"]
  CheckWindow -->|"OK"| Restore
  Restore --> SendVerification
  SendVerification --> Return200
```

### Privacy / Security Notes
- Sau deletion: data không bị xóa ngay — giữ cho investigation purposes.
- Message data sau hard delete: **Open Question**.

### Implementation Gaps
- **30-day hard delete job**: Chưa có scheduled job.
- **Soft delete effect on match/chat**: Cần verify behavior.
