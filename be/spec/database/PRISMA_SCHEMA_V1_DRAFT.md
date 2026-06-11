# Prisma Schema v1 Draft — Dating / Social Matchmaking Platform

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial Prisma schema draft from approved PostgreSQL logical schema v1 | Entire file |

---

## 0. Status

This document is a **Prisma schema draft for review**.

Do not copy this directly into `prisma/schema.prisma` until reviewed.

Flow:

```text
PostgreSQL Logical Schema v1 approved
→ Prisma Schema v1 Draft
→ Review Prisma mapping
→ Update real prisma/schema.prisma
→ Create migration
→ Review migration SQL
→ Apply migration
```

---

## 1. Important Prisma mapping decisions

### 1.1 UUIDv7

Use Prisma UUIDv7 generation if the project uses Prisma ORM >= 5.18:

```prisma
id String @id @default(uuid(7)) @db.Uuid
```

Prisma ORM v5.18 added `uuid(7)` support in the Prisma Schema `uuid()` function. If the installed Prisma version is older, generate UUIDv7 in the application layer instead and remove `@default(uuid(7))` from IDs. citeturn333955view0

### 1.2 PostGIS

PostGIS support in Prisma is version-sensitive. Official docs around PostgreSQL extensions mention `Unsupported` fallback for unsupported extension types and raw SQL requirements, while newer Prisma docs also describe native `Geometry` support. For this project, because the logical schema uses `geography(Point,4326)`, the safe phase-1 approach is:

```prisma
realLocation     Unsupported("geography(Point,4326)")?
passportLocation Unsupported("geography(Point,4326)")?
```

Then handle distance queries and GIST indexes through raw SQL migration/query. Prisma docs note that extension/custom types may be represented as `Unsupported` and queried with raw SQL when not natively supported. citeturn333955view2turn333955view3

### 1.3 Enum strategy

This draft uses Prisma enums for type safety. If the team wants easier enum changes during early development, use `String` + database check constraints instead.

Recommendation for this project:

```text
Use Prisma enums for clearer agent implementation.
Review enum changes carefully before migration.
```

### 1.4 Naming convention

Prisma model fields use camelCase.

Database table/column names use snake_case through `@map` and `@@map`.

---

# 2. Prisma schema draft

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ======================================================
// ENUMS
// ======================================================

enum AccountStatus {
  PENDING_EMAIL_VERIFICATION @map("pending_email_verification")
  ACTIVE                     @map("active")
  SUSPENDED                  @map("suspended")
  BANNED                     @map("banned")
  DELETED                    @map("deleted")

  @@map("account_status")
}

enum OnboardingStatus {
  NOT_STARTED @map("not_started")
  IN_PROGRESS @map("in_progress")
  COMPLETED   @map("completed")

  @@map("onboarding_status")
}

enum UserRole {
  USER      @map("user")
  MODERATOR @map("moderator")
  ADMIN     @map("admin")

  @@map("user_role")
}

enum AuthProvider {
  EMAIL  @map("email")
  GOOGLE @map("google")

  @@map("auth_provider")
}

enum SessionStatus {
  ACTIVE      @map("active")
  REVOKED     @map("revoked")
  EXPIRED     @map("expired")
  COMPROMISED @map("compromised")

  @@map("session_status")
}

enum SecurityTokenType {
  EMAIL_VERIFICATION @map("email_verification")
  PASSWORD_RESET     @map("password_reset")
  ACCOUNT_RESTORE    @map("account_restore")

  @@map("security_token_type")
}

enum Gender {
  MALE       @map("male")
  FEMALE     @map("female")
  NON_BINARY @map("non_binary")
  OTHER      @map("other")

  @@map("gender")
}

enum RelationshipGoal {
  LONG_TERM          @map("long_term")
  SHORT_TERM         @map("short_term")
  FRIENDS            @map("friends")
  STILL_FIGURING_OUT @map("still_figuring_out")

  @@map("relationship_goal")
}

enum UploadStatus {
  PENDING   @map("pending")
  UPLOADED  @map("uploaded")
  CONFIRMED @map("confirmed")
  EXPIRED   @map("expired")

  @@map("upload_status")
}

enum ModerationStatus {
  PENDING  @map("pending")
  APPROVED @map("approved")
  REJECTED @map("rejected")

  @@map("moderation_status")
}

enum ActiveLocationMode {
  REAL     @map("real")
  PASSPORT @map("passport")

  @@map("active_location_mode")
}

enum SwipeAction {
  LIKE       @map("like")
  PASS       @map("pass")
  SUPER_LIKE @map("super_like")
  REWIND     @map("rewind")

  @@map("swipe_action")
}

