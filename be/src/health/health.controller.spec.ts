import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns api health status', () => {
    expect(controller.check()).toEqual(
      expect.objectContaining({
        service: 'matchmaking-api',
        status: 'ok',
      }),
    );
  });
});
