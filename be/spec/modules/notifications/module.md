# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial notifications module spec | Toàn bộ file |

---

# Notifications Module

## Goal
Abstraction layer cho việc gửi notifications (push, in-app, email). Cung cấp boundary rõ ràng để các module khác không gửi notification trực tiếp.

## Responsibilities
- Interface/abstraction cho notification (In-app only trong phase 1).
- Interface cho in-app notification.
- Interface cho email notification.
- Suppression rules (không gửi cho blocked/unmatched/deleted).
- Notification preference check.

## Out of Scope
- Business logic quyết định KÊNH NÀO gửi notification — đó là caller's responsibility.
- Notification settings UI (Future Improvement).
- In-app notifications are schema-ready.
- Push/FCM/APNs/device_tokens are future/out of scope.

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-11.

Key rules:
- Notification KHÔNG gửi trực tiếp từ mọi service — phải qua notification boundary.
- Không gửi cho blocked pair.
- Không gửi cho unmatched/deleted/banned account.
- Match created, new message, super like, moderation update là candidates.

## Privacy / Security Notes
- Notification content không được expose sensitive data (message content, exact location).
- Push notification payload phải minimal — chỉ "bạn có tin nhắn mới", không include content.
- Device tokens phải được lưu securely, không expose qua API.

## API Surface (Internal)
*Notifications module không có user-facing REST API hiện tại.*

Internal interface:
```typescript
// Concept only
interface NotificationService {
  sendMatchNotification(userIdA: string, userIdB: string, matchId: string): Promise<void>
  sendMessageNotification(recipientId: string, matchId: string): Promise<void>
  sendSuperLikeNotification(targetId: string): Promise<void>
}
```

## Data Model Requirements

**Notification entity (`notifications`):**
- `id` (UUIDv7)
- `user_id` (FK → User)
- `type` (enum: match_created, new_message, super_like_received, profile_approved, payment_success, subscription_expiring, moderation_update, system)
- `title`
- `body`
- `payload_json` (jsonb)
- `delivery_status` (enum: pending, delivered, failed)
- `read_at` (nullable)
- `expires_at` (required, default = created_at + 90 days)
- `created_at`
- `updated_at`

## Logging / Audit
- Log: notification sent type, recipientId (KHÔNG log content).
- Log: notification suppressed (reason: blocked/unmatched).

## Testing Notes
- Unit: suppression rules (blocked pair → no notification sent).
- Integration: notification service mock — verify calls are made with correct recipients.

## Known Implementation Gaps
- **GAP-12:** NotificationsService luôn throw Error — chưa implement runtime thật, dù table `notifications` đã sẵn sàng.
- Push notification (FCM) là out of scope phase 1.

## Open Questions
- Email notifications: có cần không? Khi nào? (match? Security alert?)
- Push notification provider: Firebase hay alternative? (Future scope)
- Notification preference: user có thể tắt từng loại notification không?