enum SwipeEventStatus {
  ACTIVE   @map("active")
  REVERTED @map("reverted")
  IGNORED  @map("ignored")

  @@map("swipe_event_status")
}

enum CurrentSwipeAction {
  LIKE       @map("like")
  PASS       @map("pass")
  SUPER_LIKE @map("super_like")

  @@map("current_swipe_action")
}

enum MatchStatus {
  ACTIVE    @map("active")
  UNMATCHED @map("unmatched")
  BLOCKED   @map("blocked")

  @@map("match_status")
}

enum MessageType {
  TEXT   @map("text")
  IMAGE  @map("image")
  SYSTEM @map("system")

  @@map("message_type")
}

enum MessageStatus {
  SENT                  @map("sent")
  DELETED_BY_SENDER     @map("deleted_by_sender")
  REMOVED_BY_MODERATION @map("removed_by_moderation")

  @@map("message_status")
}

enum BlockStatus {
  ACTIVE  @map("active")
  REVOKED @map("revoked")

  @@map("block_status")
}

enum ReportTargetType {
  USER    @map("user")
  PROFILE @map("profile")
  PHOTO   @map("photo")
  MESSAGE @map("message")
  MATCH   @map("match")

  @@map("report_target_type")
}

enum ReportStatus {
  PENDING   @map("pending")
  REVIEWING @map("reviewing")
  RESOLVED  @map("resolved")
  DISMISSED @map("dismissed")

  @@map("report_status")
}

enum PaymentProvider {
  VNPAY @map("vnpay")

  @@map("payment_provider")
}

enum PaymentStatus {
  PENDING   @map("pending")
  PAID      @map("paid")
  FAILED    @map("failed")
  EXPIRED   @map("expired")
  CANCELLED @map("cancelled")

  @@map("payment_status")
}

enum PaymentPurpose {
  SUBSCRIPTION_PURCHASE @map("subscription_purchase")

  @@map("payment_purpose")
}

enum SubscriptionProvider {
  VNPAY  @map("vnpay")
  MANUAL @map("manual")

  @@map("subscription_provider")
}

enum SubscriptionStatus {
  ACTIVE    @map("active")
  EXPIRED   @map("expired")
  CANCELLED @map("cancelled")

  @@map("subscription_status")
}

enum EntitlementType {
  UNLIMITED_LIKES  @map("unlimited_likes")
  SEE_WHO_LIKED_ME @map("see_who_liked_me")
  REWIND           @map("rewind")
  PASSPORT         @map("passport")
  SUPER_LIKE_QUOTA @map("super_like_quota")
  HIDDEN_MODE      @map("hidden_mode")

  @@map("entitlement_type")
}

enum NotificationType {
  MATCH_CREATED         @map("match_created")
  NEW_MESSAGE           @map("new_message")
  SUPER_LIKE_RECEIVED   @map("super_like_received")
  PROFILE_APPROVED      @map("profile_approved")
  PAYMENT_SUCCESS       @map("payment_success")
  SUBSCRIPTION_EXPIRING @map("subscription_expiring")
  MODERATION_UPDATE     @map("moderation_update")
  SYSTEM                @map("system")

  @@map("notification_type")
}

enum NotificationDeliveryStatus {
  PENDING   @map("pending")
  DELIVERED @map("delivered")
  FAILED    @map("failed")

  @@map("notification_delivery_status")
}

enum OutboxStatus {
  PENDING    @map("pending")
  PROCESSING @map("processing")
  PROCESSED  @map("processed")
  FAILED     @map("failed")
  DEAD       @map("dead")

  @@map("outbox_status")
}

// ======================================================
// MODELS
// ======================================================

