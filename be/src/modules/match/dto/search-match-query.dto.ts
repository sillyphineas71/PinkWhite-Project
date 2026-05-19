import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchMatchQueryDto {
  @ApiProperty({ description: 'Từ khóa tìm kiếm (tên đối phương)', example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  q: string;
}
