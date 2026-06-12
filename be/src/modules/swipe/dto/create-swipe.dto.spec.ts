import { validate } from 'class-validator';
import { CreateSwipeDto, CreateSwipeAction } from './create-swipe.dto';
describe('CreateSwipeDto', () => {
  it('should accept valid PASS action', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = '123e4567-e89b-12d3-a456-426614174000';
    dto.action = CreateSwipeAction.PASS;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept valid LIKE action', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = '123e4567-e89b-12d3-a456-426614174000';
    dto.action = CreateSwipeAction.LIKE;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept valid SUPER_LIKE action', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = '123e4567-e89b-12d3-a456-426614174000';
    dto.action = CreateSwipeAction.SUPER_LIKE;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject REWIND action', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = '123e4567-e89b-12d3-a456-426614174000';
    (dto as any).action = 'REWIND';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('action');
  });

  it('should reject invalid targetUserId (not uuid)', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = 'invalid-uuid';
    dto.action = CreateSwipeAction.LIKE;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('targetUserId');
  });

  it('should reject invalid action (lowercase)', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = '123e4567-e89b-12d3-a456-426614174000';
    (dto as any).action = 'like';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('action');
  });

  it('should reject invalid action (random string)', async () => {
    const dto = new CreateSwipeDto();
    dto.targetUserId = '123e4567-e89b-12d3-a456-426614174000';
    (dto as any).action = 'INVALID_ACTION';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('action');
  });
});
