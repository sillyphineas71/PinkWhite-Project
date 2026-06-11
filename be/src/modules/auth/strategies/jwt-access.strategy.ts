import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../services/token.service';

/**
 * Extract JWT from cookie "access_token" — ADR-004
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    if (payload.auth_context === 'pending_restore') {
      const allowedPaths = [
        '/auth/account/restore',
        '/api/auth/account/restore',
        '/auth/logout',
        '/api/auth/logout',
      ];
      
      const isAllowed = req.method === 'POST' && allowedPaths.some(path => req.path === path || req.path.endsWith(path));
      if (!isAllowed) {
        throw new ForbiddenException('Tài khoản đang chờ khôi phục, không thể truy cập API này');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.session_id,
      tokenType: payload.token_type,
      authContext: payload.auth_context,
    };
  }
}