import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT = 3000;

  @IsNotEmpty()
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN = 'http://localhost:5173';

  @IsOptional()
  @IsString()
  REDIS_HOST = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  REDIS_PORT = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  // ===== AUTH =====
  @IsNotEmpty()
  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsNotEmpty()
  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL = '7d';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  BCRYPT_ROUNDS = 10;

  // ===== GOOGLE OAUTH =====
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  // ===== EMAIL =====
  @IsOptional()
  @IsString()
  SMTP_HOST = 'smtp.gmail.com';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  SMTP_PORT = 587;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM = 'noreply@yourdomain.com';

  // ===== FRONTEND =====
  @IsOptional()
  @IsString()
  FRONTEND_URL = 'http://localhost:5173';

  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