model User {
  id                    String           @id @default(uuid(7)) @db.Uuid
  email                 String           @db.VarChar(320)
  emailNormalized       String           @unique @map("email_normalized") @db.VarChar(320)
  emailVerifiedAt       DateTime?        @map("email_verified_at") @db.Timestamptz
  accountStatus         AccountStatus    @default(PENDING_EMAIL_VERIFICATION) @map("account_status")
  onboardingStatus      OnboardingStatus @default(NOT_STARTED) @map("onboarding_status")
  userRole              UserRole         @default(USER) @map("user_role")
  lastLoginAt           DateTime?        @map("last_login_at") @db.Timestamptz
  onboardingCompletedAt DateTime?        @map("onboarding_completed_at") @db.Timestamptz
  deletedAt             DateTime?        @map("deleted_at") @db.Timestamptz
  deletionScheduledAt   DateTime?        @map("deletion_scheduled_at") @db.Timestamptz
  anonymizedAt          DateTime?        @map("anonymized_at") @db.Timestamptz
  createdAt             DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  authIdentities        AuthIdentity[]
  sessions              UserSession[]
  securityTokens        SecurityToken[]
  profile               Profile?
  photos                ProfilePhoto[]
  location              UserLocation?
  discoveryPreference   DiscoveryPreference?
  privacySettings       UserPrivacySettings?

  swipeEventsCreated    SwipeEvent[]     @relation("SwipeEventsCreated")
  swipeEventsReceived   SwipeEvent[]     @relation("SwipeEventsReceived")
  swipeStatesCreated    SwipeState[]     @relation("SwipeStatesCreated")
  swipeStatesReceived   SwipeState[]     @relation("SwipeStatesReceived")

  matchesAsA            Match[]          @relation("MatchesAsA")
  matchesAsB            Match[]          @relation("MatchesAsB")
  messages              Message[]

  blocksCreated         UserBlock[]      @relation("BlocksCreated")
  blocksReceived        UserBlock[]      @relation("BlocksReceived")
  reportsCreated        UserReport[]     @relation("ReportsCreated")
  reportsReceived       UserReport[]     @relation("ReportsReceived")
  reportsResolved       UserReport[]     @relation("ReportsResolved")

  paymentOrders         PaymentOrder[]
  subscriptions         UserSubscription[]
  entitlements          UserEntitlement[]
  notifications         Notification[]
  auditLogs             AuditLog[]

  @@index([accountStatus], map: "idx_users_account_status")
  @@index([onboardingStatus], map: "idx_users_onboarding_status")
  @@index([deletedAt], map: "idx_users_deleted_at")
  @@index([deletionScheduledAt], map: "idx_users_deletion_scheduled_at")
  @@map("users")
}

model AuthIdentity {
  id             String       @id @default(uuid(7)) @db.Uuid
  userId         String       @map("user_id") @db.Uuid
  provider       AuthProvider
  providerUserId String       @map("provider_user_id") @db.VarChar(320)
  passwordHash   String?      @map("password_hash")
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  user           User         @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId], map: "uq_auth_identities_provider_user_id")
  @@unique([userId, provider], map: "uq_auth_identities_user_provider")
  @@index([userId], map: "idx_auth_identities_user_id")
  @@map("auth_identities")
}

model UserSession {
  id                   String        @id @default(uuid(7)) @db.Uuid
  userId               String        @map("user_id") @db.Uuid
  refreshTokenHash     String        @map("refresh_token_hash")
  refreshTokenFamilyId String        @map("refresh_token_family_id") @db.Uuid
  sessionStatus        SessionStatus @default(ACTIVE) @map("session_status")
  userAgent            String?       @map("user_agent")
  ipHash               String?       @map("ip_hash")
  expiresAt            DateTime      @map("expires_at") @db.Timestamptz
  lastUsedAt           DateTime?     @map("last_used_at") @db.Timestamptz
  revokedAt            DateTime?     @map("revoked_at") @db.Timestamptz
  revokedReason        String?       @map("revoked_reason")
  createdAt            DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  user                 User          @relation(fields: [userId], references: [id])

  @@index([userId, sessionStatus], map: "idx_user_sessions_user_status")
  @@index([refreshTokenFamilyId], map: "idx_user_sessions_refresh_family")
  @@index([expiresAt], map: "idx_user_sessions_expires_at")
  @@map("user_sessions")
}

model SecurityToken {
  id           String            @id @default(uuid(7)) @db.Uuid
  userId       String            @map("user_id") @db.Uuid
  tokenType    SecurityTokenType @map("token_type")
  tokenHash    String            @map("token_hash")
  expiresAt    DateTime          @map("expires_at") @db.Timestamptz
  usedAt       DateTime?         @map("used_at") @db.Timestamptz
  createdAt    DateTime          @default(now()) @map("created_at") @db.Timestamptz
  metadataJson Json?             @map("metadata_json") @db.JsonB

  user         User              @relation(fields: [userId], references: [id])

  @@index([userId, tokenType], map: "idx_security_tokens_user_type")
  @@index([expiresAt], map: "idx_security_tokens_expires_at")
  @@index([tokenHash], map: "idx_security_tokens_token_hash")
  @@map("security_tokens")
}

