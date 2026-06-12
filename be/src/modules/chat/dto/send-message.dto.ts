import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
}

export class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType = MessageType.TEXT;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body: string;
}
