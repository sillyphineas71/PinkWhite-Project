import { Test, TestingModule } from '@nestjs/testing';
import { MatchCreationService } from './match-creation.service';
import { MatchWriteRepository } from '../repositories/match-write.repository';
import { MatchException, MatchErrorCode } from '../match.types';
import { Prisma } from '@prisma/client';

describe('MatchCreationService', () => {
  let service: MatchCreationService;
  let matchWriteRepo: jest.Mocked<MatchWriteRepository>;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {} as any;
    
    matchWriteRepo = {
      normalizePair: jest.fn(),
      findMatchByPair: jest.fn(),
      createActiveMatchSafe: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchCreationService,
        { provide: MatchWriteRepository, useValue: matchWriteRepo },
      ],
    }).compile();

    service = module.get<MatchCreationService>(MatchCreationService);
  });

  it('should create an active match', async () => {
    const occurredAt = new Date();
    const expectedMatch = { id: 'match-1', status: 'ACTIVE' };
    matchWriteRepo.createActiveMatchSafe.mockResolvedValue(expectedMatch as any);

    const result = await service.createMatchPair(mockTx, {
      requesterId: 'user-a',
      targetUserId: 'user-b',
      occurredAt,
    });

    expect(matchWriteRepo.createActiveMatchSafe).toHaveBeenCalledWith(mockTx, 'user-a', 'user-b', occurredAt);
    expect(result).toEqual(expectedMatch);
  });

  it('should throw TARGET_NOT_AVAILABLE if match exists but is non-active', async () => {
    const existingMatch = { id: 'match-existing', status: 'UNMATCHED' };
    matchWriteRepo.createActiveMatchSafe.mockResolvedValue(existingMatch as any);

    await expect(service.createMatchPair(mockTx, {
      requesterId: 'user-a',
      targetUserId: 'user-b',
      occurredAt: new Date(),
    })).rejects.toThrow(new MatchException(MatchErrorCode.TARGET_NOT_AVAILABLE));
  });

  it('should throw internal error if createActiveMatchSafe returns null', async () => {
    matchWriteRepo.createActiveMatchSafe.mockResolvedValue(null);

    await expect(service.createMatchPair(mockTx, {
      requesterId: 'user-a',
      targetUserId: 'user-b',
      occurredAt: new Date(),
    })).rejects.toThrow('Internal consistency error: Match not found after createMany');
  });
});