model Profile {
  id               String           @id @default(uuid(7)) @db.Uuid
  userId           String           @unique @map("user_id") @db.Uuid
  displayName      String           @map("display_name") @db.VarChar(80)
  dob              DateTime         @db.Date
  gender           Gender
  bio              String?          @db.VarChar(500)
  jobTitle         String?          @map("job_title") @db.VarChar(120)
  company          String?          @db.VarChar(120)
  school           String?          @db.VarChar(120)
  heightCm         Int?             @map("height_cm")
  relationshipGoal RelationshipGoal @map("relationship_goal")
  lifestyleJson    Json?            @map("lifestyle_json") @db.JsonB
  interestsJson    Json?            @map("interests_json") @db.JsonB
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  user             User             @relation(fields: [userId], references: [id])

  @@index([userId], map: "idx_profiles_user_id")
  @@index([gender], map: "idx_profiles_gender")
  @@index([dob], map: "idx_profiles_dob")
  @@map("profiles")
}

model ProfilePhoto {
  id               String           @id @default(uuid(7)) @db.Uuid
  userId           String           @map("user_id") @db.Uuid
  storageProvider  String           @map("storage_provider")
  storageKey       String           @map("storage_key")
  publicUrl        String?          @map("public_url")
  mimeType         String           @map("mime_type") @db.VarChar(100)
  sizeBytes        BigInt           @map("size_bytes")
  sortOrder        Int              @map("sort_order")
  isAvatar         Boolean          @default(false) @map("is_avatar")
  uploadStatus     UploadStatus     @default(PENDING) @map("upload_status")
  moderationStatus ModerationStatus @default(PENDING) @map("moderation_status")
  rejectionReason  String?          @map("rejection_reason")
  approvedAt       DateTime?        @map("approved_at") @db.Timestamptz
  rejectedAt       DateTime?        @map("rejected_at") @db.Timestamptz
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime         @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt        DateTime?        @map("deleted_at") @db.Timestamptz

  user             User             @relation(fields: [userId], references: [id])

  @@index([userId, sortOrder], map: "idx_profile_photos_user_order")
  @@index([userId, moderationStatus], map: "idx_profile_photos_user_moderation")
  @@index([deletedAt], map: "idx_profile_photos_deleted_at")
  @@map("profile_photos")
}

model UserLocation {
  id                 String                 @id @default(uuid(7)) @db.Uuid
  userId             String                 @unique @map("user_id") @db.Uuid

  // PostGIS fields. Use raw SQL for writes/queries and GIST indexes if Prisma version does not support geography.
  realLocation       Unsupported("geography(Point,4326)")?     @map("real_location")
  passportLocation   Unsupported("geography(Point,4326)")?     @map("passport_location")

  activeLocationMode ActiveLocationMode     @default(REAL) @map("active_location_mode")
  accuracyMeters     Int?                   @map("accuracy_meters")
  isMocked           Boolean                @default(false) @map("is_mocked")
  updatedAt          DateTime               @updatedAt @map("updated_at") @db.Timestamptz
  createdAt          DateTime               @default(now()) @map("created_at") @db.Timestamptz

  user               User                   @relation(fields: [userId], references: [id])

  @@index([userId], map: "idx_user_locations_user_id")
  @@map("user_locations")
}

model DiscoveryPreference {
  id                String   @id @default(uuid(7)) @db.Uuid
  userId            String   @unique @map("user_id") @db.Uuid
  minAge            Int      @map("min_age")
  maxAge            Int      @map("max_age")
  maxDistanceKm     Int      @map("max_distance_km")
  preferredGenders  Json     @map("preferred_genders") @db.JsonB
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user              User     @relation(fields: [userId], references: [id])

  @@index([userId], map: "idx_discovery_preferences_user_id")
  @@map("discovery_preferences")
}

model UserPrivacySettings {
  id               String   @id @default(uuid(7)) @db.Uuid
  userId           String   @unique @map("user_id") @db.Uuid
  isHidden         Boolean  @default(false) @map("is_hidden")
  showDistance     Boolean  @default(true) @map("show_distance")
  showOnlineStatus Boolean  @default(true) @map("show_online_status")
  showLastActive   Boolean  @default(true) @map("show_last_active")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz

  user             User     @relation(fields: [userId], references: [id])

  @@index([userId], map: "idx_user_privacy_settings_user_id")
  @@index([isHidden], map: "idx_user_privacy_settings_is_hidden")
  @@map("user_privacy_settings")
}

