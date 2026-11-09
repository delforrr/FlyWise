import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';
import { ConsultaMetricasDto } from './dto/consulta-metricas.dto.js';

@ApiTags('Métricas de rutas')
@Controller('metricas')
export class MetricsController {
  constructor(private readonly service: MetricsService) {}
  @Get('rutas') consultar(@Query() consulta: ConsultaMetricasDto) {
    return this.service.consultar(consulta);
  }
}
