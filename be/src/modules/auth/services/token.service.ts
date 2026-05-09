import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

export interface JwtPayload {
  sub: string; // userId
  email: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sinh Access Token (TTL 15m) — UC002
   */
  signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_ACCESS_TTL') ??
          '15m') as any,
      },
    );
  }

  /**
   * Sinh Refresh Token (TTL 7d) — UC002
   */
  signRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_TTL') ??
          '7d') as any,
      },
    );
  }

  /**
   * Verify Refresh Token — UC014
   */
  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  /**
   * Set cookies cho Access + Refresh Token — UC002, UC005 confirm
   * Access Cookie: Path=/
   * Refresh Cookie: Path=/api/auth/refresh
   */
  setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * Xóa cookies — UC003, UC012, UC015
   */
  clearAuthCookies(res: Response): void {
    res.cookie('access_token', '', { httpOnly: true, path: '/', maxAge: 0 });
    res.cookie('refresh_token', '', {
      httpOnly: true,
      path: '/api/auth/refresh',
      maxAge: 0,
    });
  }

  /**
   * Tính expiration date cho Refresh Token — UC014
   */
  getRefreshTokenExpiry(): Date {
    const ttl = this.configService.get<string>('JWT_REFRESH_TTL', '7d');
    const days = parseInt(ttl.replace('d', ''), 10) || 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
