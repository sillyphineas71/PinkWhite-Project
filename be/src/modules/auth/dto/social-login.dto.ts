import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ example: 'google-id-token' })
  @IsString()
  idToken!: string;
}
