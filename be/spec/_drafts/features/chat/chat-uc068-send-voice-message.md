# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Marked as Out of Scope / Future | Header |

---

# UC068: Gửi tin nhắn Voice (Ghi âm)

> **Status**: Out of Scope (Phase 1)
> **Revision**: Future Improvement / Out of Scope (Phase 1)
> - **LƯU Ý:** Tính năng này KHÔNG nằm trong database baseline hiện tại và CHƯA được implement trong phase này.
> - Giới hạn thời lượng ghi âm.

## 1. Context & Goal
Cho phép người dùng gửi tin nhắn thoại ngắn (voice note) giống WhatsApp/Telegram. Client ghi âm tại local, upload file audio lên Cloud Storage, sau đó gửi tin nhắn dạng `VOICE` chứa URL file. Mục tiêu là mở rộng phương thức giao tiếp cho người dùng ưa thích nói hơn gõ chữ.

## 2. Actors & Roles
- **Sender**: Người dùng ghi âm và gửi. Phải thuộc Match `ACTIVE`.

## 3. Out of Scope (Non-goals)
- Gọi thoại realtime (UC070 — Audio Call).
- Chuyển đổi speech-to-text.

## 4. Data Model Impact
- Ghi vào bảng `Message` với `type = VOICE`, `content` chứa URL audio file.
- Thêm trường `metadata` (JSON): `{ durationSeconds: number }` để UI hiển thị thanh progress.
- INSERT + UPDATE (Match).

## 5. Non-functional Requirements (NFR)

### 5.1 Performance SLA
| Metric | Target |
|---|---|
| Upload Audio File | ≤ 1000ms |
| Socket Event gửi message | ≤ 200ms |

### 5.2 Pagination
- Không áp dụng.

### 5.3 Security & Privacy
- Giới hạn dung lượng: **tối đa 10MB**.
- Giới hạn thời lượng ghi âm: **tối đa 120 giây** (2 phút).
- Chỉ chấp nhận định dạng: `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`.

### 5.4 Observability
- THE hệ thống SHALL ghi log `DEBUG`: `{ action: "MSG_VOICE_SENT", senderId, matchId, durationSeconds }`.

## 6. EARS Specifications & Business Rules
- **Pre-condition**: Sender thuộc Match `ACTIVE`. File audio đã ghi âm xong.
- **Rules**:
  - **Bước 1 (Upload)**: WHEN Sender gọi `POST /api/chat/:matchId/upload` với `type = VOICE`, THE hệ thống SHALL validate định dạng, kích thước, và thời lượng audio.
  - **Bước 2 (Gửi message)**: WHEN Sender phát sự kiện Socket `chat:sendMessage` với payload `{ matchId, type: "VOICE", content: "<audioUrl>", metadata: { durationSeconds } }`, THE hệ thống SHALL xử lý giống UC063 nhưng với type = VOICE.

## 7. Acceptance Criteria
- **AC1:** Upload + gửi voice thành công → Receiver nhận event kèm URL audio và duration.
- **AC2:** Audio quá 120 giây → Bị từ chối.
- **AC3:** File audio quá 10MB → Bị từ chối.

## 8. Error Handling (Edge Cases & Sad Paths)
- WHERE thời lượng audio vượt 120 giây, THE hệ thống SHALL trả về HTTP 400 "Ghi âm tối đa 120 giây".
- WHERE dung lượng quá 10MB, THE hệ thống SHALL trả về HTTP 413.
- WHERE định dạng audio không hợp lệ, THE hệ thống SHALL trả về HTTP 415.
