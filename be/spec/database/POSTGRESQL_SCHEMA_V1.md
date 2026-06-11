# PostgreSQL Logical Schema v1 — Dating / Social Matchmaking Platform

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial PostgreSQL logical schema based on reviewed database baseline | Entire file |

---

## 0. Status of this document

This is a **review-ready PostgreSQL logical schema**, not an executable migration file yet.

Do not directly apply this file to a database.

Next steps:

```text
Review PostgreSQL Logical Schema v1
→ Adjust constraints/indexes if needed
→ Convert into Prisma schema
→ Review Prisma mapping
→ Create migration plan
→ Migrate into code/database
```

---

## 1. Final database direction

The database is optimized for:

- Compact schema, not enterprise over-normalization.
- Production-capable dating/social matchmaking backend.
- Privacy and safety first.
- PostgreSQL on AWS RDS.
- PostGIS for location/distance.
- UUIDv7 ID strategy.
- Cookie-based auth with refresh sessions.
- Event-driven direction using `outbox_events`.
- VNPAY prepaid subscription, not recurring billing.
- In-app notifications in this phase.

Final table count: **21 tables**.

---

## 2. Important architectural decisions

| Topic | Decision |
|---|---|
| Primary key strategy | UUIDv7 strategy, physical PostgreSQL type: `uuid` |
| UUID generation | Prefer app-level UUIDv7 if RDS PostgreSQL version does not support native `uuidv7()` |
| Soft delete | Soft delete 30 days, then anonymize |
| Location history | Not stored in phase 1 |
| Message edit | Not supported in phase 1 |
| Notification retention | 90 days |
| Payment history | Kept permanently for audit/reconciliation |
| Premium model | `user_subscriptions` + `user_entitlements` |
| Notification | In-app notification only |
| Chat media | Text + image only |
| Admin model | `users.user_role`, no RBAC tables in phase 1 |

---

## 3. PostgreSQL extensions

Recommended extensions:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Optional depending on final UUID generation approach:

```sql
-- Only if DB-side UUIDv7 generation is available/approved.
-- Otherwise generate UUIDv7 in the backend app.
```

### UUIDv7 note

Use `uuid` as the physical column type.

Logical strategy is UUIDv7 because it keeps public IDs hard to guess while improving index locality compared with random UUIDv4.

However, do not make the schema depend on native `uuidv7()` unless the selected AWS RDS PostgreSQL version supports it. If not, generate UUIDv7 in the NestJS backend and insert it explicitly.

---

## 4. Global column conventions

### 4.1 ID columns

```text
id uuid primary key
```

IDs are generated as UUIDv7 at application level unless DB-side generation is explicitly supported.

### 4.2 Time columns

Use:

```text
timestamptz
```

for all business timestamps.

### 4.3 JSON columns

Use:

```text
jsonb
```

for controlled flexible fields such as `lifestyle_json`, `interests_json`, `payload_json`, and `metadata_json`.

### 4.4 Soft delete

Tables with user-facing removable data should use:

```text
deleted_at timestamptz null
```

For user anonymization:

```text
users.deleted_at
users.deletion_scheduled_at
users.anonymized_at
```

---

## 5. Enum definitions

These are logical enums. They can be implemented as PostgreSQL enums or text fields with check constraints. For Prisma compatibility and easier iteration, using text + check constraints is acceptable in early phase.

### `account_status`

```text
pending_email_verification
active
suspended
banned
deleted
```

### `onboarding_status`

```text
not_started
in_progress
completed
```

### `user_role`

```text
user
moderator
admin
```

### `auth_provider`

```text
email
google
```

### `session_status`

```text
active
revoked
expired
compromised
```

### `security_token_type`

```text
email_verification
password_reset
account_restore
```

### `gender`

```text
male
female
non_binary
other
```

### `relationship_goal`

```text
long_term
short_term
friends
still_figuring_out
```

### `upload_status`

```text
pending
uploaded
confirmed
expired
```

### `moderation_status`

```text
pending
approved
rejected
```

### `active_location_mode`

```text
real
passport
```

### `swipe_action`

```text
like
pass
super_like
rewind
```

### `swipe_event_status`

```text
active
reverted
ignored
```

### `current_swipe_action`

```text
like
pass
super_like
```

### `match_status`

```text
active
unmatched
blocked
```

### `message_type`

```text
text
image
system
```

### `message_status`

```text
sent
deleted_by_sender
removed_by_moderation
```

