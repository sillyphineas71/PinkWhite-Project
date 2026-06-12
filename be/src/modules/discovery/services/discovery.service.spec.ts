import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { PreferenceRepository } from '../repositories/preference.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProfileRepository } from '../../profile/repositories/profile.repository';
import { LocationRepository } from '../../profile/repositories/location.repository';
import { PhotoRepository } from '../../profile/repositories/photo.repository';
import { SwipeRepository } from '../../swipe/repositories/swipe.repository';
import { UserPrivacySettingsRepository } from '../../profile/repositories/user-privacy-settings.repository';
import { DiscoveryFeedRepository } from '../repositories/discovery-feed.repository';
import { PrismaService } from '../../../database/prisma.service';
import { GetDiscoveryFeedQueryDto } from '../dto/get-discovery-feed.dto';
import { decodeDiscoveryCursor } from '../utils/discovery-cursor.util';

describe('DiscoveryService Mapping Privacy', () => {
  let service: DiscoveryService;

  const mockPrisma = {
    profile: {
      findMany: jest.fn(),
    },
    profilePhoto: {
      findMany: jest.fn(),
    },
  };

  const mockFeedRepo = {
    findCandidates: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PreferenceRepository, useValue: {} },
        { provide: UserRepository, useValue: {} },
        { provide: ProfileRepository, useValue: {} },
        { provide: LocationRepository, useValue: {} },
        { provide: PhotoRepository, useValue: {} },
        { provide: SwipeRepository, useValue: {} },
        { provide: UserPrivacySettingsRepository, useValue: {} },
        { provide: DiscoveryFeedRepository, useValue: mockFeedRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);

    // Mock validateRequesterDiscoveryReadiness
    jest
      .spyOn(service, 'validateRequesterDiscoveryReadiness')
      .mockResolvedValue({
        user: { id: 'requester', email: 'secret@email.com' } as any,
        settings: {} as any,
        prefs: {
          preferredGenders: ['ALL'],
          minAge: 18,
          maxAge: 99,
          maxDistanceKm: 100,
        } as any,
        location: { latitude: 10, longitude: 10 },
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('response mapper does not expose sensitive fields', async () => {
    mockFeedRepo.findCandidates.mockResolvedValue([
      {
        candidateUserId: '00000000-0000-0000-0000-000000000001',
        distanceMeters: 12345,
      },
    ]);

    // 25 years old
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 25);

    mockPrisma.profile.findMany.mockResolvedValue([
      {
        userId: '00000000-0000-0000-0000-000000000001',
        displayName: 'Test User',
        dob,
        gender: 'MALE',
        relationshipGoal: 'FRIENDS',
        bio: 'Hello world',
        // Injecting dangerous fields to ensure they are filtered out
        email: 'leaked@email.com',
        realLocation: 'POINT(10 10)',
        real_location: 'POINT(10 10)',
        latitude: 10,
        longitude: 10,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        deletedAt: null,
        moderationStatus: 'APPROVED',
        uploadStatus: 'CONFIRMED',
        swipeState: 'something',
        blockState: 'something',
      },
    ]);

    mockPrisma.profilePhoto.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: 'http://photo.com/1.jpg',
        storageKey: '1.jpg',
        sortOrder: 0,
      },
    ]);

    const query = new GetDiscoveryFeedQueryDto();
    query.limit = 20;

    const res = await service.getFeed('requester', query);

    expect(res.candidates).toHaveLength(1);

    const jsonStr = JSON.stringify(res);
    expect(jsonStr).not.toContain('"dob"');
    expect(jsonStr).not.toContain('"email"');
    expect(jsonStr).not.toContain('"realLocation"');
    expect(jsonStr).not.toContain('"real_location"');
    expect(jsonStr).not.toContain('"latitude"');
    expect(jsonStr).not.toContain('"longitude"');
    expect(jsonStr).not.toContain('"accountStatus"');
    expect(jsonStr).not.toContain('"emailVerifiedAt"');
    expect(jsonStr).not.toContain('"deletedAt"');
    expect(jsonStr).not.toContain('"moderationStatus"');
    expect(jsonStr).not.toContain('"uploadStatus"');
    expect(jsonStr).not.toContain('"swipe"');
    expect(jsonStr).not.toContain('"block"');

    const candidate = res.candidates[0];
    expect(candidate.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(candidate.displayName).toBe('Test User');
    expect(candidate.age).toBe(25);
    expect(candidate.distanceKm).toBe(12);
  });

  it('distanceMeters maps correctly to distanceKm', async () => {
    mockFeedRepo.findCandidates.mockResolvedValue([
      {
        candidateUserId: '00000000-0000-0000-0000-000000000001',
        distanceMeters: 0,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000002',
        distanceMeters: 400,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000003',
        distanceMeters: 600,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000004',
        distanceMeters: 12000,
      },
    ]);

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 20);

    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: '00000000-0000-0000-0000-000000000001', dob },
      { userId: '00000000-0000-0000-0000-000000000002', dob },
      { userId: '00000000-0000-0000-0000-000000000003', dob },
      { userId: '00000000-0000-0000-0000-000000000004', dob },
    ]);
    mockPrisma.profilePhoto.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: 'safe',
        sortOrder: 0,
      },
      {
        id: 'p2',
        userId: '00000000-0000-0000-0000-000000000002',
        publicUrl: 'safe',
        sortOrder: 0,
      },
      {
        id: 'p3',
        userId: '00000000-0000-0000-0000-000000000003',
        publicUrl: 'safe',
        sortOrder: 0,
      },
      {
        id: 'p4',
        userId: '00000000-0000-0000-0000-000000000004',
        publicUrl: 'safe',
        sortOrder: 0,
      },
    ]);

    const query = new GetDiscoveryFeedQueryDto();
    query.limit = 10;
    const res = await service.getFeed('requester', query);

    if (!res.candidates[0]) {
      console.log('Candidates is empty!', res);
    }

    expect(res.candidates[0].distanceKm).toBe(0); // 0 meters -> 0 km
    expect(res.candidates[1].distanceKm).toBe(1); // 400 meters -> Math.round(0.4) = 0 -> 1 km
    expect(res.candidates[2].distanceKm).toBe(1); // 600 meters -> Math.round(0.6) = 1 km
    expect(res.candidates[3].distanceKm).toBe(12); // 12000 meters -> 12 km
  });

  it('pagination hasMore and nextCursor behavior', async () => {
    // Repo returns 3 rows (limit + 1)
    mockFeedRepo.findCandidates.mockResolvedValue([
      {
        candidateUserId: '00000000-0000-0000-0000-000000000001',
        distanceMeters: 1000,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000002',
        distanceMeters: 2000,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000003',
        distanceMeters: 3000,
      },
    ]);

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 20);

    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: '00000000-0000-0000-0000-000000000001', dob },
      { userId: '00000000-0000-0000-0000-000000000002', dob },
      { userId: '00000000-0000-0000-0000-000000000003', dob }, // Prisma might fetch it, but mapping ignores it because it's not in visibleRows
    ]);
    mockPrisma.profilePhoto.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: 'safe',
        sortOrder: 0,
      },
      {
        id: 'p2',
        userId: '00000000-0000-0000-0000-000000000002',
        publicUrl: 'safe',
        sortOrder: 0,
      },
      {
        id: 'p3',
        userId: '00000000-0000-0000-0000-000000000003',
        publicUrl: 'safe',
        sortOrder: 0,
      },
    ]);

    const query = new GetDiscoveryFeedQueryDto();
    query.limit = 2; // So visibleRows will be 2
    const res = await service.getFeed('requester', query);

    expect(res.candidates).toHaveLength(2);
    expect(res.hasMore).toBe(true);
    expect(res.nextCursor).toBeDefined();
    expect(res.nextCursor).not.toBeNull();

    // nextCursor should come from c2, distance 2000
    const decoded = decodeDiscoveryCursor(res.nextCursor!);
    expect(decoded!.candidateUserId).toBe(
      '00000000-0000-0000-0000-000000000002',
    );
    expect(decoded!.distanceMeters).toBe(2000);
  });

  it('nextCursor is null when no more rows', async () => {
    mockFeedRepo.findCandidates.mockResolvedValue([
      {
        candidateUserId: '00000000-0000-0000-0000-000000000001',
        distanceMeters: 1000,
      },
    ]);

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 20);

    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: '00000000-0000-0000-0000-000000000001', dob },
    ]);
    mockPrisma.profilePhoto.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: 'safe',
        sortOrder: 0,
      },
    ]);

    const query = new GetDiscoveryFeedQueryDto();
    query.limit = 2;
    const res = await service.getFeed('requester', query);

    expect(res.candidates).toHaveLength(1);
    expect(res.hasMore).toBe(false);
    expect(res.nextCursor).toBeNull();
  });

  it('date-aware age edge cases', async () => {
    mockFeedRepo.findCandidates.mockResolvedValue([
      {
        candidateUserId: '00000000-0000-0000-0000-000000000001',
        distanceMeters: 100,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000002',
        distanceMeters: 100,
      },
    ]);

    const now = new Date();

    // Birthday already happened this year
    const dob1 = new Date(
      now.getFullYear() - 25,
      now.getMonth() - 1,
      now.getDate(),
    );
    // Birthday has not happened this year
    const dob2 = new Date(
      now.getFullYear() - 25,
      now.getMonth() + 1,
      now.getDate(),
    );

    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: '00000000-0000-0000-0000-000000000001', dob: dob1 },
      { userId: '00000000-0000-0000-0000-000000000002', dob: dob2 },
    ]);
    mockPrisma.profilePhoto.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: 'safe',
        sortOrder: 0,
      },
      {
        id: 'p2',
        userId: '00000000-0000-0000-0000-000000000002',
        publicUrl: 'safe',
        sortOrder: 0,
      },
    ]);

    const res = await service.getFeed(
      'requester',
      new GetDiscoveryFeedQueryDto(),
    );
    expect(res.candidates[0].age).toBe(25);
    expect(res.candidates[1].age).toBe(24);
  });

  it('publicUrl null photo is excluded and candidate without safe public photos is excluded', async () => {
    mockFeedRepo.findCandidates.mockResolvedValue([
      {
        candidateUserId: '00000000-0000-0000-0000-000000000001',
        distanceMeters: 100,
      },
      {
        candidateUserId: '00000000-0000-0000-0000-000000000002',
        distanceMeters: 100,
      },
    ]);

    const dob = new Date(2000, 1, 1);
    mockPrisma.profile.findMany.mockResolvedValue([
      { userId: '00000000-0000-0000-0000-000000000001', dob },
      { userId: '00000000-0000-0000-0000-000000000002', dob },
    ]);

    mockPrisma.profilePhoto.findMany.mockResolvedValue([
      {
        id: 'p1',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: 'safe_url',
        storageKey: 'leak1',
        sortOrder: 0,
      },
      {
        id: 'p2',
        userId: '00000000-0000-0000-0000-000000000001',
        publicUrl: null,
        storageKey: 'leak2',
        sortOrder: 1,
      },
      {
        id: 'p3',
        userId: '00000000-0000-0000-0000-000000000002',
        publicUrl: null,
        storageKey: 'leak3',
        sortOrder: 0,
      },
    ]);

    const res = await service.getFeed(
      'requester',
      new GetDiscoveryFeedQueryDto(),
    );

    // c1 is included but its null publicUrl photo is excluded
    // c2 is excluded entirely because it has no safe public photos
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].userId).toBe(
      '00000000-0000-0000-0000-000000000001',
    );
    expect(res.candidates[0].photos).toHaveLength(1);
    expect(res.candidates[0].photos[0].url).toBe('safe_url');
    expect(JSON.stringify(res)).not.toContain('leak');
  });
});

