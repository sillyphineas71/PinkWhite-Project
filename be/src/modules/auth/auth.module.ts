import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { AuthIdentityRepository } from './repositories/auth-identity.repository';
import { SecurityTokenRepository } from './repositories/security-token.repository';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,
    TokenService,
    EmailService,
    // Repositories (Prisma-backed where migrated; legacy token repos kept for later batches)
    UserRepository,
    SessionRepository,
    AuthIdentityRepository,
    SecurityTokenRepository,
    // Passport strategies
    JwtAccessStrategy,
  ],
  exports: [AuthService, UserRepository],
})
export class AuthModule {}