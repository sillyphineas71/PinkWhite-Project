# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Updated with resolved decisions after database schema baseline | Toàn bộ file |

---

# Open Questions — Dating / Social Matchmaking Platform

Tài liệu này theo dõi các quyết định kỹ thuật và sản phẩm. Được chia làm 3 phần: các quyết định đã chốt (Resolved), các câu hỏi còn mở (Still Open) và các vấn đề cho tương lai (Future).

---

## 1. Resolved Decisions

Các quyết định sau đã được chốt và thể hiện trong database baseline hiện tại:

- **ID Strategy:** UUIDv7
- **Database Stack:** PostgreSQL + PostGIS extension cho location/distance.
- **Soft Delete Policy:** Soft delete 30 days sau đó anonymize (xóa PII, giữ aggregated data).
- **Location History:** No location history phase 1, chỉ giữ active location mới nhất (real hoặc passport).
- **Chat Scope:** Message type hỗ trợ `text` + `image` only.
- **GIF/Voice:** No GIF/voice trong phase 1 (chưa có trong database baseline).
- **Notification:** Notification in-app only, không lưu device_tokens, chưa có push/FCM trong phase 1.
- **Notification Retention:** Giữ 90 days.
- **Payment Strategy:** VNPAY prepaid subscription (không auto-recurring). Schema đã chuẩn bị sẵn qua `payment_orders`, `user_subscriptions`, và `user_entitlements`.
- **Pass Recycle:** Recycle các profile đã "pass" sau default 30 days.
- **Rewind Logic:** Chỉ cho phép rewind lại lượt PASS cuối cùng nhất (the very last pass).
- **Quota Reset:** Quota tính theo rolling 24h kể từ lần sử dụng thay vì reset cứng theo calendar day.
- **Photo Workflow:** Photo tự động approve sau khi upload confirm, nhưng vẫn giữ field `moderation_status` để audit/report sau này.
- **Admin/Moderation Roles:** Sử dụng trực tiếp `user_role` trong bảng `users` (admin, moderator), không cần thiết kế bảng RBAC phức tạp.

---

## 2. Still Open Questions

Các câu hỏi cần được PM/Team chốt sớm để implement quota/logic layer:

### OQ-01: Free vs Premium Boundaries
**Question:** Scope cụ thể của gói Free và Premium (Tinder Plus/Gold) là gì?
- Who liked me: free chỉ thấy count (blurred)?
- Passport/fake location: chỉ premium?
- Super Like: có quota cho free không hay chỉ premium?
- Advanced filters (mutual filtering): premium only?

### OQ-02: Discovery Feed Ranking Algorithm
**Question:** Thuật toán nào dùng để sắp xếp candidate trong discovery feed phase 1?
- Pure random
- Distance-based (ưu tiên gần nhất)
- Activity-based (ưu tiên active gần đây)

### OQ-03: Message Retention
**Question:** Message data giữ bao lâu?
- Vô hạn
- 1 năm
- Hay 30 ngày sau khi unmatch/block?

### OQ-04: Report Moderation Workflow
**Question:** Quy trình xử lý report chi tiết:
- Bao nhiêu report thì trigger auto-review flag hoặc auto-suspend?
- Có gửi email notify cho user bị report không?

---

## 3. Future Questions

Các tính năng/vấn đề sau đã được xác định là nằm ngoài scope của Phase 1, sẽ giải quyết ở các phase sau:

### OQ-F01: Push Notifications (FCM/APNs)
- Sẽ cần thiết kế table `device_tokens` và worker để push message qua Firebase Cloud Messaging.

### OQ-F02: Advanced Chat Features
- Voice messages, GIFs, và message reactions.

### OQ-F03: IAP / Stripe Integration
- Apple/Google In-App Purchases và Stripe auto-recurring subscriptions.

### OQ-F04: User Verification (KYC)
- Tính năng selfie verification, xác thực CCCD/Government ID.

### OQ-F05: Score-based Matchmaking (ELO)
- Thuật toán ELO score cho discovery rank.

### OQ-F06: Redis Adapter cho WebSocket
- Cần thiết khi scale backend lên multiple instances (hiện tại single instance là đủ).
