import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';
import { ContextoRutaDto } from './dto/contexto-ruta.dto.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';
import { ConsultaMetricasDto } from './dto/consulta-metricas.dto.js';
import { ConsultaMapaDto } from './dto/consulta-mapa.dto.js';

@ApiTags('Métricas de rutas')
@Controller('metricas')
export class MetricsController {
  constructor(private readonly service: MetricsService) {}
  @Get('rutas') consultar(@Query() consulta: ConsultaMetricasDto) {
    return this.service.consultar(consulta);
  }
  @Post('mapa')
  @HttpCode(200)
  consultarMapa(@Body() consulta: ConsultaMapaDto) {
    return this.service.consultarMapa(consulta);
  }
  @Get('mapa/contexto') contextoRuta(@Query() consulta: ContextoRutaDto) {
    return this.service.contextoRuta(consulta);
  }
  @Get('mapa/opciones') opcionesMapa() {
    return this.service.opcionesMapa();
  }
}

@ApiTags('Métricas de rutas')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/metricas')
export class MetricasAdministrativasController {
  constructor(private readonly service: MetricsService) {}

  @Get('rutas')
  consultar(@Query() consulta: ConsultaMetricasDto) {
    return this.service.consultar(consulta, undefined, true);
  }
}
