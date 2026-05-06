import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { VerificationTokenRepository } from './repositories/verification-token.repository';
import { ResetPasswordTokenRepository } from './repositories/reset-password-token.repository';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,
    TokenService,
    EmailService,
    // Repositories (in-memory mock — swap to Prisma later)
    UserRepository,
    SessionRepository,
    VerificationTokenRepository,
    ResetPasswordTokenRepository,
    // Passport strategies
    JwtAccessStrategy,
  ],
  exports: [AuthService, UserRepository],
})
export class AuthModule {}