model SwipeEvent {
  id                String             @id @default(uuid(7)) @db.Uuid
  swiperId          String             @map("swiper_id") @db.Uuid
  targetUserId      String             @map("target_user_id") @db.Uuid
  action            SwipeAction
  message           String?            @db.VarChar(500)
  status            SwipeEventStatus   @default(ACTIVE)
  createdAt         DateTime           @default(now()) @map("created_at") @db.Timestamptz
  revertedAt        DateTime?          @map("reverted_at") @db.Timestamptz
  revertedByEventId String?            @map("reverted_by_event_id") @db.Uuid

  swiper            User               @relation("SwipeEventsCreated", fields: [swiperId], references: [id])
  targetUser        User               @relation("SwipeEventsReceived", fields: [targetUserId], references: [id])
  revertedByEvent   SwipeEvent?        @relation("SwipeEventReversions", fields: [revertedByEventId], references: [id])
  revertedEvents    SwipeEvent[]       @relation("SwipeEventReversions")

  swipeStates       SwipeState[]
  matchesCreated    Match[]

  @@index([swiperId, targetUserId, createdAt], map: "idx_swipe_events_swiper_target_created")
  @@index([targetUserId, action, createdAt], map: "idx_swipe_events_target_action_created")
  @@index([swiperId, action, createdAt], map: "idx_swipe_events_swiper_action_created")
  @@map("swipe_events")
}

model SwipeState {
  swiperId         String             @map("swiper_id") @db.Uuid
  targetUserId     String             @map("target_user_id") @db.Uuid
  currentAction    CurrentSwipeAction @map("current_action")
  lastSwipeEventId String             @map("last_swipe_event_id") @db.Uuid
  lastSwipedAt     DateTime           @map("last_swiped_at") @db.Timestamptz
  recycleAfterAt   DateTime?          @map("recycle_after_at") @db.Timestamptz
  createdAt        DateTime           @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime           @updatedAt @map("updated_at") @db.Timestamptz

  swiper           User               @relation("SwipeStatesCreated", fields: [swiperId], references: [id])
  targetUser       User               @relation("SwipeStatesReceived", fields: [targetUserId], references: [id])
  lastSwipeEvent   SwipeEvent         @relation(fields: [lastSwipeEventId], references: [id])

  @@id([swiperId, targetUserId])
  @@index([swiperId, currentAction], map: "idx_swipe_states_swiper_action")
  @@index([targetUserId, currentAction], map: "idx_swipe_states_target_action")
  @@index([recycleAfterAt], map: "idx_swipe_states_recycle_after")
  @@map("swipe_states")
}

model Match {
  id                      String       @id @default(uuid(7)) @db.Uuid
  userAId                 String       @map("user_a_id") @db.Uuid
  userBId                 String       @map("user_b_id") @db.Uuid
  status                  MatchStatus  @default(ACTIVE)
  matchedAt               DateTime?    @map("matched_at") @db.Timestamptz
  unmatchedAt             DateTime?    @map("unmatched_at") @db.Timestamptz
  unmatchedByUserId       String?      @map("unmatched_by_user_id") @db.Uuid
  blockedByUserId         String?      @map("blocked_by_user_id") @db.Uuid
  lastMessageAt           DateTime?    @map("last_message_at") @db.Timestamptz
  lastInteractionAt       DateTime?    @map("last_interaction_at") @db.Timestamptz
  unreadCountA            Int          @default(0) @map("unread_count_a")
  unreadCountB            Int          @default(0) @map("unread_count_b")
  lastReadMessageIdA      String?      @map("last_read_message_id_a") @db.Uuid
  lastReadMessageIdB      String?      @map("last_read_message_id_b") @db.Uuid
  lastReadAtA             DateTime?    @map("last_read_at_a") @db.Timestamptz
  lastReadAtB             DateTime?    @map("last_read_at_b") @db.Timestamptz
  createdFromSwipeEventId String?      @map("created_from_swipe_event_id") @db.Uuid
  createdAt               DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt               DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  userA                   User         @relation("MatchesAsA", fields: [userAId], references: [id])
  userB                   User         @relation("MatchesAsB", fields: [userBId], references: [id])
  createdFromSwipeEvent   SwipeEvent?  @relation(fields: [createdFromSwipeEventId], references: [id])
  messages                Message[]

  @@unique([userAId, userBId], map: "uq_matches_user_pair")
  @@index([userAId, status], map: "idx_matches_user_a_status")
  @@index([userBId, status], map: "idx_matches_user_b_status")
  @@index([lastMessageAt], map: "idx_matches_last_message_at")
  @@index([status], map: "idx_matches_status")
  @@map("matches")
}

model Message {
  id          String        @id @default(uuid(7)) @db.Uuid
  matchId     String        @map("match_id") @db.Uuid
  senderId    String        @map("sender_id") @db.Uuid
  messageType MessageType   @map("message_type")
  body        String?
  mediaUrl    String?       @map("media_url")
  status      MessageStatus @default(SENT)
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz
  deletedAt   DateTime?     @map("deleted_at") @db.Timestamptz

  match       Match         @relation(fields: [matchId], references: [id])
  sender      User          @relation(fields: [senderId], references: [id])

  @@index([matchId, createdAt], map: "idx_messages_match_created")
  @@index([senderId, createdAt], map: "idx_messages_sender_created")
  @@index([status], map: "idx_messages_status")
  @@map("messages")
}

