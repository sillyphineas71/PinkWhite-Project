import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SuperLikeMessageDto {
  @ApiProperty({
    description: 'ID của người dùng mục tiêu',
    example: 'uuid-1234',
  })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({
    description: 'Tin nhắn đính kèm (tối đa 140 ký tự)',
    example: 'Chào bạn, làm quen nhé!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  message: string;
}
