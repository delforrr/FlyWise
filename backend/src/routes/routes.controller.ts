import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoutesService } from './routes.service.js';
import { ExploreRoutesDto } from './dto/explore-routes.dto.js';
import { QueryDirectRouteDto } from './dto/query-direct-route.dto.js';
import { GlobalRoutesDto } from './dto/global-routes.dto.js';

@ApiTags('Enlaces')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('global')
  @ApiOperation({
    summary: 'Lista pares de puntos con enlaces en ambos sentidos',
  })
  global(@Query() dto: GlobalRoutesDto) {
    return this.routesService.global(dto);
  }

  @Get('explore')
  @ApiOperation({
    summary: 'Lista enlaces según los filtros indicados',
  })
  @ApiResponse({
    status: 200,
    description: 'Enlaces con coordenadas y distancias; otp15 es null',
  })
  async explore(@Query() exploreDto: ExploreRoutesDto) {
    return this.routesService.explore(exploreDto);
  }

  @Get('direct')
  @ApiOperation({
    summary: 'Consulta enlaces sin pasos intermedios entre dos puntos',
  })
  @ApiResponse({
    status: 200,
    description: 'Extremos, distancias y entidades asociadas',
  })
  @ApiResponse({
    status: 404,
    description: 'No hay enlaces coincidentes',
  })
  async findDirect(@Query() queryDto: QueryDirectRouteDto) {
    return this.routesService.findDirect(queryDto);
  }
}