model UserBlock {
  id            String      @id @default(uuid(7)) @db.Uuid
  blockerId     String      @map("blocker_id") @db.Uuid
  blockedUserId String      @map("blocked_user_id") @db.Uuid
  status        BlockStatus @default(ACTIVE)
  createdAt     DateTime    @default(now()) @map("created_at") @db.Timestamptz
  revokedAt     DateTime?   @map("revoked_at") @db.Timestamptz

  blocker       User        @relation("BlocksCreated", fields: [blockerId], references: [id])
  blockedUser   User        @relation("BlocksReceived", fields: [blockedUserId], references: [id])

  @@unique([blockerId, blockedUserId], map: "uq_user_blocks_pair")
  @@index([blockerId, status], map: "idx_user_blocks_blocker_status")
  @@index([blockedUserId, status], map: "idx_user_blocks_blocked_status")
  @@map("user_blocks")
}

model UserReport {
  id                String           @id @default(uuid(7)) @db.Uuid
  reporterId        String           @map("reporter_id") @db.Uuid
  reportedUserId    String           @map("reported_user_id") @db.Uuid
  targetType        ReportTargetType @map("target_type")
  targetId          String           @map("target_id") @db.Uuid
  reason            String
  description       String?
  status            ReportStatus     @default(PENDING)
  createdAt         DateTime         @default(now()) @map("created_at") @db.Timestamptz
  resolvedAt        DateTime?        @map("resolved_at") @db.Timestamptz
  resolvedByAdminId String?          @map("resolved_by_admin_id") @db.Uuid
  resolutionNote    String?          @map("resolution_note")

  reporter          User             @relation("ReportsCreated", fields: [reporterId], references: [id])
  reportedUser      User             @relation("ReportsReceived", fields: [reportedUserId], references: [id])
  resolvedByAdmin   User?            @relation("ReportsResolved", fields: [resolvedByAdminId], references: [id])

  @@index([reportedUserId, status], map: "idx_user_reports_reported_status")
  @@index([reporterId, createdAt], map: "idx_user_reports_reporter_created")
  @@index([status, createdAt], map: "idx_user_reports_status_created")
  @@map("user_reports")
}

model PaymentOrder {
  id                    String          @id @default(uuid(7)) @db.Uuid
  userId                String          @map("user_id") @db.Uuid
  provider              PaymentProvider @default(VNPAY)
  orderCode             String          @unique @map("order_code") @db.VarChar(100)
  amount                Decimal         @db.Decimal(12, 2)
  currency              String          @db.Char(3)
  paymentStatus         PaymentStatus   @default(PENDING) @map("payment_status")
  purpose               PaymentPurpose  @default(SUBSCRIPTION_PURCHASE)
  planCode              String          @map("plan_code") @db.VarChar(50)
  providerOrderRef      String?         @map("provider_order_ref")
  providerTransactionNo String?         @map("provider_transaction_no")
  providerResponseCode  String?         @map("provider_response_code")
  providerPayloadJson   Json?           @map("provider_payload_json") @db.JsonB
  paidAt                DateTime?       @map("paid_at") @db.Timestamptz
  expiredAt             DateTime?       @map("expired_at") @db.Timestamptz
  createdAt             DateTime        @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime        @updatedAt @map("updated_at") @db.Timestamptz

  user                  User            @relation(fields: [userId], references: [id])
  subscriptions         UserSubscription[]

  @@index([userId, createdAt], map: "idx_payment_orders_user_created")
  @@index([paymentStatus, createdAt], map: "idx_payment_orders_status_created")
  @@index([providerTransactionNo], map: "idx_payment_orders_provider_tx")
  @@map("payment_orders")
}

model UserSubscription {
  id                 String               @id @default(uuid(7)) @db.Uuid
  userId             String               @map("user_id") @db.Uuid
  paymentOrderId     String?              @map("payment_order_id") @db.Uuid
  provider           SubscriptionProvider
  planCode           String               @map("plan_code") @db.VarChar(50)
  status             SubscriptionStatus   @default(ACTIVE)
  currentPeriodStart DateTime             @map("current_period_start") @db.Timestamptz
  currentPeriodEnd   DateTime             @map("current_period_end") @db.Timestamptz
  cancelAtPeriodEnd  Boolean              @default(false) @map("cancel_at_period_end")
  createdAt          DateTime             @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime             @updatedAt @map("updated_at") @db.Timestamptz

  user               User                 @relation(fields: [userId], references: [id])
  paymentOrder       PaymentOrder?        @relation(fields: [paymentOrderId], references: [id])
  entitlements       UserEntitlement[]

  @@index([userId, status], map: "idx_user_subscriptions_user_status")
  @@index([currentPeriodEnd], map: "idx_user_subscriptions_period_end")
  @@index([paymentOrderId], map: "idx_user_subscriptions_payment_order")
  @@map("user_subscriptions")
}

