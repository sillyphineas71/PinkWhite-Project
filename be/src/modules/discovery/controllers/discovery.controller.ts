import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiscoveryService } from '../services/discovery.service';
import { CreatePreferenceDto } from '../dto/create-preference.dto';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { GetFeedQueryDto } from '../dto/get-feed-query.dto';
import { ToggleVisibilityDto } from '../dto/toggle-visibility.dto';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { CurrentUser, AuthUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Discovery')
@ApiCookieAuth()
@Controller('discovery')
@UseGuards(JwtAccessGuard)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('preferences')
  @ApiOperation({ summary: 'UC039: Tạo mới Preferences' })
  async createPreferences(@CurrentUser() user: AuthUser, @Body() dto: CreatePreferenceDto) {
    return this.discoveryService.createPreferences(user.userId, dto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'UC040: Lấy Preferences hiện tại' })
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.discoveryService.getPreferences(user.userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'UC041: Cập nhật Preferences' })
  async updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferenceDto) {
    return this.discoveryService.updatePreferences(user.userId, dto);
  }

  @Post('visibility/toggle')
  @ApiOperation({ summary: 'UC045: Bật/Tắt chế độ ẩn danh (Premium only)' })
  async toggleVisibility(@CurrentUser() user: AuthUser, @Body() dto: ToggleVisibilityDto) {
    return this.discoveryService.toggleVisibility(user.userId, dto.isHidden);
  }

  @Get('visibility')
  @ApiOperation({ summary: 'UC046: Xem trạng thái ẩn danh hiện tại' })
  async getVisibility(@CurrentUser() user: AuthUser) {
    return this.discoveryService.getVisibility(user.userId);
  }

  @Get('feed')
  @ApiOperation({ summary: 'UC042: Lấy danh sách Feed (Người dùng tiềm năng)' })
  async getFeed(@CurrentUser() user: AuthUser, @Query() query: GetFeedQueryDto) {
    return this.discoveryService.getFeed(user.userId, query);
  }
}
