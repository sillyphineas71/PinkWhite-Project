import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

type HealthResponse = {
  service: string;
  status: 'ok';
  timestamp: string;
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API health status.' })
  check(): HealthResponse {
    return {
      service: 'matchmaking-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
