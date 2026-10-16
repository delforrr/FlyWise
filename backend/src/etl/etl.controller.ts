import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EtlService } from './etl.service';

@ApiTags('etl')
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('trigger/:dataset')
  @ApiOperation({
    summary:
      'Dispara un trabajo asíncrono de ingesta y normalización de datasets OpenFlights',
  })
  @ApiParam({
    name: 'dataset',
    description:
      'Nombre del dataset a procesar: all, airports, airlines, countries',
    example: 'all',
  })
  @ApiResponse({
    status: 201,
    description: 'Trabajo encolado en BullMQ exitosamente',
  })
  async trigger(@Param('dataset') dataset: string) {
    return this.etlService.triggerJob(dataset);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Consulta las métricas en tiempo real de la cola BullMQ',
  })
  @ApiResponse({
    status: 200,
    description:
      'Métricas de la cola de procesamiento (espera, activos, completados, fallidos)',
  })
  async getStatus() {
    return this.etlService.getStatus();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Historial de ejecuciones y auditoría de pipelines ETL',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de los últimos jobs ejecutados con conteo de filas y duración',
  })
  async getHistory() {
    return this.etlService.getHistory();
  }
}
