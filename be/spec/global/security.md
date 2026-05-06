# Security

- Mọi endpoint private phải có auth guard.
- Mọi mutation phải validate DTO.
- Không trả về password hash, token secret, hoặc internal credential.
- Permission rule phải được check ở service layer.
- Socket event phải xác thực user trước khi join room hoặc emit event riêng tư.
- CORS chỉ mở cho origin được cấu hình.

