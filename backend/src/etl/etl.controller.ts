import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EtlService } from './etl.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@ApiTags('etl')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('trigger/:dataset')
  @ApiOperation({
    summary:
      'Dispara un proceso asíncrono de actualización y normalización de catálogo aeronáutico',
  })
  @ApiParam({
    name: 'dataset',
    description:
      'Identificador del catálogo a sincronizar: all, airports, airlines, countries',
    example: 'all',
  })
  @ApiResponse({
    status: 201,
    description: 'Proceso asíncrono encolado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de autenticación requerido',
  })
  async trigger(@Param('dataset') dataset: string) {
    return this.etlService.triggerJob(dataset);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Consulta las métricas en tiempo real de los procesos asíncronos',
  })
  @ApiResponse({
    status: 200,
    description:
      'Métricas de procesamiento (tareas en espera, activas, completadas y fallidas)',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de autenticación requerido',
  })
  async getStatus() {
    return this.etlService.getStatus();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Historial de ejecuciones y auditoría de sincronizaciones',
  })
  @ApiResponse({
    status: 200,
    description:
      'Registro histórico de procesos con conteo de registros y tiempos de ejecución',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de autenticación requerido',
  })
  async getHistory() {
    return this.etlService.getHistory();
  }
}
