import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import {
  CurrentUser,
  AuthUser,
} from '../../auth/decorators/current-user.decorator';

import { ProfileService } from '../services/profile.service';
import { PhotoService } from '../services/photo.service';
import { LocationService } from '../services/location.service';

import {
  OnboardingDto,
  UpdateBasicInfoDto,
  UpdateBioInterestsDto,
  UpdateEducationJobDto,
  ConfirmPhotoUploadDto,
  ReorderPhotosDto,
  UpdateLocationDto,
  UpdatePassportDto,
} from '../dto/profile.dto';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(JwtAccessGuard)
@ApiCookieAuth()
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly photoService: PhotoService,
    private readonly locationService: LocationService,
  ) {}

  // ==========================================
  // BASIC INFO & DETAILS
  // ==========================================

  @Post('onboarding')
  @ApiOperation({ summary: 'UC016: Onboarding (Bước 1)' })
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: OnboardingDto,
  ) {
    return this.profileService.createProfile(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'UC017, UC021, UC025, UC032: Đọc Aggregated Profile (Self)',
  })
  async getMyProfile(@CurrentUser() user: AuthUser) {
    const profile = await this.profileService.getProfile(user.userId, true);
    const photos = await this.photoService.getGallery(user.userId);
    const location = await this.locationService.getActiveLocation(user.userId);

    return { ...profile, photos, location };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'UC017, UC021, UC025, UC032: Đọc Aggregated Profile (Other User)',
  })
  async getUserProfile(@Param('id') userId: string) {
    const profile = await this.profileService.getProfile(userId, false);
    const photos = await this.photoService.getGallery(userId);
    // Usually we don't expose exact location to other users, maybe just distance.
    // We'll omit location here for privacy, handled by Match module later.

    return { ...profile, photos };
  }

  @Patch('basic-info')
  @ApiOperation({ summary: 'UC018: Cập nhật thông tin cơ bản (DOB, Gender)' })
  async updateBasicInfo(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBasicInfoDto,
  ) {
    return this.profileService.updateBasicInfo(user.userId, dto);
  }

  @Patch('bio-interests')
  @ApiOperation({ summary: 'UC024: Cập nhật Bio và Sở thích' })
  async updateBioInterests(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBioInterestsDto,
  ) {
    return this.profileService.updateBioInterests(user.userId, dto);
  }

  @Patch('education-job')
  @ApiOperation({ summary: 'UC031: Cập nhật Học vấn / Nghề nghiệp' })
  async updateEducationJob(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateEducationJobDto,
  ) {
    return this.profileService.updateEducationJob(user.userId, dto);
  }

  // ==========================================
  // PHOTOS
  // ==========================================

  @Post('photos/presigned')
  @ApiOperation({ summary: 'UC020: Xin URL Upload ảnh lên Cloud' })
  async getPresignedUrl(@CurrentUser() user: AuthUser) {
    return this.photoService.getPresignedUrl(user.userId);
  }

  @Post('photos/confirm')
  @ApiOperation({ summary: 'UC020: Xác nhận đã upload ảnh xong' })
  async confirmPhotoUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmPhotoUploadDto,
  ) {
    return this.photoService.confirmUpload(user.userId, dto);
  }

  @Put('photos/reorder')
  @ApiOperation({ summary: 'UC022: Thay đổi thứ tự ảnh' })
  async reorderPhotos(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.photoService.reorderPhotos(user.userId, dto);
  }

  @Delete('photos/:photoId')
  @ApiOperation({ summary: 'UC023: Xóa ảnh' })
  async deletePhoto(
    @CurrentUser() user: AuthUser,
    @Param('photoId') photoId: string,
  ) {
    return this.photoService.deletePhoto(user.userId, photoId);
  }

  // ==========================================
  // LOCATION
  // ==========================================

  @Patch('location')
  @ApiOperation({ summary: 'UC026: Cập nhật GPS thực' })
  async updateLocation(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationService.updateRealGPS(user.userId, dto);
  }

  @Get('location/active')
  @ApiOperation({ summary: 'UC027: Lấy tọa độ hiệu lực hiện tại' })
  async getActiveLocation(@CurrentUser() user: AuthUser) {
    return this.locationService.getActiveLocation(user.userId);
  }

  @Patch('passport')
  @ApiOperation({ summary: 'UC028: Cắm cờ Passport (Yêu cầu Premium)' })
  async updatePassport(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePassportDto,
  ) {
    return this.locationService.updatePassport(user.userId, dto);
  }
}
