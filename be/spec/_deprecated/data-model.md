# Auth Data Model

Trạng thái: draft.

Model dự kiến:

- User/Account.
- Credential hoặc password hash field.
- Session/RefreshToken nếu dùng refresh token rotation.

Constraint cần cân nhắc:

- Email unique.
- Account status enum.
- Refresh token hash, expiry, revoked state.

