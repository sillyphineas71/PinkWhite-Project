import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CreateSwipeAction {
  PASS = 'PASS',
  LIKE = 'LIKE',
  SUPER_LIKE = 'SUPER_LIKE',
}

export class CreateSwipeDto {
  @ApiProperty({ description: 'ID of the target user', format: 'uuid' })
  @IsUUID()
  targetUserId: string;

  @ApiProperty({ description: 'Swipe action', enum: CreateSwipeAction })
  @IsEnum(CreateSwipeAction)
  action: CreateSwipeAction;
}
