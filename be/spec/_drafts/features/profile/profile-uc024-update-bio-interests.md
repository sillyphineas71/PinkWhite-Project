# UC024: Cập nhật Bio và Sở thích

> **Revision**: v2 — Production-Grade
> - Giới hạn 500 ký tự Bio. Tối đa 5 Sở thích.

## 1. Context & Goal
Cho phép User điền đoạn giới thiệu bản thân (Bio) và chọn các nhãn Sở thích (Interests) để tăng tỷ lệ Match.

## 2. Actors & Roles
- **User**: Người dùng sở hữu Profile.

## 3. Data Model Impact
- Cập nhật cột `bio` trong `Profile`.
- Tạo/Xóa các bản ghi liên kết trong bảng `ProfileInterest`.

## 4. Non-functional Requirements (NFR)
- **Security:** Chống XSS (Loại bỏ các thẻ HTML nhúng script nếu có).
- **Profanity Filter:** Tích hợp bộ lọc từ khóa (Banned words) và chặn tuyệt đối các đường link URL (http://, www, .com, .vn...) để chống spam/chèo kéo.
- DB Update (Kèm thao tác Many-to-Many): ≤ 50ms.

## 5. EARS Specifications & Business Rules
- **Rules**:
  - WHILE user thực hiện cập nhật Bio/Sở thích, THE Client SHALL gửi tham số `bio` và mảng `interestIds`.
  - IF `bio` vượt quá 500 ký tự, THEN hệ thống SHALL trả về HTTP 400 (Lỗi độ dài).
  - IF mảng `interestIds` chứa số lượng > 5 mục, THEN hệ thống SHALL trả về HTTP 400 (Chỉ được chọn tối đa 5 sở thích).
  - IF `bio` chứa các từ khóa cấm hoặc chứa URL/đường link, THEN hệ thống SHALL từ chối và trả về HTTP 400 (Nội dung vi phạm tiêu chuẩn cộng đồng).
  - THE hệ thống SHALL thực hiện cập nhật cột `bio`.
  - THE hệ thống SHALL xóa sạch các `ProfileInterest` cũ của user (nếu có) và Bulk Insert các `ProfileInterest` mới theo mảng ID gửi lên.

## 6. Acceptance Criteria
- **AC1:** Gửi Bio dài 501 ký tự → HTTP 400.
- **AC2:** Gửi mảng `[id1, id2, id3, id4, id5, id6]` → HTTP 400.
- **AC3:** Gửi Bio có chứa chuỗi "My IG: www.instagram.com/abc" → HTTP 400 "Không được phép chèn link".
- **AC3:** Cập nhật thành công → HTTP 200.
