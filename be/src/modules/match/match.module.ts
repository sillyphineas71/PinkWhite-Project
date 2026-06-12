import { Module } from '@nestjs/common';
import { MatchController } from './controllers/match.controller';
import { MatchService } from './services/match.service';
import { MatchReadRepository } from './repositories/match-read.repository';
import { MatchWriteRepository } from './repositories/match-write.repository';
import { MatchCreationService } from './services/match-creation.service';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, AuthModule, ProfileModule],
  controllers: [MatchController],
  providers: [
    MatchService,
    MatchReadRepository,
    MatchWriteRepository,
    MatchCreationService,
  ],
  exports: [
    MatchService,
    MatchReadRepository,
    MatchWriteRepository,
    MatchCreationService,
  ],
})
export class MatchModule {}
