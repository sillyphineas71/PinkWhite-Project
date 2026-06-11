import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
  NotImplementedException,
} from '@nestjs/common';
import { PhotoRepository, PhotoEntity } from '../repositories/photo.repository';
import { ConfirmPhotoUploadDto, ReorderPhotosDto } from '../dto/profile.dto';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProfileService } from './profile.service';

@Injectable()
export class PhotoService {
  constructor(
    private readonly photoRepo: PhotoRepository,
    private readonly profileService: ProfileService,
  ) {}

  async getPresignedUrl(userId: string): Promise<{ url: string }> {
    const count = await this.photoRepo.countByUserId(userId);
    if (count >= 6) {
      throw new BadRequestException('Đã đạt giới hạn tối đa 6 ảnh');
    }

    throw new NotImplementedException('S3 presigned URL generation not implemented in Phase 1');
  }

  async confirmUpload(
    userId: string,
    dto: ConfirmPhotoUploadDto,
  ): Promise<PhotoEntity> {
    const count = await this.photoRepo.countByUserId(userId);
    if (count >= 6) {
      throw new BadRequestException('Đã đạt giới hạn tối đa 6 ảnh');
    }

    const photo = await this.photoRepo.create(userId, dto.url, dto.isAvatar);

    // Evaluate onboarding
    await this.profileService.evaluateOnboarding(userId);

    return photo;
  }

  async getGallery(userId: string): Promise<PhotoEntity[]> {
    return this.photoRepo.findByUserId(userId);
  }

  async reorderPhotos(userId: string, dto: ReorderPhotosDto): Promise<void> {
    const currentPhotos = await this.photoRepo.findByUserId(userId);
    if (currentPhotos.length !== dto.photoIds.length) {
      throw new BadRequestException(
        'Mảng ID không khớp với số lượng ảnh hiện tại',
      );
    }

    // Verify all IDs belong to user
    const currentIds = currentPhotos.map((p) => p.id);
    const allMatch = dto.photoIds.every((id) => currentIds.includes(id));
    if (!allMatch) {
      throw new BadRequestException('Mảng ID không hợp lệ');
    }

    await this.photoRepo.updateOrder(userId, dto.photoIds);
  }

  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const currentPhotos = await this.photoRepo.findByUserId(userId);
    if (currentPhotos.length <= 1) {
      throw new BadRequestException(
        'Bắt buộc phải có tối thiểu 1 ảnh trong hồ sơ',
      );
    }

    const targetPhoto = currentPhotos.find((p) => p.id === photoId);
    if (!targetPhoto) {
      throw new BadRequestException('Không tìm thấy ảnh');
    }

    await this.photoRepo.delete(photoId);
    await this.photoRepo.normalizeOrder(userId);

    // Async trigger to delete from Cloud S3 (Mock)
    // this.queue.add('delete-s3-file', { url: targetPhoto.url });
  }
}