### `block_status`

```text
active
revoked
```

### `report_target_type`

```text
user
profile
photo
message
match
```

### `report_status`

```text
pending
reviewing
resolved
dismissed
```

### `payment_provider`

```text
vnpay
```

### `payment_status`

```text
pending
paid
failed
expired
cancelled
```

### `payment_purpose`

```text
subscription_purchase
```

### `subscription_provider`

```text
vnpay
manual
```

### `subscription_status`

```text
active
expired
cancelled
```

### `entitlement_type`

```text
unlimited_likes
see_who_liked_me
rewind
passport
super_like_quota
hidden_mode
```

### `notification_type`

```text
match_created
new_message
super_like_received
profile_approved
payment_success
subscription_expiring
moderation_update
system
```

### `notification_delivery_status`

```text
pending
delivered
failed
```

### `outbox_status`

```text
pending
processing
processed
failed
dead
```

---

# 6. Table specifications

---

## 6.1 `users`

### Purpose

Stores account identity state and lifecycle. This table must not contain dating profile details such as bio, interests, photos, or location.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `email` | varchar(320) | yes | Original email for display/admin use |
| `email_normalized` | varchar(320) | yes | Lowercase canonical email |
| `email_verified_at` | timestamptz | no | Null until verified |
| `account_status` | text | yes | See enum |
| `onboarding_status` | text | yes | See enum |
| `user_role` | text | yes | `user`, `moderator`, `admin` |
| `last_login_at` | timestamptz | no | Updated on login |
| `onboarding_completed_at` | timestamptz | no | Set when onboarding is complete |
| `deleted_at` | timestamptz | no | Soft delete timestamp |
| `deletion_scheduled_at` | timestamptz | no | Usually deleted_at + 30 days |
| `anonymized_at` | timestamptz | no | Set after anonymization |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
primary key (id)
unique (email_normalized)
check account_status in (...)
check onboarding_status in (...)
check user_role in (...)
```

### Indexes

```text
idx_users_account_status(account_status)
idx_users_onboarding_status(onboarding_status)
idx_users_deleted_at(deleted_at)
idx_users_deletion_scheduled_at(deletion_scheduled_at)
```

### Business rules

- New email/password user starts with `account_status = pending_email_verification`.
- User can login and complete onboarding while pending verification.
- Pending email verification users are not discoverable.
- After email verification, `account_status` becomes `active`.
- Soft deleted users are not discoverable, cannot swipe, cannot chat, and cannot appear in search/feed.
- After 30 days, user data is anonymized, not hard deleted immediately.

---

## 6.2 `auth_identities`

### Purpose

Stores login methods such as email/password or Google OAuth.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users |
| `provider` | text | yes | `email`, `google` |
| `provider_user_id` | varchar(320) | yes | Email normalized or Google sub |
| `password_hash` | text | no | Only for email provider |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
unique (provider, provider_user_id)
unique (user_id, provider)
check provider in ('email', 'google')
```

### Indexes

```text
idx_auth_identities_user_id(user_id)
```

### Business rules

- Never store plain password.
- For Google provider, `password_hash` must be null.
- For email provider, `password_hash` must not be null.

---

## 6.3 `user_sessions`

### Purpose

