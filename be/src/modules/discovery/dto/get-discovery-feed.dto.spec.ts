import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetDiscoveryFeedQueryDto } from './get-discovery-feed.dto';

describe('GetDiscoveryFeedQueryDto', () => {
  it('missing limit uses default 20', async () => {
    const dto = new GetDiscoveryFeedQueryDto();
    expect(dto.limit).toBe(20);
  });

  it('limit below 1 rejected', async () => {
    const obj = { limit: 0 };
    const dto = plainToInstance(GetDiscoveryFeedQueryDto, obj);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('limit above 50 rejected', async () => {
    const obj = { limit: 51 };
    const dto = plainToInstance(GetDiscoveryFeedQueryDto, obj);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('valid limit accepted', async () => {
    const obj = { limit: 10 };
    const dto = plainToInstance(GetDiscoveryFeedQueryDto, obj);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.limit).toBe(10);
  });
});
