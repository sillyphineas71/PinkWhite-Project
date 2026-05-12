import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwipeService } from '../services/swipe.service';
import { SwipeTargetDto } from '../dto/swipe-target.dto';
import { SuperLikeMessageDto } from '../dto/super-like-message.dto';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { CurrentUser, AuthUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Swipe')
@ApiCookieAuth()
@Controller('swipe')
@UseGuards(JwtAccessGuard)
export class SwipeController {
  constructor(private readonly swipeService: SwipeService) {}

  @Post('like')
  @ApiOperation({ summary: 'UC047: Quẹt phải (Like)' })
  async like(@CurrentUser() user: AuthUser, @Body() dto: SwipeTargetDto) {
    return this.swipeService.like(user.userId, dto.targetId);
  }

  @Post('pass')
  @ApiOperation({ summary: 'UC048: Quẹt trái (Pass)' })
  async pass(@CurrentUser() user: AuthUser, @Body() dto: SwipeTargetDto) {
    return this.swipeService.pass(user.userId, dto.targetId);
  }

  @Post('superlike')
  @ApiOperation({ summary: 'UC049, UC051: Super Like có gửi kèm tin nhắn' })
  async superLike(@CurrentUser() user: AuthUser, @Body() dto: SuperLikeMessageDto) {
    return this.swipeService.superLike(user.userId, dto.targetId, dto.message);
  }

  @Post('superlike-no-message')
  @ApiOperation({ summary: 'UC049: Super Like KHÔNG gửi tin nhắn' })
  async superLikeNoMessage(@CurrentUser() user: AuthUser, @Body() dto: SwipeTargetDto) {
    return this.swipeService.superLike(user.userId, dto.targetId, null);
  }

  @Post('rewind')
  @ApiOperation({ summary: 'UC050: Rewind (Quay lại lượt quẹt cuối - Premium only)' })
  async rewind(@CurrentUser() user: AuthUser) {
    return this.swipeService.rewind(user.userId);
  }

  @Get('remaining')
  @ApiOperation({ summary: 'UC052: Kiểm tra số lượt quẹt còn lại' })
  async getRemainingLikes(@CurrentUser() user: AuthUser) {
    return this.swipeService.getRemainingLikes(user.userId);
  }

  @Get('who-liked-me')
  @ApiOperation({ summary: 'UC053, UC054: Xem ai đã thích tôi (Che mờ nếu Free)' })
  async getWhoLikedMe(@CurrentUser() user: AuthUser) {
    return this.swipeService.getWhoLikedMe(user.userId);
  }

  @Get('pass-history')
  @ApiOperation({ summary: 'UC055: Xem lịch sử đã Pass' })
  async getPassHistory(@CurrentUser() user: AuthUser) {
    return this.swipeService.getPassHistory(user.userId);
  }
}
