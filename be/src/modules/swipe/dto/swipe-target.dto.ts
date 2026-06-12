import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SwipeTargetDto {
  @ApiProperty({
    description: 'ID của người dùng mục tiêu bị quẹt',
    example: 'uuid-1234',
  })
  @IsString()
  @IsNotEmpty()
  targetId: string;
}
