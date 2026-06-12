import { Module } from '@nestjs/common';
import { MatchController } from './controllers/match.controller';
import { MatchService } from './services/match.service';
import { MatchRepository } from './repositories/match.repository';
import { MatchWriteRepository } from './repositories/match-write.repository';
import { MatchCreationService } from './services/match-creation.service';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [MatchController],
  providers: [MatchService, MatchRepository, MatchWriteRepository, MatchCreationService],
  exports: [MatchService, MatchRepository, MatchWriteRepository, MatchCreationService],
})
export class MatchModule {}
