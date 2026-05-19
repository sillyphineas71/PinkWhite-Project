import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetMatchesQueryDto {
  @ApiPropertyOptional({ description: 'Cursor dùng cho phân trang', example: 'uuid-cursor' })
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Số lượng trả về tối đa (tối đa 50)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
