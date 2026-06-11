import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import * as crypto from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { SecurityTokenRepository } from '../repositories/security-token.repository';
import { PrismaService } from '../../../database/prisma.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { normalizeEmail } from '../utils/email-normalize.util';
import {
  hashPassword,
  comparePassword,
  dummyBcryptCompare,
  hashToken,
  generateSecureToken,
} from '../utils/hash.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly securityTokenRepo: SecurityTokenRepository,
  ) {
    this.bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS', 10);
  }

  // ===== UC001: Register =====
  async register(email: string, password: string) {
    const normalized = normalizeEmail(email);
    const trimmedPassword = password.trim();

    const existing = await this.userRepo.findByEmail(normalized);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await hashPassword(trimmedPassword, this.bcryptRounds);
    const token = generateSecureToken();
    const tokenHash = hashToken(token);

    const user = await this.prisma.$transaction(async (tx: any) => {
      // 1. Create user and 2. auth identity
      const createdUser = await this.userRepo.create(
        {
          email: normalized,
          passwordHash,
        },
        tx,
      );

      // 3. Create discovery preferences
      await tx.discoveryPreference.create({
        data: {
          userId: createdUser.id,
          minAge: 18,
          maxAge: 100,
          maxDistanceKm: 100,
          preferredGenders: ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'],
        },
      });

      // 4. Create user privacy settings
      await tx.userPrivacySettings.create({
        data: {
          userId: createdUser.id,
        },
      });

      // 5. Create email verification security token
      await this.securityTokenRepo.create(
        {
          userId: createdUser.id,
          tokenType: 'EMAIL_VERIFICATION',
          tokenHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins TTL
        },
        tx,
      );

      return createdUser;
    });

    // 11. Email delivery happens after transaction
    await this.emailService.sendVerificationEmail(normalized, token);

    this.logger.log(
      JSON.stringify({
        action: 'USER_REGISTERED',
        userId: user.id,
        email: this.maskEmail(normalized),
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực.',
      user: { id: user.id, email: user.email },
    };
  }

  // ===== UC002: Login =====
  async login(email: string, password: string, res: Response, req: Request) {
    const normalized = normalizeEmail(email);
    const trimmedPassword = password.trim();
    const user = await this.userRepo.findByEmail(normalized);

    if (!user) {
      await dummyBcryptCompare(this.bcryptRounds); // Timing Attack protection
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.passwordHash) {
      await dummyBcryptCompare(this.bcryptRounds);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await comparePassword(
      trimmedPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(
        JSON.stringify({
          action: 'LOGIN_FAILED',
          reason: 'invalid_password',
          email: this.maskEmail(normalized),
          timestamp: new Date().toISOString(),
        }),
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // SUSPENDED or BANNED -> blocked
    if (
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'BANNED'
    ) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    let isPendingRestore = false;
    if (user.accountStatus === 'DELETED' || user.deletedAt) {
      if (
        user.accountStatus === 'DELETED' &&
        user.deletedAt &&
        user.deletionScheduledAt &&
        user.deletionScheduledAt.getTime() > Date.now()
      ) {
        // Within restore window -> allow login but in pending restore mode
        isPendingRestore = true;
      } else {
        // Expired restore window or hard deleted -> block
        throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
      }
    }

    // ACTIVE or PENDING_EMAIL_VERIFICATION or Pending Restore — allow login
    await this.issueTokens(
      user.id,
      user.email,
      res,
      req,
      isPendingRestore ? 'pending_restore' : 'normal'
    );

    this.logger.log(
      JSON.stringify({
        action: 'LOGIN_SUCCESS',
        userId: user.id,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        email: user.email,
        isOnboarded: user.isOnboarded,
        ...(isPendingRestore && { pendingRestore: true }),
      },
    };
  }

  // ===== UC003: Logout =====
  async logout(userId: string, sessionId: string | undefined, res: Response) {
    if (!sessionId) {
      throw new UnauthorizedException('Không tìm thấy phiên đăng nhập');
    }

    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    await this.sessionRepo.revokeById(sessionId, 'logout');

    this.tokenService.clearAuthCookies(res);
    this.logger.log(
      JSON.stringify({
        action: 'LOGOUT',
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
      }),
    );
    return { message: 'Đăng xuất thành công' };
  }

  // ===== UC004: Get /me =====
  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'BANNED' ||
      user.accountStatus === 'DELETED' ||
      user.deletedAt
    ) {
      this.logger.warn(
        JSON.stringify({
          action: 'INVALID_ACCOUNT_ACCESS',
          userId,
          status: user.accountStatus,
          timestamp: new Date().toISOString(),
        }),
      );
      throw new ForbiddenException('Tài khoản của bạn không khả dụng');
    }
    return {
      id: user.id,
      email: user.email,
      isOnboarded: user.isOnboarded,
      isEmailVerified: user.isEmailVerified,
    };
  }

  // ===== UC005: Verify Email (Request) =====
  async sendVerificationEmail(email: string) {
    const normalized = normalizeEmail(email);
    const user = await this.userRepo.findByEmail(normalized);
    if (
      user &&
      !user.isEmailVerified &&
      !user.deletedAt &&
      (user.accountStatus === 'ACTIVE' || user.accountStatus === 'PENDING_EMAIL_VERIFICATION')
    ) {
      // Invalidate old tokens
      await this.securityTokenRepo.invalidateByUserIdAndType(user.id, 'EMAIL_VERIFICATION');

      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      await this.securityTokenRepo.create({
        userId: user.id,
        tokenType: 'EMAIL_VERIFICATION',
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      });

      await this.emailService.sendVerificationEmail(normalized, token);
    }

    return { message: 'Nếu email hợp lệ, email xác thực sẽ được gửi.' };
  }

  // ===== UC005: Verify Email (Confirm) =====
  async confirmVerifyEmail(
    email: string,
    token: string,
    res: Response,
    req: Request,
  ) {
    const normalized = normalizeEmail(email);
    const tokenHash = hashToken(token);
    const storedToken = await this.securityTokenRepo.findByTokenHash(tokenHash);

    if (
      !storedToken ||
      storedToken.tokenType !== 'EMAIL_VERIFICATION' ||
      storedToken.usedAt
    ) {
      throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.userRepo.findById(storedToken.userId);
    if (!user || user.email !== normalized) {
      throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');
    }

    if (
      user.deletedAt ||
      user.accountStatus === 'BANNED' ||
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'DELETED'
    ) {
      throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');
    }

    // Transaction: verify + create session
    await this.prisma.$transaction(async (tx: any) => {
      // Mark token used
      const result = await tx.securityToken.updateMany({
        where: {
          id: storedToken.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');
      }

      // Update user
      const updateData: any = { emailVerifiedAt: new Date() };
      if (user.accountStatus === 'PENDING_EMAIL_VERIFICATION') {
        updateData.accountStatus = 'ACTIVE';
      }
      await tx.user.update({
        where: { id: user.id },
        data: updateData,
      });
    });

    // Issue JWT for the first time
    await this.issueTokens(user.id, user.email, res, req);

    this.logger.log(
      JSON.stringify({
        action: 'EMAIL_VERIFIED',
        userId: user.id,
        timestamp: new Date().toISOString(),
      }),
    );

    return { message: 'Xác thực email thành công' };
  }

  // ===== UC006: Forgot Password =====
  async forgotPassword(email: string) {
    const normalized = normalizeEmail(email);
    const user = await this.userRepo.findByEmail(normalized);

    if (
      user &&
      !user.deletedAt &&
      (user.accountStatus === 'ACTIVE' || user.accountStatus === 'PENDING_EMAIL_VERIFICATION')
    ) {
      await this.securityTokenRepo.invalidateByUserIdAndType(user.id, 'PASSWORD_RESET');

      const token = generateSecureToken();
      const tokenHash = hashToken(token);
      await this.securityTokenRepo.create({
        userId: user.id,
        tokenType: 'PASSWORD_RESET',
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      await this.emailService.sendResetPasswordEmail(normalized, token);

      this.logger.log(
        JSON.stringify({
          action: 'FORGOT_PASSWORD_REQUESTED',
          userId: user.id,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return {
      message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
    };
  }

  // ===== UC007: Reset Password =====
  async resetPassword(token: string, newPassword: string) {
    const trimmed = newPassword.trim();
    const tokenHash = hashToken(token);
    const storedToken = await this.securityTokenRepo.findByTokenHash(tokenHash);

    if (
      !storedToken ||
      storedToken.tokenType !== 'PASSWORD_RESET' ||
      storedToken.usedAt
    ) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.userRepo.findById(storedToken.userId);
    if (!user) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    if (
      user.deletedAt ||
      user.accountStatus === 'BANNED' ||
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'DELETED'
    ) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    const passwordHash = await hashPassword(trimmed, this.bcryptRounds);

    await this.prisma.$transaction(async (tx: any) => {
      const result = await tx.securityToken.updateMany({
        where: {
          id: storedToken.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
      }

      const updateResult = await tx.authIdentity.updateMany({
        where: { userId: user.id, provider: 'EMAIL' },
        data: { passwordHash },
      });
      if (updateResult.count === 0) {
        throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
      }
    });

    await this.sessionRepo.revokeAllByUserId(user.id, 'password_reset');

    this.logger.log(
      JSON.stringify({
        action: 'PASSWORD_RESET_SUCCESS',
        userId: user.id,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  // ===== UC008: Change Password =====
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException();
    }

    const isValid = await comparePassword(oldPassword, user.passwordHash);
    if (!isValid) {
      this.logger.warn(
        JSON.stringify({
          action: 'PASSWORD_CHANGE_FAILED',
          reason: 'wrong_old_password',
          userId,
          timestamp: new Date().toISOString(),
        }),
      );
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const trimmedNew = newPassword.trim();

    // Check new password != old password
    const isSame = await comparePassword(trimmedNew, user.passwordHash);
    if (isSame) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng mật khẩu cũ',
      );
    }

    const passwordHash = await hashPassword(trimmedNew, this.bcryptRounds);
    await this.userRepo.updatePasswordHash(userId, passwordHash);

    this.logger.log(
      JSON.stringify({
        action: 'PASSWORD_CHANGED',
        userId,
        timestamp: new Date().toISOString(),
      }),
    );

    return { message: 'Đổi mật khẩu thành công' };
  }

  // ===== UC009: Google OAuth =====
  async googleLogin(
    googleEmail: string,
    googleUserId: string,
    res: Response,
    req: Request,
  ) {
    const normalized = normalizeEmail(googleEmail);
    let user = await this.userRepo.findByEmail(normalized);

    if (user) {
      // Existing user — check restrictions
      if (user.isBanned) {
        throw new ForbiddenException('Tài khoản của bạn đã bị khóa');
      }
      if (user.passwordHash && !user.isEmailVerified) {
        // Tài khoản tồn tại nhưng chưa xác thực email (có thể do ai đó đăng ký giữ chỗ).
        // Vì Google đã đảm bảo email này là thật, ta tiến hành "take over" (chiếm lại) tài khoản:
        // Cập nhật isEmailVerified = true và xóa passwordHash của kẻ mạo danh để đảm bảo an toàn.
        await this.userRepo.setEmailVerified(normalized);
        await this.userRepo.updatePasswordHash(user.id, null);
        user.isEmailVerified = true;

        this.logger.log(
          JSON.stringify({
            action: 'ACCOUNT_TAKOVER_BY_OAUTH',
            userId: user.id,
            email: normalized,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } else {
      // New user — create with isEmailVerified = true
      user = await this.userRepo.create({
        email: normalized,
        passwordHash: null,
      });
      // Since Google verified the email, set it immediately
      await this.userRepo.setEmailVerified(normalized);
      user.isEmailVerified = true;
    }

    await this.issueTokens(user.id, user.email, res, req);

    this.logger.log(
      JSON.stringify({
        action: 'SOCIAL_LOGIN_SUCCESS',
        provider: 'GOOGLE',
        userId: user.id,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        email: user.email,
        isOnboarded: user.isOnboarded,
      },
    };
  }

  // ===== UC012: Soft Delete =====
  async softDeleteAccount(userId: string, password: string, res: Response) {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException();
    }

    if (user.deletedAt) {
      throw new BadRequestException('Tài khoản đã được xóa');
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    // Transaction: soft delete + revoke all sessions (Q5)
    let sessionCount = 0;
    await this.prisma.$transaction(async (tx: any) => {
      await this.userRepo.softDelete(userId, tx);
      sessionCount = await this.sessionRepo.revokeAllByUserId(userId, 'account_deleted', tx);
    });
    
    this.tokenService.clearAuthCookies(res);

    this.logger.log(
      JSON.stringify({
        action: 'ACCOUNT_SOFT_DELETED',
        userId,
        sessionsRevoked: sessionCount,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Tài khoản đã được xóa. Bạn có 30 ngày để khôi phục.',
    };
  }

  // ===== UC013: Undo Soft Delete =====
  async restoreAccount(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (!user.deletedAt || user.accountStatus !== 'DELETED') {
      throw new BadRequestException('Tài khoản không cần khôi phục');
    }

    if (!user.deletionScheduledAt || user.deletionScheduledAt.getTime() < Date.now()) {
      throw new GoneException('Tài khoản đã bị xóa vĩnh viễn');
    }

    await this.userRepo.restore(userId);

    this.logger.log(
      JSON.stringify({
        action: 'ACCOUNT_RESTORED',
        userId,
        timestamp: new Date().toISOString(),
      }),
    );

    return { message: 'Tài khoản đã được khôi phục thành công.' };
  }

  // ===== UC014: Refresh Token =====
  async refreshAccessToken(
    refreshTokenCookie: string,
    res: Response,
    req: Request,
  ) {
    if (!refreshTokenCookie) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let payload: any;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshTokenCookie);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      !payload ||
      payload.token_type !== 'refresh' ||
      !payload.sub ||
      !payload.session_id ||
      !payload.jti
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.auth_context === 'pending_restore') {
      const user = await this.userRepo.findById(payload.sub);
      if (
        !user ||
        user.accountStatus !== 'DELETED' ||
        !user.deletedAt ||
        !user.deletionScheduledAt ||
        user.deletionScheduledAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }
    }

    const oldHash = hashToken(refreshTokenCookie);
    const newJti = crypto.randomUUID();

    const newAccessTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      session_id: payload.session_id,
      token_type: 'access' as const,
      auth_context: payload.auth_context || 'normal',
    };

    const newRefreshTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      session_id: payload.session_id,
      jti: newJti,
      token_type: 'refresh' as const,
      auth_context: payload.auth_context || 'normal',
    };

    const newAccessToken = this.tokenService.signAccessToken(newAccessTokenPayload);
    const newRefreshToken = this.tokenService.signRefreshToken(newRefreshTokenPayload);
    const newHash = hashToken(newRefreshToken);

    const success = await this.sessionRepo.rotateRefreshTokenHash({
      sessionId: payload.session_id,
      userId: payload.sub,
      oldRefreshTokenHash: oldHash,
      newRefreshTokenHash: newHash,
    });

    if (!success) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.tokenService.setAuthCookies(res, newAccessToken, newRefreshToken);

    this.logger.log(
      JSON.stringify({
        action: 'TOKEN_REFRESHED',
        userId: payload.sub,
        sessionId: payload.session_id,
        timestamp: new Date().toISOString(),
      }),
    );

    return { message: 'Token đã được làm mới' };
  }

  // ===== UC015: Force Logout All =====
  async forceLogoutAll(userId: string, res: Response) {
    const sessionCount = await this.sessionRepo.revokeAllByUserId(userId, 'logout_all');
    this.tokenService.clearAuthCookies(res);

    this.logger.log(
      JSON.stringify({
        action: 'FORCE_LOGOUT_ALL',
        userId,
        sessionCount,
        timestamp: new Date().toISOString(),
      }),
    );

    return { message: 'Đã đăng xuất khỏi tất cả thiết bị' };
  }

  // ===== Helper: Issue tokens and create session =====
  private async issueTokens(
    userId: string,
    email: string,
    res: Response,
    req: Request,
    authContext: 'normal' | 'pending_restore' = 'normal',
  ) {
    // Step 1: Generate session id and jti
    const sessionId = crypto.randomUUID();
    const jti = crypto.randomUUID();

    // Step 2: Create tokens
    const accessTokenPayload = {
      sub: userId,
      email,
      session_id: sessionId,
      token_type: 'access' as const,
      auth_context: authContext,
    };
    const refreshTokenPayload = {
      sub: userId,
      email,
      session_id: sessionId,
      jti,
      token_type: 'refresh' as const,
      auth_context: authContext,
    };

    const accessToken = this.tokenService.signAccessToken(accessTokenPayload);
    const refreshToken = this.tokenService.signRefreshToken(refreshTokenPayload);

    // Step 3: Hash the real refresh token
    const refreshTokenHash = hashToken(refreshToken);

    // Step 4: Create session directly with real hash
    await this.sessionRepo.create({
      id: sessionId,
      userId,
      refreshTokenHash,
      userAgent: req.headers['user-agent'],
      ipAddress: req.socket?.remoteAddress as string | undefined,
      expiresAt: this.tokenService.getRefreshTokenExpiry(),
    });

    // Step 6: Set cookies
    this.tokenService.setAuthCookies(res, accessToken, refreshToken);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `**@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }
}
