import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { UserDto } from '../users/dto/user.dto.js';
import { ActividadService } from './actividad.service.js';
import {
  ConfiguracionAnacDto,
  ConsultaActividadDto,
  CorrespondenciaAnacDto,
  PeriodoAnacDto,
} from './actividad.dto.js';
import { SampleQueryDto } from '../etl/dto/sample-query.dto.js';

@ApiTags('Actividad ANAC')
@ApiBearerAuth()
@ApiResponse({ status: 403, description: 'Se requiere ADMIN' })
@ApiResponse({ status: 400, description: 'Parámetros o fuente inválidos' })
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/actividad-anac')
export class ActividadController {
  constructor(private readonly service: ActividadService) {}
  @Get()
  @ApiOperation({
    summary:
      'Movimientos del mes publicado, con filtros y muestra conocida de pasajeros',
  })
  consultar(@Query() dto: ConsultaActividadDto) {
    return this.service.consultar(dto);
  }
  @Get('conectividad')
  @ApiOperation({
    summary:
      'Tramos observados desde despegues; no duplica aterrizajes ni cuenta vuelos únicos',
  })
  conectividad(@Query() dto: ConsultaActividadDto) {
    return this.service.consultar(dto, true);
  }
  @Get('configuracion')
  @ApiOperation({
    summary: 'Consulta ficha anual, pausa y programación mensual UTC',
  })
  configuracion() {
    return this.service.configuracion();
  }
  @Patch('configuracion')
  @ApiOperation({ summary: 'Configura ficha anual y programación mensual UTC' })
  configurar(@Body() dto: ConfiguracionAnacDto) {
    return this.service.guardarConfiguracion(dto);
  }
  @Post('ejecutar')
  @ApiOperation({
    summary: 'Encola un mes seleccionado, sin backfill histórico',
  })
  ejecutar(@Body() dto: PeriodoAnacDto, @CurrentUser() user: UserDto) {
    return this.service.ejecutar(dto.periodo, user.id);
  }
  @Get('ejecuciones')
  @ApiOperation({
    summary: 'Últimas 20 ejecuciones y contadores de cada intento',
  })
  ejecuciones() {
    return this.service.ejecuciones();
  }
  @Get('ejecuciones/:id/muestras')
  @ApiOperation({
    summary:
      'Hasta 100 rechazos del intento solicitado, incluido un intento anterior',
  })
  muestras(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: SampleQueryDto,
  ) {
    return this.service.muestras(id, dto.intento);
  }
  @Post('ejecuciones/:id/reintentar')
  @ApiOperation({
    summary: 'Crea otra ejecución con el mismo mes y ficha de origen',
  })
  reintentar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.service.reintentar(id, user.id);
  }
  @Get('revisiones')
  @ApiOperation({
    summary: 'Revisiones del mes, estado de publicación y checksum de origen',
  })
  revisiones(@Query() dto: PeriodoAnacDto) {
    return this.service.revisiones(dto.periodo);
  }
  @Get('correspondencias')
  @ApiOperation({
    summary:
      'Códigos nacionales FAA/OACI y correspondencias explícitas del mes',
  })
  correspondencias(@Query() dto: ConsultaActividadDto) {
    return this.service.correspondencias(dto);
  }
  @Patch('correspondencias')
  @ApiOperation({
    summary: 'Vincula explícitamente un código ANAC a un aeropuerto',
  })
  resolver(@Body() dto: CorrespondenciaAnacDto) {
    return this.service.resolver(dto);
  }
}
