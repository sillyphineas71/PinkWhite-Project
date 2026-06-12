import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwipeService } from '../services/swipe.service';
import { CreateSwipeDto } from '../dto/create-swipe.dto';
import { SwipeResponseDto } from '../dto/swipe-response.dto';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { CurrentUser, AuthUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Swipes')
@ApiCookieAuth()
@Controller('swipes')
@UseGuards(JwtAccessGuard)
export class SwipeController {
  constructor(private readonly swipeService: SwipeService) {}

  @Post()
  @ApiOperation({ summary: 'Phase 3: Submit a swipe action' })
  @ApiResponse({ type: SwipeResponseDto })
  async createSwipe(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSwipeDto,
  ): Promise<SwipeResponseDto> {
    return this.swipeService.processSwipe(user.userId, dto);
  }
}
