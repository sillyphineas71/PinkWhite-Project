# Data Governance

Loại dữ liệu nhạy cảm:

- Thông tin đăng nhập.
- Thông tin profile cá nhân.
- Vị trí.
- Tin nhắn.
- Report/block/moderation data.

Quy tắc:

- Không log password, token, credential, nội dung nhạy cảm.
- Password phải hash trước khi lưu.
- Chat chỉ truy cập được bởi participant có active match.
- Block/report phải ảnh hưởng tới discovery, match, chat và notification.

