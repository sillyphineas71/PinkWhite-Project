import { Module } from '@nestjs/common';
import { SwipeController } from './controllers/swipe.controller';
import { SwipeService } from './services/swipe.service';
import { SwipeRepository } from './repositories/swipe.repository';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { MatchModule } from '../match/match.module';

@Module({
  imports: [AuthModule, ProfileModule, MatchModule],
  controllers: [SwipeController],
  providers: [SwipeService, SwipeRepository],
  exports: [SwipeService, SwipeRepository],
})
export class SwipeModule {}
