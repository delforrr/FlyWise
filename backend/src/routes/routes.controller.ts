import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { ExploreRoutesDto } from './dto/explore-routes.dto';
import { QueryDirectRouteDto } from './dto/query-direct-route.dto';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('explore')
  @ApiOperation({
    summary:
      'Exploración de rutas aéreas: sirve las Top 100 por defecto (anti-saturación) o conexiones bajo demanda',
  })
  @ApiResponse({
    status: 200,
    description:
      'Colección de rutas comerciales geodésicas con coordenadas y métricas de popularidad',
  })
  async explore(@Query() exploreDto: ExploreRoutesDto) {
    return this.routesService.explore(exploreDto);
  }

  @Get('direct')
  @ApiOperation({
    summary: 'Consulta de tramo directo entre un par de aeropuertos',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del tramo, distancia y aerolíneas operadoras',
  })
  @ApiResponse({
    status: 404,
    description: 'No existen rutas directas entre el par indicado',
  })
  async findDirect(@Query() queryDto: QueryDirectRouteDto) {
    return this.routesService.findDirect(queryDto);
  }
}
