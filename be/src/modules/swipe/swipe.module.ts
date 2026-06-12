import { Module } from '@nestjs/common';
import { SwipeController } from './controllers/swipe.controller';
import { SwipeService } from './services/swipe.service';
import { SwipeRepository } from './repositories/swipe.repository';
import { SwipeReadRepository } from './repositories/swipe-read.repository';
import { SwipeWriteRepository } from './repositories/swipe-write.repository';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { MatchModule } from '../match/match.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [AuthModule, ProfileModule, MatchModule, DatabaseModule],
  controllers: [SwipeController],
  providers: [SwipeService, SwipeRepository, SwipeReadRepository, SwipeWriteRepository],
  exports: [SwipeService, SwipeRepository, SwipeReadRepository, SwipeWriteRepository],
})
export class SwipeModule {}
