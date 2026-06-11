# PostgreSQL Schema Review Checklist v1

## CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial schema review checklist | Entire file |

---

## 0. Purpose

Use this checklist before converting the PostgreSQL logical schema into Prisma schema or migration files.

---

## 1. Global decisions

- [ ] UUID strategy is confirmed as UUIDv7.
- [ ] Physical PostgreSQL type is `uuid`.
- [ ] UUIDv7 generation location is decided: app-level vs DB-level.
- [ ] PostGIS is accepted for location.
- [ ] `timestamptz` is used for all business timestamps.
- [ ] No binary file is stored in PostgreSQL.
- [ ] No table is added only because it "might be useful later".

---

## 2. Auth/account

- [ ] `users.email_normalized` is unique.
- [ ] Email verification flow is supported.
- [ ] Pending email verification user can login/onboard but not become discoverable.
- [ ] `user_sessions` supports logout current device.
- [ ] `user_sessions` supports logout all devices.
- [ ] Raw refresh token is never stored.
- [ ] Raw security token is never stored.
- [ ] Soft delete + anonymization fields are present.

---

## 3. Profile/onboarding

- [ ] `profiles` is separate from `users`.
- [ ] `dob` is stored but not exposed to other users.
- [ ] `gender` enum is sufficient for phase 1.
- [ ] `relationship_goal` is included.
- [ ] `interests_json` is display-only in phase 1.
- [ ] `profile_photos` supports upload state.
- [ ] `profile_photos` supports moderation status.
- [ ] Max profile photos default 6 is represented by business rule/config.

---

## 4. Location/discovery

- [ ] `user_locations` uses PostGIS geography point.
- [ ] Exact location is never exposed to other users.
- [ ] No location history table in phase 1.
- [ ] `discovery_preferences` supports multi-gender preference.
- [ ] Hidden users are excluded from discovery.
- [ ] Blocked users are mutually invisible.
- [ ] Already-swiped users are excluded until recycle passes.

---

## 5. Swipe/match

- [ ] `swipe_events` stores immutable history.
- [ ] `swipe_states` stores current directional state.
- [ ] Pass recycle default 30 days is supported.
- [ ] Rewind only applies to last PASS.
- [ ] Like/super-like quota can be computed from `swipe_events`.
- [ ] `matches` has one lifetime record per pair.
- [ ] `matches` supports unmatch and block lifecycle.
- [ ] Duplicate match creation is prevented by unique pair constraint.

---

## 6. Chat

- [ ] `messages` supports text and image only.
- [ ] No GIF/voice support in phase 1.
- [ ] Message content is not logged.
- [ ] Only active matches can send messages.
- [ ] Unmatch/block prevents new messages.
- [ ] Conversation is hidden after unmatch/block.

---

## 7. Safety/moderation

- [ ] `user_blocks` supports active/revoked block.
- [ ] Block creates mutual invisibility.
- [ ] `user_reports` supports user/profile/photo/message/match targets.
- [ ] Report does not automatically block.
- [ ] Admin/moderator uses `users.user_role`, no RBAC tables.
- [ ] Moderation action uses `users.account_status` + `audit_logs`.

---

## 8. Payment/premium

- [ ] `payment_orders` stores VNPAY payment order.
- [ ] Payment history is kept permanently.
- [ ] Payment success processing is idempotent.
- [ ] `user_subscriptions` represents prepaid subscription, not recurring billing.
- [ ] `user_entitlements` is kept for feature-level access control.
- [ ] `subscription_plans` table is intentionally out of scope.
- [ ] PLUS_MONTHLY and GOLD_MONTHLY are app config/spec values.

---

## 9. Notification/audit/outbox

- [ ] `notifications` supports in-app notification.
- [ ] No `device_tokens` table in phase 1.
- [ ] Notification retention is 90 days.
- [ ] Notification does not store sensitive message content.
- [ ] `audit_logs` does not store secrets, tokens, exact location, or message body.
- [ ] `outbox_events` supports match/message/payment async processing.
- [ ] Outbox indexes support pending event polling.

---

## 10. Performance/index review

- [ ] Discovery has PostGIS GIST index.
- [ ] `users.account_status` and onboarding status are indexed.
- [ ] `profile_photos(user_id, moderation_status)` is indexed.
- [ ] `swipe_states(swiper_id, target_user_id)` is primary/unique.
- [ ] `swipe_events` supports quota and who-liked-me queries.
- [ ] `matches(user_a_id, status)` and `matches(user_b_id, status)` are indexed.
- [ ] `messages(match_id, created_at)` is indexed.
- [ ] `notifications(user_id, created_at)` is indexed.
- [ ] `outbox_events(status, available_at)` is indexed.

---

## 11. Review conclusion

Decision:

- [ ] Approved for Prisma mapping.
- [ ] Needs changes before Prisma mapping.

Reviewer notes:

```text

```