Stores refresh token sessions for cookie-based authentication.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | Session ID; can be embedded as `sid` in access token |
| `user_id` | uuid | yes | FK to users |
| `refresh_token_hash` | text | yes | Never store raw refresh token |
| `refresh_token_family_id` | uuid | yes | Used to detect token reuse/family revocation |
| `session_status` | text | yes | active/revoked/expired/compromised |
| `user_agent` | text | no | Sanitized |
| `ip_hash` | text | no | Hashed IP, not raw IP if avoidable |
| `expires_at` | timestamptz | yes | Refresh token expiry |
| `last_used_at` | timestamptz | no | Updated on refresh |
| `revoked_at` | timestamptz | no |  |
| `revoked_reason` | text | no | logout, logout_all, reuse_detected |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
check session_status in (...)
```

### Indexes

```text
idx_user_sessions_user_status(user_id, session_status)
idx_user_sessions_refresh_family(refresh_token_family_id)
idx_user_sessions_expires_at(expires_at)
```

### Business rules

- Logout current device revokes the current session.
- Logout all devices revokes all active sessions for user.
- Refresh token rotation updates current session.
- Token reuse can mark session/family as compromised.

---

## 6.4 `security_tokens`

### Purpose

Stores short-lived token hashes for email verification, password reset, and account restore.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users |
| `token_type` | text | yes | email_verification/password_reset/account_restore |
| `token_hash` | text | yes | Never store raw token |
| `expires_at` | timestamptz | yes |  |
| `used_at` | timestamptz | no |  |
| `created_at` | timestamptz | yes |  |
| `metadata_json` | jsonb | no | Sanitized metadata |

### Constraints

```text
foreign key (user_id) references users(id)
check token_type in (...)
```

### Indexes

```text
idx_security_tokens_user_type(user_id, token_type)
idx_security_tokens_expires_at(expires_at)
idx_security_tokens_token_hash(token_hash)
```

### Business rules

- Raw tokens must never be stored.
- Used tokens cannot be reused.
- Expired tokens are invalid.
- Auth enumeration-sensitive flows must return generic responses.

---

## 6.5 `profiles`

### Purpose

Stores the dating profile details shown in profile/discovery/match contexts.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users, unique |
| `display_name` | varchar(80) | yes | No username in phase 1 |
| `dob` | date | yes | Only self/admin can see |
| `gender` | text | yes | male/female/non_binary/other |
| `bio` | varchar(500) | no |  |
| `job_title` | varchar(120) | no |  |
| `company` | varchar(120) | no |  |
| `school` | varchar(120) | no |  |
| `height_cm` | int | no | Optional |
| `relationship_goal` | text | yes | long_term/short_term/friends/still_figuring_out |
| `lifestyle_json` | jsonb | no | Controlled flexible lifestyle values |
| `interests_json` | jsonb | no | Array of interests for display only |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
unique (user_id)
check gender in (...)
check relationship_goal in (...)
check height_cm is null or height_cm between 100 and 250
```

### Indexes

```text
idx_profiles_user_id(user_id)
idx_profiles_gender(gender)
idx_profiles_dob(dob)
```

### Business rules

- `dob` is never exposed to other users.
- Other users see only calculated `age`.
- Age must be calculated correctly by full date, not by year subtraction.
- Interests are display-only in phase 1, not discovery filter.

---

## 6.6 `profile_photos`

### Purpose