model UserEntitlement {
  id              String            @id @default(uuid(7)) @db.Uuid
  userId          String            @map("user_id") @db.Uuid
  subscriptionId  String?           @map("subscription_id") @db.Uuid
  entitlementType EntitlementType    @map("entitlement_type")
  quantity        Int?
  windowStart     DateTime?         @map("window_start") @db.Timestamptz
  windowEnd       DateTime?         @map("window_end") @db.Timestamptz
  expiresAt       DateTime?         @map("expires_at") @db.Timestamptz
  createdAt       DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime          @updatedAt @map("updated_at") @db.Timestamptz

  user            User              @relation(fields: [userId], references: [id])
  subscription    UserSubscription? @relation(fields: [subscriptionId], references: [id])

  @@index([userId, entitlementType, expiresAt], map: "idx_user_entitlements_user_type_expiry")
  @@index([subscriptionId], map: "idx_user_entitlements_subscription")
  @@map("user_entitlements")
}

model Notification {
  id             String                     @id @default(uuid(7)) @db.Uuid
  userId         String                     @map("user_id") @db.Uuid
  type           NotificationType
  title          String                     @db.VarChar(160)
  body           String?                    @db.VarChar(500)
  payloadJson    Json?                      @map("payload_json") @db.JsonB
  deliveryStatus NotificationDeliveryStatus @default(PENDING) @map("delivery_status")
  readAt         DateTime?                  @map("read_at") @db.Timestamptz
  createdAt      DateTime                   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime                   @updatedAt @map("updated_at") @db.Timestamptz
  expiresAt      DateTime                   @map("expires_at") @db.Timestamptz

  user           User                       @relation(fields: [userId], references: [id])

  @@index([userId, createdAt], map: "idx_notifications_user_created")
  @@index([userId, readAt], map: "idx_notifications_user_read")
  @@index([expiresAt], map: "idx_notifications_expires_at")
  @@map("notifications")
}

model AuditLog {
  id           String   @id @default(uuid(7)) @db.Uuid
  actorUserId  String?  @map("actor_user_id") @db.Uuid
  action       String
  targetType   String?  @map("target_type")
  targetId     String?  @map("target_id") @db.Uuid
  metadataJson Json?    @map("metadata_json") @db.JsonB
  ipHash       String?  @map("ip_hash")
  userAgent    String?  @map("user_agent")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  actorUser    User?    @relation(fields: [actorUserId], references: [id])

  @@index([actorUserId, createdAt], map: "idx_audit_logs_actor_created")
  @@index([targetType, targetId], map: "idx_audit_logs_target")
  @@index([action, createdAt], map: "idx_audit_logs_action_created")
  @@map("audit_logs")
}

model OutboxEvent {
  id            String       @id @default(uuid(7)) @db.Uuid
  aggregateType String       @map("aggregate_type")
  aggregateId   String       @map("aggregate_id") @db.Uuid
  eventType     String       @map("event_type")
  payloadJson   Json         @map("payload_json") @db.JsonB
  status        OutboxStatus @default(PENDING)
  attempts      Int          @default(0)
  availableAt   DateTime     @default(now()) @map("available_at") @db.Timestamptz
  processedAt   DateTime?    @map("processed_at") @db.Timestamptz
  failedReason  String?      @map("failed_reason")
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  @@index([status, availableAt], map: "idx_outbox_events_status_available")
  @@index([eventType, status], map: "idx_outbox_events_type_status")
  @@index([aggregateType, aggregateId], map: "idx_outbox_events_aggregate")
  @@map("outbox_events")
}
```

---

# 3. Required raw SQL migration additions

Prisma schema alone is not enough for this database. The migration must include raw SQL for database-level constraints and PostGIS.

## 3.1 PostGIS extension

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## 3.2 GIST indexes for location

```sql
CREATE INDEX IF NOT EXISTS idx_user_locations_real_gist
ON user_locations
USING GIST (real_location);

CREATE INDEX IF NOT EXISTS idx_user_locations_passport_gist
ON user_locations
USING GIST (passport_location);
```

## 3.3 Partial unique indexes for profile photos

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_photos_user_sort_active
ON profile_photos(user_id, sort_order)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_photos_user_avatar_active
ON profile_photos(user_id)
WHERE is_avatar = true AND deleted_at IS NULL;
```

