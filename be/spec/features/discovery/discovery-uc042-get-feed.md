# UC042: Lấy danh sách Feed (Discovery Feed)

> **Revision**: v1 — Production-Grade
> - Thuật toán lọc dựa trên Preferences (Tuổi, Giới tính, Khoảng cách).
> - Loại bỏ User đã quẹt, đã bị Block, đã Match.
> - Phân trang Cursor-based.

## 1. Context & Goal
Đây là API cốt lõi nhất của toàn bộ ứng dụng Dating. Khi User mở màn hình chính (Swipe Screen), hệ thống phải trả về danh sách các Profile tiềm năng phù hợp với bộ lọc Preferences của User. Danh sách này phải loại trừ tất cả User mà họ đã tương tác (Like/Pass/Block/Match) trước đó.

## 2. Actors & Roles
- **User**: Người dùng đã đăng nhập, đã hoàn tất Onboarding, đã có Preferences.

## 3. Out of Scope (Non-goals)
- AI/ML scoring, recommendation engine (giai đoạn sau).
- Advanced Filters (UC044 — Premium).
- Boost ranking (UC079).
- Hiển thị quảng cáo trong Feed.

## 4. Data Model Impact
- Đọc nhiều bảng: `User`, `Profile`, `Photo`, `Location`, `Preference`.
- Đọc bảng `Swipe` (để loại trừ người đã quẹt).
- Đọc bảng `Block` (để loại trừ người đã block/bị block).
- Đọc bảng `Match` (để loại trừ người đã match).
- Không INSERT/UPDATE.

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| DB Query (toàn bộ filter + join) | ≤ 200ms |
| API Response Time (p95) | ≤ 500ms |
| API Response Time (p99) | ≤ 800ms |
| Throughput | ≥ 50 req/s |

### 5.2 Pagination
- Sử dụng **Cursor-based pagination** (không dùng offset-based vì dữ liệu thay đổi liên tục).
- Mỗi trang trả về tối đa **20 profiles**.
- Client gửi `cursor` (là `userId` cuối cùng của trang trước) để lấy trang tiếp.

### 5.3 Security & Privacy
- Tuyệt đối không trả về `dob`, `email`, `passwordHash` của người khác.
- Chỉ trả về `age` (tính từ `dob`), `photos`, `bio`, `distance` (tính từ GPS).
- User ở chế độ Ẩn danh (`isHidden = true`) SHALL bị loại khỏi Feed (UC045).

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "FEED_QUERY", userId, resultCount, queryTimeMs, timestamp }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: User đã đăng nhập, `isOnboarded = true`, Preference đã tồn tại, Location đã có.
- **Rules**:
  - WHEN User gọi `GET /api/discovery/feed?cursor=<id>&limit=20`, THE hệ thống SHALL:
    1. Lấy Preferences của User (`minAge`, `maxAge`, `genderFilter`, `maxDistance`).
    2. Lấy Location hiệu lực của User (Real GPS hoặc Passport).
    3. Query danh sách User phù hợp với điều kiện:
       - `gender` của Target khớp với `genderFilter` của User (IF `genderFilter = ALL` thì bỏ qua filter này).
       - `age` của Target nằm trong khoảng `[minAge, maxAge]`.
       - Khoảng cách (Haversine) giữa User và Target ≤ `maxDistance` km.
       - Target KHÔNG nằm trong bảng `Swipe` (User đã Like/Pass Target trước đó).
       - Target KHÔNG nằm trong bảng `Block` (User đã block Target HOẶC Target đã block User).
       - Target KHÔNG nằm trong bảng `Match` (đã match rồi thì không hiện lại).
       - Target có `isOnboarded = true`, `isBanned = false`, `deletedAt = null`.
       - Target có `isHidden = false` (không ẩn danh — UC045).
       - Target PHẢI có ít nhất 1 Photo.
  - THE hệ thống SHALL sắp xếp kết quả theo thứ tự ưu tiên:
    1. **Boost Priority:** User mới đăng ký trong vòng **48 giờ** qua SHALL được đẩy lên đầu (New User Boost).
    2. **Distance Priority:** Sau đó sắp xếp theo khoảng cách gần nhất (ASC).
  - THE hệ thống SHALL trả về HTTP 200 kèm JSON:
    ```json
    {
      "data": [
        {
          "userId": "uuid",
          "fullName": "...",
          "age": 25,
          "bio": "...",
          "photos": [...],
          "distance": 3.5,
          "interests": [...]
        }
      ],
      "nextCursor": "uuid-of-last-item",
      "hasMore": true
    }
    ```

## 7. Acceptance Criteria
- **AC1:** User A (nam, tìm nữ, 20-30 tuổi, 50km) → Feed chỉ trả về nữ, 20-30 tuổi, trong vòng 50km, chưa từng quẹt.
- **AC2:** User A đã quẹt phải User B → User B không xuất hiện lại trong Feed.
- **AC3:** User C đã block User A → User C không xuất hiện trong Feed của A, và ngược lại.
- **AC4:** User D đang ẩn danh (`isHidden = true`) → Không xuất hiện trong Feed của ai.
- **AC5:** Feed trống (không có ai phù hợp) → HTTP 200 với `data: []` và `hasMore: false`.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE User chưa tạo Preferences, THE hệ thống SHALL trả về HTTP 400 "Vui lòng thiết lập Preferences trước khi xem Feed".
- WHERE User chưa có Location, THE hệ thống SHALL trả về HTTP 400 "Vui lòng bật GPS để tìm người xung quanh".
- WHERE `limit` > 50 hoặc ≤ 0, THE hệ thống SHALL clamp giá trị về khoảng hợp lệ [1, 50] mà không báo lỗi.
- WHERE `cursor` không tồn tại trong DB, THE hệ thống SHALL bỏ qua cursor và trả về từ đầu.