Stores profile photo metadata and upload/moderation state.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users |
| `storage_provider` | text | yes | `s3`, `local`, etc. |
| `storage_key` | text | yes | S3 key or local key |
| `public_url` | text | no | Public/CDN URL if available |
| `mime_type` | varchar(100) | yes | image/* only |
| `size_bytes` | bigint | yes |  |
| `sort_order` | int | yes | 1..max photos |
| `is_avatar` | boolean | yes | One avatar per user |
| `upload_status` | text | yes | pending/uploaded/confirmed/expired |
| `moderation_status` | text | yes | pending/approved/rejected |
| `rejection_reason` | text | no |  |
| `approved_at` | timestamptz | no |  |
| `rejected_at` | timestamptz | no |  |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |
| `deleted_at` | timestamptz | no | Soft delete photo |

### Constraints

```text
foreign key (user_id) references users(id)
unique (user_id, sort_order) where deleted_at is null
unique (user_id) where is_avatar = true and deleted_at is null
check sort_order between 1 and 6 by default config
check upload_status in (...)
check moderation_status in (...)
```

### Indexes

```text
idx_profile_photos_user_order(user_id, sort_order)
idx_profile_photos_user_moderation(user_id, moderation_status)
idx_profile_photos_deleted_at(deleted_at)
```

### Business rules

- Max profile photos is config-driven, default 6.
- Version 1 auto-approves after confirm upload but keeps moderation fields for later.
- Discovery only uses approved photos.
- Client confirms upload by `photo_id`, not by raw external URL.
- Do not store binary image in PostgreSQL.

---

## 6.7 `user_locations`

### Purpose

Stores current real/passport location for discovery distance calculations.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users, unique |
| `real_location` | geography(Point, 4326) | no | Exact real location |
| `passport_location` | geography(Point, 4326) | no | Premium virtual location |
| `active_location_mode` | text | yes | real/passport |
| `accuracy_meters` | int | no | GPS accuracy |
| `is_mocked` | boolean | yes | Device mock flag if available |
| `updated_at` | timestamptz | yes |  |
| `created_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
unique (user_id)
check active_location_mode in ('real', 'passport')
check accuracy_meters is null or accuracy_meters >= 0
```

### Indexes

```text
idx_user_locations_real_gist using gist(real_location)
idx_user_locations_passport_gist using gist(passport_location)
idx_user_locations_user_id(user_id)
```

### Business rules

- Exact location is sensitive.
- API never exposes exact coordinates of other users.
- Feed returns rounded distance or distance label only.
- Passport mode requires `passport` entitlement.
- No location history in phase 1.

---

## 6.8 `discovery_preferences`

### Purpose

Stores user search preferences.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users, unique |
| `min_age` | int | yes | >= 18 |
| `max_age` | int | yes | >= min_age |
| `max_distance_km` | int | yes | e.g. 1..500 |
| `preferred_genders` | text[] or jsonb | yes | Multi-select gender |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
unique (user_id)
check min_age >= 18
check max_age >= min_age
check max_distance_km > 0
```

### Indexes

```text
idx_discovery_preferences_user_id(user_id)
```

### Business rules

- Multi-gender preference is supported.
- If user has no explicit preference, create default preference.
- Interest filtering is not supported in phase 1.

---

## 6.9 `user_privacy_settings`

### Purpose

Stores visibility/privacy settings.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users, unique |
| `is_hidden` | boolean | yes | Excluded from new discovery |
| `show_distance` | boolean | yes | Controls distance display |
| `show_online_status` | boolean | yes |  |
| `show_last_active` | boolean | yes |  |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
unique (user_id)
```

### Indexes

```text
idx_user_privacy_settings_user_id(user_id)
idx_user_privacy_settings_is_hidden(is_hidden)
```

### Business rules

- Hidden users are excluded from new discovery.
- Existing matches can still chat unless unmatched/blocked.
- Hidden mode may require entitlement.

---

## 6.10 `swipe_events`

### Purpose

Immutable swipe history.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `swiper_id` | uuid | yes | FK to users |
| `target_user_id` | uuid | yes | FK to users |
| `action` | text | yes | like/pass/super_like/rewind |
| `message` | varchar(500) | no | Optional super-like message |
| `status` | text | yes | active/reverted/ignored |
| `created_at` | timestamptz | yes |  |
| `reverted_at` | timestamptz | no | Set if reverted |
| `reverted_by_event_id` | uuid | no | FK to swipe_events |

### Constraints

```text
foreign key (swiper_id) references users(id)
foreign key (target_user_id) references users(id)
foreign key (reverted_by_event_id) references swipe_events(id)
check swiper_id <> target_user_id
check action in (...)
check status in (...)
```

### Indexes

```text
idx_swipe_events_swiper_target_created(swiper_id, target_user_id, created_at desc)
idx_swipe_events_target_action_created(target_user_id, action, created_at desc)
idx_swipe_events_swiper_action_created(swiper_id, action, created_at desc)
```

### Business rules

- No self swipe.
- Like/super-like quota uses rolling 24h count from this table.
- Rewind only applies to the latest PASS.
- Do not hard delete swipe history.

---

## 6.11 `swipe_states`

### Purpose

Current directional swipe state between two users.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `swiper_id` | uuid | yes | FK to users |
| `target_user_id` | uuid | yes | FK to users |
| `current_action` | text | yes | like/pass/super_like |
| `last_swipe_event_id` | uuid | yes | FK to swipe_events |
| `last_swiped_at` | timestamptz | yes |  |
| `recycle_after_at` | timestamptz | no | For pass recycle |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
primary key (swiper_id, target_user_id)
foreign key (swiper_id) references users(id)
foreign key (target_user_id) references users(id)
foreign key (last_swipe_event_id) references swipe_events(id)
check swiper_id <> target_user_id
check current_action in ('like', 'pass', 'super_like')
```

### Indexes

```text
idx_swipe_states_swiper_action(swiper_id, current_action)
idx_swipe_states_target_action(target_user_id, current_action)
idx_swipe_states_recycle_after(recycle_after_at)
```

### Business rules

- Discovery excludes already-swiped targets until recycle allows them back.
- Pass recycle default is 30 days.
- Like/super-like usually do not recycle.
- Rewind may remove/update state depending on last PASS state.

---

## 6.12 `matches`

### Purpose

Stores one lifetime match record per user pair.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_a_id` | uuid | yes | Lower/sorted UUID string |
| `user_b_id` | uuid | yes | Higher/sorted UUID string |
| `status` | text | yes | active/unmatched/blocked |
| `matched_at` | timestamptz | no |  |
| `unmatched_at` | timestamptz | no |  |
| `unmatched_by_user_id` | uuid | no | FK to users |
| `blocked_by_user_id` | uuid | no | FK to users |
| `last_message_at` | timestamptz | no |  |
| `last_interaction_at` | timestamptz | no |  |
| `unread_count_a` | int | yes | Default 0 |
| `unread_count_b` | int | yes | Default 0 |
| `last_read_message_id_a` | uuid | no | FK to messages, nullable |
| `last_read_message_id_b` | uuid | no | FK to messages, nullable |
| `last_read_at_a` | timestamptz | no |  |
| `last_read_at_b` | timestamptz | no |  |
| `created_from_swipe_event_id` | uuid | no | FK to swipe_events |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_a_id) references users(id)
foreign key (user_b_id) references users(id)
foreign key (unmatched_by_user_id) references users(id)
foreign key (blocked_by_user_id) references users(id)
foreign key (created_from_swipe_event_id) references swipe_events(id)
unique (user_a_id, user_b_id)
check user_a_id <> user_b_id
check status in (...)
check unread_count_a >= 0
check unread_count_b >= 0
```

Note: FKs from `last_read_message_id_a/b` to `messages(id)` can create circular migration order. They may be added after creating `messages`, or kept without DB-level FK in phase 1 and enforced in service.

### Indexes

```text
idx_matches_user_a_status(user_a_id, status)
idx_matches_user_b_status(user_b_id, status)
idx_matches_last_message_at(last_message_at desc)
idx_matches_status(status)
```

### Business rules

- One lifetime match record per pair.
- Rematch reuses the existing match record.
- Unmatch does not delete data.
- Block sets match status to `blocked`.
- Chat only works when match status is `active`.
- After unmatch/block, user cannot send new messages.

---

## 6.13 `messages`

### Purpose

Stores chat messages for active matches.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `match_id` | uuid | yes | FK to matches |
| `sender_id` | uuid | yes | FK to users |
| `message_type` | text | yes | text/image/system |
| `body` | text | no | Text body; not logged |
| `media_url` | text | no | Image URL for image message |
| `status` | text | yes | sent/deleted_by_sender/removed_by_moderation |
| `created_at` | timestamptz | yes |  |
| `deleted_at` | timestamptz | no |  |

### Constraints

```text
foreign key (match_id) references matches(id)
foreign key (sender_id) references users(id)
check message_type in ('text', 'image', 'system')
check status in (...)
check body is not null when message_type = 'text'
check media_url is not null when message_type = 'image'
```

### Indexes

```text
idx_messages_match_created(match_id, created_at desc)
idx_messages_sender_created(sender_id, created_at desc)
idx_messages_status(status)
```

### Business rules

- No GIF, no voice in phase 1.
- Only active matches can send new messages.
- Message content must not be logged.
- After unmatch/block, conversation is hidden from normal inbox.
- Messages are kept for moderation/audit retention.

---

## 6.14 `user_blocks`

### Purpose

Stores block relationships.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `blocker_id` | uuid | yes | FK to users |
| `blocked_user_id` | uuid | yes | FK to users |
| `status` | text | yes | active/revoked |
| `created_at` | timestamptz | yes |  |
| `revoked_at` | timestamptz | no |  |

### Constraints

```text
foreign key (blocker_id) references users(id)
foreign key (blocked_user_id) references users(id)
unique (blocker_id, blocked_user_id)
check blocker_id <> blocked_user_id
check status in ('active', 'revoked')
```

### Indexes

```text
idx_user_blocks_blocker_status(blocker_id, status)
idx_user_blocks_blocked_status(blocked_user_id, status)
```

### Business rules

- Block creates mutual invisibility.
- Block disables messages and notifications between the pair.
- If match exists, match status becomes `blocked`.
- Do not reveal clearly to the blocked user that they were blocked.

---

## 6.15 `user_reports`

### Purpose

Stores reports against users or user-generated content.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `reporter_id` | uuid | yes | FK to users |
| `reported_user_id` | uuid | yes | FK to users |
| `target_type` | text | yes | user/profile/photo/message/match |
| `target_id` | uuid | yes | ID of target object |
| `reason` | text | yes | Controlled reason in app layer |
| `description` | text | no | User-provided details |
| `status` | text | yes | pending/reviewing/resolved/dismissed |
| `created_at` | timestamptz | yes |  |
| `resolved_at` | timestamptz | no |  |
| `resolved_by_admin_id` | uuid | no | FK to users |
| `resolution_note` | text | no |  |

### Constraints

```text
foreign key (reporter_id) references users(id)
foreign key (reported_user_id) references users(id)
foreign key (resolved_by_admin_id) references users(id)
check reporter_id <> reported_user_id
check target_type in (...)
check status in (...)
```

### Indexes

```text
idx_user_reports_reported_status(reported_user_id, status)
idx_user_reports_reporter_created(reporter_id, created_at desc)
idx_user_reports_status_created(status, created_at desc)
```

### Business rules

- Report does not automatically block.
- UI may offer block after reporting.
- Admin action is represented by `users.account_status` update + `audit_logs`.
- Sensitive report details should not be logged outside this table.

---

## 6.16 `payment_orders`

### Purpose

Stores VNPAY payment orders and callback state.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users |
| `provider` | text | yes | vnpay |
| `order_code` | varchar(100) | yes | Internal unique order code |
| `amount` | numeric(12,2) | yes |  |
| `currency` | char(3) | yes | VND likely |
| `payment_status` | text | yes | pending/paid/failed/expired/cancelled |
| `purpose` | text | yes | subscription_purchase |
| `plan_code` | varchar(50) | yes | PLUS_MONTHLY/GOLD_MONTHLY |
| `provider_order_ref` | text | no | VNPAY order reference if any |
| `provider_transaction_no` | text | no | VNPAY transaction number |
| `provider_response_code` | text | no | VNPAY response code |
| `provider_payload_json` | jsonb | no | Sanitized callback payload |
| `paid_at` | timestamptz | no |  |
| `expired_at` | timestamptz | no |  |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
unique (order_code)
check provider = 'vnpay'
check payment_status in (...)
check purpose = 'subscription_purchase'
check amount > 0
```

### Indexes

```text
idx_payment_orders_user_created(user_id, created_at desc)
idx_payment_orders_status_created(payment_status, created_at desc)
idx_payment_orders_provider_tx(provider_transaction_no)
```

### Business rules

- Payment history is kept permanently.
- VNPAY callback/IPN must be idempotent.
- Only `paid` payment order can activate subscription/entitlements.
- Do not store provider secret in payload JSON.
- VNPAY is prepaid subscription, not recurring billing in phase 1.

---

## 6.17 `user_subscriptions`

### Purpose

Stores active/expired prepaid premium subscriptions.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users |
| `payment_order_id` | uuid | no | FK to payment_orders, nullable for manual grant |
| `provider` | text | yes | vnpay/manual |
| `plan_code` | varchar(50) | yes | PLUS_MONTHLY/GOLD_MONTHLY |
| `status` | text | yes | active/expired/cancelled |
| `current_period_start` | timestamptz | yes |  |
| `current_period_end` | timestamptz | yes |  |
| `cancel_at_period_end` | boolean | yes | Default false |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
foreign key (payment_order_id) references payment_orders(id)
check provider in ('vnpay', 'manual')
check status in (...)
check current_period_end > current_period_start
```

### Indexes

```text
idx_user_subscriptions_user_status(user_id, status)
idx_user_subscriptions_period_end(current_period_end)
idx_user_subscriptions_payment_order(payment_order_id)
```

### Business rules

- PLUS_MONTHLY and GOLD_MONTHLY are defined in app config/spec, not a DB table in phase 1.
- VNPAY subscription is prepaid, not automatically recurring.
- Expired subscriptions should stop granting active entitlements.

---

## 6.18 `user_entitlements`

### Purpose

Stores concrete premium abilities granted to a user.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | FK to users |
| `subscription_id` | uuid | no | FK to user_subscriptions |
| `entitlement_type` | text | yes | see enum |
| `quantity` | int | no | For quota-like entitlement |
| `window_start` | timestamptz | no | For quota window |
| `window_end` | timestamptz | no | For quota window |
| `expires_at` | timestamptz | no | Null for non-expiring manual grants if allowed |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (user_id) references users(id)
foreign key (subscription_id) references user_subscriptions(id)
check entitlement_type in (...)
check quantity is null or quantity >= 0
check window_end is null or window_start is not null
check window_end is null or window_end > window_start
```

### Indexes

```text
idx_user_entitlements_user_type_expiry(user_id, entitlement_type, expires_at)
idx_user_entitlements_subscription(subscription_id)
```

### Business rules

- Entitlement is what the user can actually use.
- Subscription is what the user purchased.
- Example: GOLD_MONTHLY grants `see_who_liked_me`, `passport`, `rewind`, `hidden_mode`, `super_like_quota`.
- API should check entitlements, not just plan code.
- Keeping this table reduces future migration pain for gifts/trials/manual grants.

---

## 6.19 `notifications`

### Purpose

Stores in-app notifications.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `user_id` | uuid | yes | Recipient |
| `type` | text | yes | notification type |
| `title` | varchar(160) | yes |  |
| `body` | varchar(500) | no | Avoid sensitive details |
| `payload_json` | jsonb | no | Lightweight routing data |
| `delivery_status` | text | yes | pending/delivered/failed |
| `read_at` | timestamptz | no |  |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |
| `expires_at` | timestamptz | yes | created_at + 90 days |

### Constraints

```text
foreign key (user_id) references users(id)
check type in (...)
check delivery_status in (...)
```

### Indexes

```text
idx_notifications_user_created(user_id, created_at desc)
idx_notifications_user_read(user_id, read_at)
idx_notifications_expires_at(expires_at)
```

### Business rules

- Phase 1 notification is in-app only.
- Notification retention is 90 days.
- Do not store message body content in notification body.
- Notification is not source of truth. Source of truth remains match/message/payment/report tables.

---

## 6.20 `audit_logs`

### Purpose

Stores important security/business audit events.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `actor_user_id` | uuid | no | Null for system actor |
| `action` | text | yes | Controlled audit action |
| `target_type` | text | no | user/match/payment/etc. |
| `target_id` | uuid | no |  |
| `metadata_json` | jsonb | no | Sanitized metadata |
| `ip_hash` | text | no |  |
| `user_agent` | text | no | Sanitized |
| `created_at` | timestamptz | yes |  |

### Constraints

```text
foreign key (actor_user_id) references users(id)
```

### Indexes

```text
idx_audit_logs_actor_created(actor_user_id, created_at desc)
idx_audit_logs_target(target_type, target_id)
idx_audit_logs_action_created(action, created_at desc)
```

### Business rules

Never log:

- password
- access token
- refresh token
- exact location
- message body
- private upload secret
- VNPAY secret

Audit candidates:

- login success/failure
- logout/logout all
- password changed
- email verified
- account deleted/restored/anonymized
- location updated
- profile hidden
- match created
- unmatch
- block/unblock
- report submitted
- payment paid/failed
- subscription activated
- moderator/admin action

---

## 6.21 `outbox_events`

### Purpose

Stores reliable internal events for async processing.

### Columns

| Column | Type | Required | Notes |
|---|---:|---:|---|
| `id` | uuid | yes | UUIDv7 strategy |
| `aggregate_type` | text | yes | user/swipe/match/message/payment/etc. |
| `aggregate_id` | uuid | yes | ID of related aggregate |
| `event_type` | text | yes | e.g. swipe.created |
| `payload_json` | jsonb | yes | Event payload |
| `status` | text | yes | pending/processing/processed/failed/dead |
| `attempts` | int | yes | Default 0 |
| `available_at` | timestamptz | yes | For retry scheduling |
| `processed_at` | timestamptz | no |  |
| `failed_reason` | text | no | Short sanitized error |
| `created_at` | timestamptz | yes |  |
| `updated_at` | timestamptz | yes |  |

### Constraints

```text
check status in (...)
check attempts >= 0
```

### Indexes

```text
idx_outbox_events_status_available(status, available_at)
idx_outbox_events_type_status(event_type, status)
idx_outbox_events_aggregate(aggregate_type, aggregate_id)
```

### Business rules

- Important side effects should use outbox events.
- Swipe like creates `swipe.created`.
- Match processor consumes `swipe.created` and creates match idempotently.
- Match creation creates `match.created`.
- Message creation creates `message.created`.
- Payment success creates `payment.paid`.
- Notification creation can be triggered from outbox.

---

# 7. Discoverability rule

A user is discoverable only if all are true:

```text
users.account_status = active
users.email_verified_at is not null
users.onboarding_status = completed
users.deleted_at is null
users.anonymized_at is null
profile exists
at least 1 profile_photos row where moderation_status = approved and deleted_at is null
user_locations has active usable location
discovery_preferences exists
user_privacy_settings.is_hidden = false
no active block between requester and target
requester has not swiped target unless recycle_after_at has passed
target fits requester age/gender/distance preferences
target is not requester
```

---

# 8. Important query strategies

## 8.1 Discovery query

Use PostGIS distance filtering:

```text
ST_DWithin(target_active_location, requester_active_location, max_distance_meters)
```

Then calculate rounded distance for response.

Important filters:

- active account
- completed onboarding
- approved photo exists
- not hidden
- not blocked either direction
- not already swiped unless pass recycle is over
- age/gender/distance preference

## 8.2 Who liked me

For free users:

- Return count only or blurred/generic preview.
- Do not return real user IDs/photos.

Source:

```text
swipe_states where target_user_id = current_user_id and current_action in ('like', 'super_like')
```

Exclude blocked/deleted/banned users.

## 8.3 Match list

Fetch matches where:

```text
(user_a_id = current_user_id or user_b_id = current_user_id)
and status = active
```

Order by:

```text
last_message_at desc nulls last, matched_at desc
```

## 8.4 Message list

Fetch messages by match id after checking current user belongs to the active match.

Cursor pagination by:

```text
created_at desc, id desc
```

---

# 9. Transaction boundaries

## 9.1 Register

```text
create users
create auth_identities
create default user_privacy_settings
create default discovery_preferences
create security_tokens email_verification
create audit_logs
create outbox_events email_verification_requested if email sending is async
```

## 9.2 Verify email

```text
validate security token
set security_tokens.used_at
set users.email_verified_at
if users.account_status = pending_email_verification -> active
create audit_logs
```

## 9.3 Complete onboarding

```text
upsert profile
confirm approved photo exists
confirm active location exists
confirm discovery preference exists
set users.onboarding_status = completed
set users.onboarding_completed_at
create audit_logs
```

## 9.4 Like / Pass / Super Like

```text
validate requester and target eligibility
create swipe_events
upsert swipe_states
set recycle_after_at if PASS
create outbox_events swipe.created for like/super_like
```

## 9.5 Rewind

```text
find latest active PASS event
mark it reverted
create swipe_events rewind
remove/update corresponding swipe_states
create audit_logs optional
```

## 9.6 Match processor

```text
consume swipe.created
check opposite swipe_state is like/super_like
create/update matches idempotently
create outbox_events match.created
create notifications
mark event processed
```

## 9.7 Send message

```text
check active match
create messages
update matches.last_message_at/last_interaction_at
increment receiver unread count
create outbox_events message.created
create notifications if allowed
```

## 9.8 Unmatch

```text
update matches.status = unmatched
set unmatched_at and unmatched_by_user_id
create audit_logs
create outbox_events match.unmatched
```

## 9.9 Block

```text
upsert user_blocks active
update existing match to blocked
create audit_logs
create outbox_events user.blocked
```

## 9.10 VNPAY payment success

```text
find payment_orders by order_code/provider reference
idempotently set payment_status = paid
create/update user_subscriptions
create user_entitlements
create notification payment_success
create audit_logs
create outbox_events payment.paid
```

---

# 10. Out of scope for phase 1

Do not add these tables yet unless explicitly approved:

```text
roles
permissions
user_roles
role_permissions
subscription_plans
media_files
device_tokens
notification_recipients
message_reactions
match_events
moderation_actions
profile_views
profile_boosts
user_usage_counters
user_location_history
```

---

# 11. Review risks

## 11.1 UUIDv7 on AWS RDS

Physical type is `uuid`, but generation strategy depends on selected RDS PostgreSQL version.

Safe approach:

```text
Generate UUIDv7 in NestJS application layer.
```

Do not block schema design on native database UUIDv7 support.

## 11.2 Circular FK between matches and messages

`matches.last_read_message_id_a/b` points to messages, while messages points to matches.

Options:

1. Add FK after both tables exist.
2. Keep DB-level FK out for these read pointer fields in phase 1.
3. Move read state to separate table later if needed.

Recommendation for phase 1:

```text
Do not add DB-level FK for last_read_message_id_a/b yet.
Enforce by service logic.
```

## 11.3 Discovery performance

PostGIS GIST index is mandatory for location queries.

Avoid scanning all profiles in application memory.

## 11.4 Notification content privacy

Do not store sensitive message content in notification body.

---

# 12. Final recommendation

This schema is ready for reviewer debate.

Do not migrate yet.

Next step:

```text
Review this document
→ Approve/adjust constraints and indexes
→ Convert to Prisma schema
→ Review Prisma schema
→ Create migration
```
