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
import { VerificationTokenRepository } from '../repositories/verification-token.repository';
import { ResetPasswordTokenRepository } from '../repositories/reset-password-token.repository';
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
    private readonly verifyTokenRepo: VerificationTokenRepository,
    private readonly resetTokenRepo: ResetPasswordTokenRepository,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
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
    const user = await this.userRepo.create({
      email: normalized,
      passwordHash,
    });

    // Trigger UC005: send verification email
    await this.sendVerificationEmail(normalized);

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
          ip: req.ip,
          timestamp: new Date().toISOString(),
        }),
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Check account status: block SUSPENDED, BANNED, DELETED with generic failure
    // Allow only ACTIVE and PENDING_EMAIL_VERIFICATION
    if (
      user.accountStatus === 'SUSPENDED' ||
      user.accountStatus === 'BANNED' ||
      user.accountStatus === 'DELETED'
    ) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Soft deleted user with deletedAt — also block with generic failure
    if (user.deletedAt) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // ACTIVE or PENDING_EMAIL_VERIFICATION — allow login
    await this.issueTokens(user.id, user.email, res, req);

    this.logger.log(
      JSON.stringify({
        action: 'LOGIN_SUCCESS',
        userId: user.id,
        ip: req.ip,
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
    if (user.isBanned) {
      this.logger.warn(
        JSON.stringify({
          action: 'BANNED_USER_ACCESS',
          userId,
          timestamp: new Date().toISOString(),
        }),
      );
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa');
    }
    if (user.deletedAt) {
      const daysSinceDelete =
        (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelete > 30) {
        throw new ForbiddenException('Tài khoản không còn hoạt động');
      }
      // pendingRestore — return limited info
      return {
        id: user.id,
        email: user.email,
        isOnboarded: user.isOnboarded,
        isEmailVerified: user.isEmailVerified,
        pendingRestore: true,
      };
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
    if (!user) {
      throw new NotFoundException('Email không tồn tại');
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email đã được xác thực');
    }

    // Invalidate old tokens
    await this.verifyTokenRepo.deleteAllByEmail(normalized);

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    await this.verifyTokenRepo.create({
      email: normalized,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    });

    await this.emailService.sendVerificationEmail(normalized, token);

    return { message: 'Email xác thực đã được gửi.' };
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
    const storedToken = await this.verifyTokenRepo.findByTokenHash(tokenHash);

    if (!storedToken || storedToken.email !== normalized) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.userRepo.findByEmail(normalized);
    if (!user) {
      throw new NotFoundException('Email không tồn tại');
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email đã được xác thực');
    }

    // Transaction: verify + delete token + create session
    await this.userRepo.setEmailVerified(normalized);
    await this.verifyTokenRepo.deleteById(storedToken.id);

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

    // Always return 200 to prevent user enumeration
    if (!user) {
      return {
        message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
      };
    }

    await this.resetTokenRepo.deleteAllByEmail(normalized);

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    await this.resetTokenRepo.create({
      email: normalized,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await this.emailService.sendResetPasswordEmail(normalized, token);

    this.logger.log(
      JSON.stringify({
        action: 'FORGOT_PASSWORD_REQUESTED',
        email: this.maskEmail(normalized),
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.',
    };
  }

  // ===== UC007: Reset Password =====
  async resetPassword(token: string, newPassword: string) {
    const trimmed = newPassword.trim();
    const tokenHash = hashToken(token);
    const storedToken = await this.resetTokenRepo.findByTokenHash(tokenHash);

    if (!storedToken) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.userRepo.findByEmail(storedToken.email);
    if (!user) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const passwordHash = await hashPassword(trimmed, this.bcryptRounds);

    // Transaction: update password + delete token + revoke all sessions (Q2)
    await this.userRepo.updatePasswordHash(user.id, passwordHash);
    await this.resetTokenRepo.deleteById(storedToken.id);
    await this.sessionRepo.deleteAllByUserId(user.id);

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
    await this.userRepo.softDelete(userId);
    const sessionCount = await this.sessionRepo.deleteAllByUserId(userId);
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

    if (!user.deletedAt) {
      throw new BadRequestException('Tài khoản không cần khôi phục');
    }

    const daysSinceDelete =
      (Date.now() - user.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelete > 30) {
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

    const oldHash = hashToken(refreshTokenCookie);
    const newJti = crypto.randomUUID();

    const newAccessTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      session_id: payload.session_id,
      token_type: 'access' as const,
    };

    const newRefreshTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      session_id: payload.session_id,
      jti: newJti,
      token_type: 'refresh' as const,
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
  ) {
    // Step 1: Create session with temporary placeholder hash
    const placeholderHash = hashToken(crypto.randomUUID());
    const session = await this.sessionRepo.create({
      userId,
      refreshTokenHash: placeholderHash,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt: this.tokenService.getRefreshTokenExpiry(),
    });

    // Step 2: Generate jti for refresh token
    const jti = crypto.randomUUID();

    // Step 3: Create tokens with session_id and jti
    const accessTokenPayload = {
      sub: userId,
      email,
      session_id: session.id,
      token_type: 'access' as const,
    };
    const refreshTokenPayload = {
      sub: userId,
      email,
      session_id: session.id,
      jti,
      token_type: 'refresh' as const,
    };

    const accessToken = this.tokenService.signAccessToken(accessTokenPayload);
    const refreshToken = this.tokenService.signRefreshToken(refreshTokenPayload);

    // Step 4: Hash the actual refresh token
    const refreshTokenHash = hashToken(refreshToken);

    // Step 5: Update session with real hash
    await this.sessionRepo.updateTokenHash(
      session.id,
      refreshTokenHash,
      this.tokenService.getRefreshTokenExpiry(),
    );

    // Step 6: Set cookies
    this.tokenService.setAuthCookies(res, accessToken, refreshToken);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `**@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }
}
