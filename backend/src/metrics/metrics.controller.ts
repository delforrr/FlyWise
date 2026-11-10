import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
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
  @Get('mapa/opciones') opcionesMapa() {
    return this.service.opcionesMapa();
  }
}
