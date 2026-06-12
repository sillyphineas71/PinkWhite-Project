import { ApiProperty } from '@nestjs/swagger';
import { CreateSwipeAction } from './create-swipe.dto';

export class SwipeResponseDto {
  @ApiProperty({ description: 'ID of the target user', format: 'uuid' })
  targetUserId: string;

  @ApiProperty({
    description: 'Swipe action performed',
    enum: CreateSwipeAction,
  })
  action: CreateSwipeAction | string;

  @ApiProperty({ description: 'Whether a match was created' })
  matched: boolean;

  @ApiProperty({
    description: 'ID of the created match, if any',
    format: 'uuid',
    nullable: true,
  })
  matchId: string | null;
}
