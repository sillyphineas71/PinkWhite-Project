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
  private connected = false;

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      lazyConnect: true,
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      port: configService.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.warn('Redis unavailable. Running without Redis.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      },
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected');
    } catch {
      this.logger.warn(
        'Redis connection failed. App will continue without Redis.',
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  onModuleDestroy() {
    if (this.connected) {
      this.client.disconnect();
    }
  }
}
