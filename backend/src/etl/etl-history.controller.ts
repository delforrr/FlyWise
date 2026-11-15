import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { PipelinesService } from './pipelines.service.js';

@ApiTags('Cargas de datos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('etl')
export class EtlHistoryController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get('historial')
  @ApiOperation({ summary: 'Consulta el historial de ejecuciones' })
  getHistory() {
    return this.pipelines.getHistory();
  }
}
