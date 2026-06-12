export class DiscoveryCandidatePhotoDto {
  photoId: string;
  url: string;
  displayOrder: number;
}

export class DiscoveryCandidateDto {
  userId: string;
  displayName: string;
  age: number;
  gender: string;
  relationshipGoal: string;
  bio: string | null;
  photos: DiscoveryCandidatePhotoDto[];
  distanceKm: number;
}

export class DiscoveryFeedResponseDto {
  candidates: DiscoveryCandidateDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
