import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email của người dùng' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'password123', description: 'Mật khẩu (ít nhất 8 ký tự)' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
