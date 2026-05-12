import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleVisibilityDto {
  @ApiProperty({ description: 'Trạng thái ẩn danh (true = ẩn, false = hiện)', example: true })
  @IsBoolean()
  isHidden: boolean;
}
