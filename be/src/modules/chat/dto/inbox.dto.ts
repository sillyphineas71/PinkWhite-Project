import { IsOptional, IsString, Max, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { MessageDto } from './message.dto';

export class InboxItemPartnerDto {
  userId: string;
  displayName: string;
  avatar: string | null;
}

export class InboxItemDto {
  matchId: string;
  partner: InboxItemPartnerDto;
  latestMessage: MessageDto | null;
  unreadCount: number;
}

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
