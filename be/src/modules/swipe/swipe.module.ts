import { Module } from '@nestjs/common';
import { SwipeController } from './controllers/swipe.controller';
import { SwipeService } from './services/swipe.service';
import { MatchRepository } from './repositories/match.repository';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';

// Note: SwipeRepository is already in DiscoveryModule's exports or can be provided here.
// Let's provide it here and make it global or export it. Wait, DiscoveryModule provides it but doesn't export it.
// Let's just provide SwipeRepository here and we can refactor later if needed to a shared db module.
import { SwipeRepository } from './repositories/swipe.repository';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [SwipeController],
  providers: [SwipeService, SwipeRepository, MatchRepository],
  exports: [SwipeService, SwipeRepository, MatchRepository],
})
export class SwipeModule {}
