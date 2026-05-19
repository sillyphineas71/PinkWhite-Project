import { Module } from '@nestjs/common';
import { MatchController } from './controllers/match.controller';
import { MatchService } from './services/match.service';
import { MatchRepository } from './repositories/match.repository';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [MatchController],
  providers: [MatchService, MatchRepository],
  exports: [MatchService, MatchRepository],
})
export class MatchModule {}
