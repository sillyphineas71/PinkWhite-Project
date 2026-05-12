import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum GenderFilter {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NON_BINARY = 'NON_BINARY',
  OTHER = 'OTHER',
  ALL = 'ALL',
}

export class CreatePreferenceDto {
  @ApiProperty({ description: 'Độ tuổi tối thiểu (>= 18)', example: 18 })
  @IsInt()
  @Min(18)
  @Max(100)
  minAge: number;

  @ApiProperty({ description: 'Độ tuổi tối đa (<= 100)', example: 35 })
  @IsInt()
  @Min(18)
  @Max(100)
  maxAge: number;

  @ApiProperty({ description: 'Lọc theo giới tính', enum: GenderFilter, example: GenderFilter.FEMALE })
  @IsEnum(GenderFilter)
  genderFilter: GenderFilter;

  @ApiProperty({ description: 'Khoảng cách tối đa (km). Gói Free tối đa 200km.', example: 50 })
  @IsInt()
  @Min(1)
  maxDistance: number;
}
