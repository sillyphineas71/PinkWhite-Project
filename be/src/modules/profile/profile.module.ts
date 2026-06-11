import { Module } from '@nestjs/common';

import { ProfileController } from './controllers/profile.controller';

import { ProfileService } from './services/profile.service';
import { PhotoService } from './services/photo.service';
import { LocationService } from './services/location.service';

import { ProfileRepository } from './repositories/profile.repository';
import { PhotoRepository } from './repositories/photo.repository';
import { LocationRepository } from './repositories/location.repository';
import { UserPrivacySettingsRepository } from './repositories/user-privacy-settings.repository';

// Need to inject UserRepository for updating isOnboarded flag
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    PhotoService,
    LocationService,
    ProfileRepository,
    PhotoRepository,
    LocationRepository,
    UserPrivacySettingsRepository,
  ],
  exports: [
    ProfileService,
    LocationService,
    ProfileRepository,
    PhotoRepository,
    LocationRepository,
    UserPrivacySettingsRepository,
  ],
})
export class ProfileModule {}
