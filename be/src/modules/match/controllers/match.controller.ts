import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchService } from '../services/match.service';
import { GetMatchesQueryDto } from '../dto/get-matches-query.dto';
import { SearchMatchQueryDto } from '../dto/search-match-query.dto';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import {
  CurrentUser,
  AuthUser,
} from '../../auth/decorators/current-user.decorator';

@ApiTags('Match')
@ApiCookieAuth()
@Controller('matches')
@UseGuards(JwtAccessGuard)
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get()
  @ApiOperation({ summary: 'UC057: Đọc danh sách Match hiện có (phân trang)' })
  async getMatchList(
    @CurrentUser() user: AuthUser,
    @Query() query: GetMatchesQueryDto,
  ) {
    return this.matchService.getMatchList(
      user.userId,
      query.cursor,
      query.limit,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'UC059: Tìm kiếm Match theo tên đối phương' })
  async searchMatches(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchMatchQueryDto,
  ) {
    return this.matchService.searchMatches(user.userId, query.q);
  }

  @Get(':matchId/profile')
  @ApiOperation({
    summary: 'UC058: Xem chi tiết Profile của đối phương trong Match',
  })
  async getMatchProfile(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.getMatchProfile(user.userId, matchId);
  }

  @Post(':matchId/unmatch')
  @ApiOperation({ summary: 'UC060: Hủy Tương hợp (Unmatch)' })
  async unmatch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.unmatch(user.userId, matchId);
  }

  @Post(':matchId/rematch')
  @ApiOperation({
    summary:
      'UC061: Khôi phục Hủy Tương hợp (Rematch — Premium only - Disabled in Phase 4)',
  })
  async rematch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.rematch(user.userId, matchId);
  }
}
