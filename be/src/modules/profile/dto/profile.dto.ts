import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NON_BINARY = 'NON_BINARY',
  OTHER = 'OTHER',
}

export class OnboardingDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '2000-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dob: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @ApiPropertyOptional({ enum: Gender, example: Gender.FEMALE })
  @IsEnum(Gender)
  @IsOptional()
  searchGender?: Gender;
}

export class UpdateBasicInfoDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '2000-01-01' })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  searchGender?: Gender;
}

export class UpdateBioInterestsDto {
  @ApiPropertyOptional({ example: 'Hello world', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ type: [String], example: ['id1', 'id2'] })
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsOptional()
  interestIds?: string[];
}

export class UpdateEducationJobDto {
  @ApiPropertyOptional({ example: 'Google', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ example: 'Software Engineer', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'MIT', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  school?: string;
}

export class ConfirmPhotoUploadDto {
  @ApiProperty({ example: 'https://mock-cloud.com/upload-link/file.jpg' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  isAvatar: boolean;
}

export class ReorderPhotosDto {
  @ApiProperty({ type: [String], example: ['id1', 'id2', 'id3'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  photoIds: string[];
}

export class UpdateLocationDto {
  @ApiProperty({ example: 10.762622 })
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 106.660172 })
  @IsNotEmpty()
  lng: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  isMocked?: boolean;
}

export class UpdatePassportDto {
  @ApiProperty({ example: 35.689487 })
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 139.691706 })
  @IsNotEmpty()
  lng: number;
}
