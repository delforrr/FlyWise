import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EtlService } from './etl.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { TriggerEtlDto } from './dto/trigger-etl.dto.js';

@ApiTags('Cargas de datos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('iniciar/:dataset')
  @ApiOperation({
    summary: 'Solicita una carga de datos',
  })
  @ApiParam({
    name: 'dataset',
    description:
      'Conjunto de datos: all, aeropuertos, aerolineas, paises o rutas',
    example: 'all',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud recibida con identificador de ejecución',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de autenticación requerido',
  })
  async trigger(@Param() params: TriggerEtlDto) {
    return this.etlService.triggerJob(params.dataset);
  }

  @Get('estado')
  @ApiOperation({
    summary: 'Consulta los contadores de ejecuciones',
  })
  @ApiResponse({
    status: 200,
    description:
      'Contadores de ejecuciones pendientes, activas, completadas y fallidas',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de autenticación requerido',
  })
  async getStatus() {
    return this.etlService.getStatus();
  }

  @Get('historial')
  @ApiOperation({
    summary: 'Consulta el historial de ejecuciones',
  })
  @ApiResponse({
    status: 200,
    description: 'Últimas 20 ejecuciones con contadores y duración',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de autenticación requerido',
  })
  async getHistory() {
    return this.etlService.getHistory();
  }
}
