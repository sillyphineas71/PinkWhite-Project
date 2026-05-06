import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import express from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import {
  VerifyEmailRequestDto,
  VerifyEmailConfirmDto,
} from '../dto/verify-email.dto';
import { DeleteAccountDto } from '../dto/delete-account.dto';
import { JwtAccessGuard } from '../guards/jwt-access.guard';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // UC001: Register
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (Bước 1)' })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  // UC002: Login
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập (Bước 3 - Sau khi xác thực email)' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
    @Req() req: express.Request,
  ) {
    return this.authService.login(dto.email, dto.password, res, req);
  }

  // UC003: Logout
  @Post('logout')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Đăng xuất (Yêu cầu có Access Token Cookie)' })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: express.Response,
    @Req() req: express.Request,
  ) {
    return this.authService.logout(
      user.userId,
      res,
      (req as any).cookies?.refresh_token,
    );
  }

  // UC004: Get /me
  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại (Yêu cầu Cookie)' })
  @UseGuards(JwtAccessGuard)
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.userId);
  }

  // UC005: Verify Email — Request
  @Post('verify-email/request')
  @ApiOperation({ summary: 'Gửi lại mã xác nhận email' })
  @HttpCode(HttpStatus.OK)
  async verifyEmailRequest(@Body() dto: VerifyEmailRequestDto) {
    return this.authService.sendVerificationEmail(dto.email);
  }

  // UC005: Verify Email — Confirm
  @Post('verify-email/confirm')
  @ApiOperation({ summary: 'Xác nhận email bằng token (Bước 2 - Lấy token từ terminal log)' })
  @HttpCode(HttpStatus.OK)
  async verifyEmailConfirm(
    @Body() dto: VerifyEmailConfirmDto,
    @Res({ passthrough: true }) res: express.Response,
    @Req() req: express.Request,
  ) {
    return this.authService.confirmVerifyEmail(dto.email, dto.token, res, req);
  }

  // UC006: Forgot Password
  @Post('forgot-password')
  @ApiOperation({ summary: 'Quên mật khẩu (Yêu cầu gửi email reset)' })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // UC007: Reset Password
  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng token (Lấy token từ terminal log)' })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // UC008: Change Password
  @Post('change-password')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu (Yêu cầu Cookie)' })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.userId,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  // UC012: Soft Delete Account
  @Post('account/delete')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Xóa tài khoản mềm (Yêu cầu Cookie & Mật khẩu xác nhận)' })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.softDeleteAccount(user.userId, dto.password, res);
  }

  // UC013: Restore Account
  @Post('account/restore')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Khôi phục tài khoản đã xóa mềm (Yêu cầu Cookie)' })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async restoreAccount(@CurrentUser() user: AuthUser) {
    return this.authService.restoreAccount(user.userId);
  }

  // UC014: Refresh Token
  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới Access Token (Trình duyệt tự gửi refresh_token cookie)' })
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.refreshAccessToken(
      (req as any).cookies?.refresh_token,
      res,
      req,
    );
  }

  // UC015: Force Logout All
  @Post('logout-all')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Đăng xuất khỏi tất cả thiết bị (Yêu cầu Cookie)' })
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    return this.authService.forceLogoutAll(user.userId, res);
  }
}
