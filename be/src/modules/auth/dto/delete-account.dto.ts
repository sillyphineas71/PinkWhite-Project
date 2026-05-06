import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: 'password123' })
  @IsString()
  password!: string;
}
