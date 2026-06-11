# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Rewrite — expanded glossary cho dating/social matchmaking platform | Toàn bộ file |

---

# Glossary — Dating / Social Matchmaking Platform

Tài liệu này định nghĩa các thuật ngữ được dùng nhất quán trong toàn bộ spec và codebase.

---

## Core Entities

| Term | Definition |
|---|---|
| **Account** | Danh tính đăng nhập của user (email + password hash + account status). Khác với Profile. |
| **Profile** | Hồ sơ hiển thị trong discovery (name, age, bio, photos, interests, location). |
| **Session** | Một phiên đăng nhập gắn với một device/browser. Chứa refresh token. |
| **Preference** | Tiêu chí tìm kiếm của user (age range, gender, max distance). |
| **Swipe** | Hành động like/pass/super_like của user với một candidate. |
| **Match** | Quan hệ được tạo khi hai user cùng like nhau. |
| **Active Match** | Match còn hiệu lực, chưa unmatch/block. |
| **Conversation** | Kênh chat trong context của một match. |
| **Message** | Một tin nhắn trong conversation. |
| **Block** | Quan hệ mutual invisibility giữa hai user. |
| **Report** | Bản ghi báo cáo vi phạm của một user với user khác. |

---

## Account States

| State | Definition |
|---|---|
| `pending_email_verification` | User chưa verify email. Có thể login nhưng không discoverable. |
| `active` | Account bình thường, có thể login và sử dụng app. |
| `suspended` | Bị tạm dừng (có thể expire tự động). Không login được. |
| `banned` | Bị admin ban vĩnh viễn. Không login được. Không recoverable bởi user. |
| `deleted` | User tự xóa hoặc bị xóa. Không login được. Recoverable trong 30 ngày trước khi anonymize. |

---

## Photo States

| State | Definition |
|---|---|
| `PENDING` | Mới upload, chờ approval. |
| `APPROVED` | Đã được approve, visible trong discovery. |
| `REJECTED` | Bị reject, không visible. User phải upload lại. |

---

## Swipe Types

| Type | Definition |
|---|---|
| `LIKE` | Quẹt phải — user interested. |
| `PASS` | Quẹt trái — user not interested. |
| `SUPER_LIKE` | Vuốt lên — strong interest. Có quota riêng. |

---

## Match States

| State | Definition |
|---|---|
| `ACTIVE` | Match đang hiệu lực. Chat được phép. |
| `UNMATCHED` | Một trong 2 đã unmatch. Chat bị disable. |
| `BLOCKED` | Một trong 2 đã block. Chat bị disable. |

---

## User Roles

| Role | Definition |
|---|---|
| `Guest` | Chưa authenticated. Chỉ access public endpoints. |
| `User` | Đã authenticated. Có thể dùng tất cả user-facing features. |
| `Admin` | Internal role. Có thể ban/suspend/review. (Future Scope) |
| `Moderator` | Internal role. Có thể review reports, approve photos. (Future Scope) |

---

## Key Concepts

| Term | Definition |
|---|---|
| **Onboarding** | Quá trình user hoàn thành tất cả setup cần thiết để discoverable. |
| **Discoverable** | Trạng thái user có thể xuất hiện trong discovery feed của người khác. |
| **Discovery Feed** | Danh sách candidates được filter và gợi ý cho user để swipe. |
| **Mutual Like** | Khi cả 2 users đã like nhau — điều kiện tạo match. |
| **Idempotent** | Operation có thể gọi nhiều lần mà kết quả vẫn như nhau. |
| **Soft Delete** | Đánh dấu record là "deleted" nhưng không xóa khỏi DB. |
| **Hard Delete** | Xóa vĩnh viễn khỏi DB. |
| **Outbox Pattern** | Pattern lưu event vào DB trong cùng transaction với business operation, để async processor xử lý sau. |
| **Presigned URL** | URL có chữ ký tạm thời cho phép upload file trực tiếp lên storage, không qua server. |
| **Cursor Pagination** | Phân trang dùng opaque cursor thay vì page number. Tránh skip/duplicate khi data thay đổi. |
| **Rate Limiting** | Giới hạn số request trong khoảng thời gian để bảo vệ API. |
| **Enumeration Attack** | Tấn công thử dò xem email/username có tồn tại không dựa vào error message. |
| **SDD** | Spec-Driven Development — viết spec trước khi implement. |
| **PostGIS** | Extension của PostgreSQL hỗ trợ dữ liệu không gian (`geography`), thay thế cho các thuật toán thủ công như Haversine. |
| **Haversine Formula** | Công thức tính khoảng cách giữa 2 điểm (Legacy/Fallback utility, hệ thống chính dùng PostGIS). |
