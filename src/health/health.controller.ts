import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Chequeo de salud: la app y la conexión a la base (lo usa Railway)' })
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'up' };
    } catch (err) {
      this.logger.error(`La base no responde: ${(err as Error).message}`);
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
  }
}
