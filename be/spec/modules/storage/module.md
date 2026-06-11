# CHANGELOG & REVISION HISTORY

| Date | Change Summary | Sections Changed |
|---|---|---|
| 2026-06-11 | Initial storage module spec | Toàn bộ file |

---

# Storage Module

## Goal
Abstraction layer cho photo upload. Cung cấp presigned URL để client upload trực tiếp lên storage provider, sau đó verify và confirm với backend.

## Responsibilities
- Generate presigned upload URL (hoặc upload token) cho client.
- Provide `uploadId` / `objectKey` do backend cấp — không tin raw URL từ client.
- Confirm upload sau khi client upload (backend verify object exists).
- Manage photo metadata (objectKey, status).
- Provider abstraction (local, S3, Cloudinary).
- Delete object khi photo bị xóa.

## Out of Scope
- Photo ordering (→ `profile` module).
- Photo approval workflow business logic (→ `profile` module).
- Chat media (Future Improvement).

## Main Business Rules
Xem chi tiết: `spec/global/business-rules.md` BR-04-03.

Key rules:
- Backend KHÔNG được tin raw URL do client tự điền.
- Upload flow: backend cấp uploadId → client upload → client confirm uploadId → backend verify.
- Photo status sau upload: `PENDING` cho đến khi approved.
- Không expose private storage URLs trực tiếp — phải dùng signed URLs có TTL.

## Privacy / Security Notes
- Không log private photo URLs.
- Presigned URLs phải có TTL ngắn (ví dụ: 5-15 phút).
- Chỉ owner mới được delete photo của mình.
- Storage URLs phải không guessable (dùng UUID trong objectKey).

## API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/storage/photos/upload | User | Initiate upload → trả presigned URL + uploadId |
| POST | /api/storage/photos/:uploadId/confirm | User | Confirm upload complete |
| DELETE | /api/storage/photos/:objectKey | User (owner) | Delete photo |

## Data Model Requirements
*(Concept only)*

**Storage reference (metadata, không phải actual file):**
Được tracked trong Photo entity của profile module.
- `objectKey` — unique key trong storage bucket
- `uploadId` — UUID do backend cấp khi initiate
- `status` — PENDING_UPLOAD → UPLOADED → APPROVED/REJECTED

## Provider Abstraction
```typescript
// Concept — không implement trong task này
interface StorageProvider {
  initiateUpload(contentType: string): Promise<{ uploadId: string, presignedUrl: string, objectKey: string }>
  confirmUpload(objectKey: string): Promise<boolean>
  deleteObject(objectKey: string): Promise<void>
  getSignedUrl(objectKey: string, ttl: number): Promise<string>
}
```

Implementations:
- `LocalStorageProvider` — dev only
- `S3StorageProvider` — production
- `CloudinaryProvider` — alternative (built-in transforms)

## Logging / Audit
- Log: upload initiated (userId, uploadId) — KHÔNG log presigned URL.
- Log: upload confirmed (userId, objectKey).
- Log: object deleted (userId, objectKey).

## Testing Notes
- Unit: upload flow (initiate → confirm → verify objectKey).
- Integration: mock storage provider — verify objectKey verification works.
- Security: confirm with wrong uploadId → 400/404. Confirm other user's uploadId → 403.

## Known Implementation Gaps
- **GAP-11:** Storage module CHƯA TỒN TẠI.
- Storage provider chưa được chọn.
- Photo upload flow chưa có end-to-end.

## Open Questions
- Storage provider: S3 hay Cloudinary? (xem OQ-04-03)
- Presigned URL TTL: 5 phút hay 15 phút?
- Có cần image optimization/resize không? (Cloudinary sẽ dễ hơn S3 cho điều này)
- Có giới hạn file size không? Content type nào được phép (JPEG, PNG, WEBP)?