## 3.4 Check constraints Prisma cannot fully express

```sql
ALTER TABLE profiles
ADD CONSTRAINT chk_profiles_height_cm
CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 250));

ALTER TABLE discovery_preferences
ADD CONSTRAINT chk_discovery_preferences_age
CHECK (min_age >= 18 AND max_age >= min_age);

ALTER TABLE discovery_preferences
ADD CONSTRAINT chk_discovery_preferences_distance
CHECK (max_distance_km > 0);

ALTER TABLE swipe_events
ADD CONSTRAINT chk_swipe_events_not_self
CHECK (swiper_id <> target_user_id);

ALTER TABLE swipe_states
ADD CONSTRAINT chk_swipe_states_not_self
CHECK (swiper_id <> target_user_id);

ALTER TABLE matches
ADD CONSTRAINT chk_matches_not_self
CHECK (user_a_id <> user_b_id);

ALTER TABLE matches
ADD CONSTRAINT chk_matches_unread_counts
CHECK (unread_count_a >= 0 AND unread_count_b >= 0);

ALTER TABLE messages
ADD CONSTRAINT chk_messages_text_body
CHECK (
  (message_type = 'text' AND body IS NOT NULL)
  OR message_type <> 'text'
);

ALTER TABLE messages
ADD CONSTRAINT chk_messages_image_media_url
CHECK (
  (message_type = 'image' AND media_url IS NOT NULL)
  OR message_type <> 'image'
);

ALTER TABLE user_blocks
ADD CONSTRAINT chk_user_blocks_not_self
CHECK (blocker_id <> blocked_user_id);

ALTER TABLE user_reports
ADD CONSTRAINT chk_user_reports_not_self
CHECK (reporter_id <> reported_user_id);

ALTER TABLE payment_orders
ADD CONSTRAINT chk_payment_orders_amount
CHECK (amount > 0);

ALTER TABLE user_subscriptions
ADD CONSTRAINT chk_user_subscriptions_period
CHECK (current_period_end > current_period_start);

ALTER TABLE user_entitlements
ADD CONSTRAINT chk_user_entitlements_quantity
CHECK (quantity IS NULL OR quantity >= 0);

ALTER TABLE user_entitlements
ADD CONSTRAINT chk_user_entitlements_window
CHECK (
  window_end IS NULL
  OR (window_start IS NOT NULL AND window_end > window_start)
);

ALTER TABLE outbox_events
ADD CONSTRAINT chk_outbox_events_attempts
CHECK (attempts >= 0);
```

## 3.5 Match pair ordering

The application must always sort user pair IDs before inserting match:

```text
user_a_id = smaller UUID string
user_b_id = larger UUID string
```

Optional DB check can be added if desired:

```sql
ALTER TABLE matches
ADD CONSTRAINT chk_matches_pair_order
CHECK (user_a_id < user_b_id);
```

---

# 4. Review notes before applying to real schema

## 4.1 Prisma version check

Before using this draft, check installed Prisma version.

If Prisma < 5.18:

```text
Do not use @default(uuid(7)).
Generate UUIDv7 in application service layer.
```

## 4.2 PostGIS strategy check

Before migration, decide whether actual installed Prisma version supports native spatial type for your target usage.

For safe phase 1:

```text
Use Unsupported("geography(Point,4326)")?
Use raw SQL for location writes and discovery queries.
```

## 4.3 Circular FK note

This draft intentionally does not create Prisma relations for:

```text
matches.last_read_message_id_a
matches.last_read_message_id_b
```

Reason: avoiding circular relation complexity between `matches` and `messages` in phase 1.

Service must validate these IDs when updating read state.

## 4.4 Direct copy warning

Do not paste this into `schema.prisma` blindly.

The final implementation should be adapted to:

- current Prisma version
- existing project generator block
- current datasource style
- actual package.json scripts
- migration strategy
- RDS PostgreSQL version

---

# 5. Approval checklist

Before moving this into the real codebase:

- [ ] Prisma version supports `uuid(7)` or app-level UUIDv7 is chosen.
- [ ] PostGIS migration strategy is chosen.
- [ ] Raw SQL constraints are accepted.
- [ ] `UserLocation` raw SQL access pattern is accepted.
- [ ] `preferredGenders` as JSONB is accepted.
- [ ] `interestsJson` as JSONB is accepted.
- [ ] `lifestyleJson` as JSONB is accepted.
- [ ] `messages` only supports text/image.
- [ ] Notifications are in-app only.
- [ ] Entitlements table is kept.
- [ ] VNPAY payment flow is prepaid, not recurring.
