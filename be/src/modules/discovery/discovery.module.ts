import { Module } from '@nestjs/common';
import { DiscoveryController } from './controllers/discovery.controller';
import { DiscoveryService } from './services/discovery.service';
import { PreferenceRepository } from './repositories/preference.repository';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { SwipeModule } from '../swipe/swipe.module';

@Module({
  imports: [AuthModule, ProfileModule, SwipeModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, PreferenceRepository],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
