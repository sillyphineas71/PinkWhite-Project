# UC059: Tìm kiếm Match theo Tên

> **Revision**: v1 — Production-Grade
> - Lọc danh sách Match theo chuỗi từ khóa.
> - Case-insensitive.

## 1. Context & Goal
Khi người dùng có quá nhiều lượt Match, họ cần một thanh tìm kiếm để nhanh chóng tìm lại một người dùng cụ thể dựa trên tên hiển thị (Full Name) hoặc Bio. Mục tiêu là tối ưu hóa trải nghiệm UI/UX.

## 2. Actors & Roles
- **Active User**: Người dùng đang đăng nhập và có danh sách Match.

## 3. Out of Scope (Non-goals)
- Tìm kiếm theo tin nhắn Chat.
- Tìm kiếm người lạ ngoài danh sách Match.

## 4. Data Model Impact
- Join bảng `Match` và `Profile` để truy vấn theo trường `fullName`.
- Đọc. Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query (Search) | ≤ 200ms |

### 5.2 Pagination
- Không yêu cầu phân trang do kết quả tìm kiếm theo tên trong tập Match thường rất ít.

### 5.3 Security & Privacy
- Chỉ tìm kiếm trong phạm vi những người đã Match và ở trạng thái `ACTIVE`.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "SEARCH_MATCH", userId, keyword }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Từ khóa tìm kiếm `q` có độ dài tối thiểu 1 ký tự.
- **Rules**:
  - WHEN User gọi `GET /api/matches/search?q=<keyword>`, THE hệ thống SHALL:
    1. Tìm tất cả các Match `ACTIVE` của User hiện tại.
    2. Lọc ra các Match có đối phương sở hữu `fullName` chứa chuỗi `<keyword>` (iLike - không phân biệt hoa thường).
  - THE hệ thống SHALL trả về HTTP 200 kèm mảng kết quả.

## 7. Acceptance Criteria
- **AC1:** Tìm kiếm trả về kết quả → Nhập "John", trả về danh sách Match có chữ "John" trong tên.
- **AC2:** Tìm kiếm không có kết quả → Trả về mảng rỗng `[]`.
- **AC3:** Không phân biệt hoa thường → "john", "JOHN", "John" đều trả về kết quả giống nhau.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE tham số `q` bị thiếu hoặc rỗng, THE hệ thống SHALL trả về HTTP 400 Bad Request.
- WHERE `q` vượt quá 100 ký tự (chống spam query dài), THE hệ thống SHALL trả về HTTP 400.
