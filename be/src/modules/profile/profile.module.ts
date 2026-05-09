import { Module } from '@nestjs/common';

import { ProfileController } from './controllers/profile.controller';

import { ProfileService } from './services/profile.service';
import { PhotoService } from './services/photo.service';
import { LocationService } from './services/location.service';

import { ProfileRepository } from './repositories/profile.repository';
import { PhotoRepository } from './repositories/photo.repository';
import { LocationRepository } from './repositories/location.repository';

// Need to inject UserRepository for updating isOnboarded flag
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    PhotoService,
    LocationService,
    ProfileRepository,
    PhotoRepository,
    LocationRepository,
  ],
  exports: [ProfileService, LocationService],
})
export class ProfileModule {}
