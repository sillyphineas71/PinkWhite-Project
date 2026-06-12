import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class AuthUser {
  userId!: string;
  email?: string;
  sessionId?: string;
  tokenType?: 'access' | 'refresh';
  authContext?: 'normal' | 'pending_restore';
}

/**
 * @CurrentUser() decorator — extracts the authenticated user from request
 * Usage: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
