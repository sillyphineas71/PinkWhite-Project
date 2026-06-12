import { Test, TestingModule } from '@nestjs/testing';
import { MatchWriteRepository } from './match-write.repository';

describe('MatchWriteRepository', () => {
  let repository: MatchWriteRepository;
  let mockTx: any;

  beforeEach(async () => {
    mockTx = {
      match: {
        findUnique: jest.fn(),
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchWriteRepository],
    }).compile();

    repository = module.get<MatchWriteRepository>(MatchWriteRepository);
  });

  describe('normalizePair', () => {
    it('should order UUID strings lexicographically', () => {
      const result1 = repository.normalizePair('b', 'a');
      expect(result1).toEqual({ userAId: 'a', userBId: 'b' });

      const result2 = repository.normalizePair('a', 'b');
      expect(result2).toEqual({ userAId: 'a', userBId: 'b' });
    });
  });

  describe('createActiveMatchSafe', () => {
    it('should use createMany with skipDuplicates and return fetched match', async () => {
      const now = new Date();
      mockTx.match.createMany.mockResolvedValue({ count: 1 });
      mockTx.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: 'ACTIVE',
      });

      const result = await repository.createActiveMatchSafe(
        mockTx,
        'user-b',
        'user-a',
        now,
      );

      expect(mockTx.match.createMany).toHaveBeenCalledWith({
        data: [
          {
            userAId: 'user-a',
            userBId: 'user-b',
            status: 'ACTIVE',
            matchedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ],
        skipDuplicates: true,
      });

      expect(mockTx.match.findUnique).toHaveBeenCalledWith({
        where: {
          userAId_userBId: {
            userAId: 'user-a',
            userBId: 'user-b',
          },
        },
      });

      expect(result).toEqual({ id: 'match-1', status: 'ACTIVE' });
    });
  });
});