describe('DiscoveryService Readiness and Gender Normalization', () => {
  let service: DiscoveryService;

  const mockUserRepo = { findById: jest.fn() };
  const mockPrivacyRepo = { findByUserId: jest.fn() };
  const mockPrisma = {
    discoveryPreference: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const mockFeedRepo = { findCandidates: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PreferenceRepository, useValue: {} },
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: ProfileRepository, useValue: {} },
        { provide: LocationRepository, useValue: {} },
        { provide: PhotoRepository, useValue: {} },
        { provide: SwipeRepository, useValue: {} },
        { provide: UserPrivacySettingsRepository, useValue: mockPrivacyRepo },
        { provide: DiscoveryFeedRepository, useValue: mockFeedRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Gender Normalization', () => {
    it('ALL gender maps to lowercase DB values', async () => {
      // Mock readiness
      jest
        .spyOn(service, 'validateRequesterDiscoveryReadiness')
        .mockResolvedValue({
          user: {} as any,
          settings: {} as any,
          prefs: {
            preferredGenders: ['ALL'],
            minAge: 18,
            maxAge: 99,
            maxDistanceKm: 100,
          } as any,
          location: { latitude: 10, longitude: 10 },
        });

      mockFeedRepo.findCandidates.mockResolvedValue([]);

      const query = new GetDiscoveryFeedQueryDto();
      await service.getFeed('req', query);

      expect(mockFeedRepo.findCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredGenders: ['male', 'female', 'non_binary', 'other'],
        }),
      );
    });

    it('Multiple concrete preferred genders are preserved and normalized', async () => {
      jest
        .spyOn(service, 'validateRequesterDiscoveryReadiness')
        .mockResolvedValue({
          user: {} as any,
          settings: {} as any,
          prefs: {
            preferredGenders: ['MALE', 'NON_BINARY'],
            minAge: 18,
            maxAge: 99,
            maxDistanceKm: 100,
          } as any,
          location: { latitude: 10, longitude: 10 },
        });

      mockFeedRepo.findCandidates.mockResolvedValue([]);

      const query = new GetDiscoveryFeedQueryDto();
      await service.getFeed('req', query);

      expect(mockFeedRepo.findCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredGenders: ['male', 'non_binary'],
        }),
      );
    });
  });

  describe('Location Readiness', () => {
    beforeEach(() => {
      mockUserRepo.findById.mockResolvedValue({
        accountStatus: 'ACTIVE',
        deletedAt: null,
        isEmailVerified: true,
        isOnboarded: true,
      });
      mockPrivacyRepo.findByUserId.mockResolvedValue({ isHidden: false });
      mockPrisma.discoveryPreference.findUnique.mockResolvedValue({
        preferredGenders: ['MALE'],
      });
    });

    it('accepts active_location_mode = REAL with real_location present', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { active_location_mode: 'real', lng: 10, lat: 10 },
      ]);

      const readiness =
        await service.validateRequesterDiscoveryReadiness('req');
      expect(readiness.location).toEqual({ latitude: 10, longitude: 10 });
    });

    it('rejects active_location_mode = REAL with real_location null', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { active_location_mode: 'real', lng: null, lat: null },
      ]);

      await expect(
        service.validateRequesterDiscoveryReadiness('req'),
      ).rejects.toThrow('LOCATION_REQUIRED');
    });

    it('rejects non-REAL location mode', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { active_location_mode: 'passport', lng: 10, lat: 10 },
      ]);

      await expect(
        service.validateRequesterDiscoveryReadiness('req'),
      ).rejects.toThrow('LOCATION_REQUIRED');
    });
  });
});
