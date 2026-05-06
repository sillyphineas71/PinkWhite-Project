import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      lazyConnect: true,
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      port: configService.get<number>('REDIS_PORT', 6379),
    });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
