import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class AuthUser {
  userId!: string;
  email!: string;
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
