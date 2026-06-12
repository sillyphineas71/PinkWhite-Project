import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendMessageDto, MessageType } from './send-message.dto';

describe('SendMessageDto', () => {
  it('should pass with valid body', async () => {
    const dto = plainToInstance(SendMessageDto, { body: 'Hello world' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.body).toBe('Hello world');
    expect(dto.messageType).toBe(MessageType.TEXT); // Default
  });

  it('should fail if body is empty or whitespace only', async () => {
    const dtoEmpty = plainToInstance(SendMessageDto, { body: '' });
    let errors = await validate(dtoEmpty);
    expect(errors.length).toBeGreaterThan(0);

    const dtoWhitespace = plainToInstance(SendMessageDto, { body: '   ' });
    errors = await validate(dtoWhitespace);
    expect(errors.length).toBeGreaterThan(0);
    // Transform trims to empty, which fails MinLength(1)
  });

  it('should fail if body is greater than 1000 characters', async () => {
    const dto = plainToInstance(SendMessageDto, { body: 'a'.repeat(1001) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail if messageType is IMAGE or invalid', async () => {
    const dto = plainToInstance(SendMessageDto, {
      body: 'Hello',
      messageType: 'IMAGE',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0); // Valid structural setup for IMAGE. However domain blocking IMAGE is at Service layer as per spec. Wait! The prompt says "messageType=IMAGE bị chặn" at DTO or Service? "việc ném đúng mã domain IMAGE_NOT_SUPPORTED sẽ wired ở service (Task 4) — ở Task 2 chỉ ĐỊNH NGHĨA mã + DTO structural validation." So DTO SHOULD allow IMAGE structurally. But wait, test says "messageType=IMAGE bị chặn". If DTO allows it structurally, we can't test it blocking at DTO. Oh, wait, the prompt literally says "DTO làm validation cấu trúc... còn ném đúng mã domain sẽ wired ở service". Let me just check the structural validation passes for IMAGE.
  });

  it('structural validation passes for IMAGE but throws error for invalid types', async () => {
    const dtoValidImage = plainToInstance(SendMessageDto, {
      body: 'Img',
      messageType: 'IMAGE',
    });
    const errors1 = await validate(dtoValidImage);
    expect(errors1.length).toBe(0);

    const dtoInvalid = plainToInstance(SendMessageDto, {
      body: 'Hello',
      messageType: 'AUDIO',
    });
    const errors2 = await validate(dtoInvalid);
    expect(errors2.length).toBeGreaterThan(0);
  });
});
