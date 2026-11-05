import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AirportsService } from './airports.service.js';
import { CatalogAirportsDto } from './dto/catalog-airports.dto.js';
import { SearchAirportsDto } from './dto/search-airports.dto.js';
import { NearbyAirportsDto } from './dto/nearby-airports.dto.js';

@ApiTags('Puntos')
@Controller('aeropuertos')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('catalogo')
  @ApiOperation({ summary: 'Lista puntos con límite y desplazamiento' })
  @ApiResponse({
    status: 200,
    description: 'Puntos ordenados por cantidad de enlaces',
  })
  catalog(@Query() dto: CatalogAirportsDto) {
    return this.airportsService.catalog(dto);
  }

  @Get('buscar')
  @ApiOperation({
    summary: 'Busca puntos por código, nombre o localidad',
  })
  @ApiResponse({
    status: 200,
    description: 'Puntos coincidentes ordenados por cantidad de enlaces',
  })
  async search(@Query() searchDto: SearchAirportsDto) {
    return this.airportsService.search(searchDto);
  }

  @Get('cercanos')
  @ApiOperation({
    summary: 'Busca puntos dentro de un radio',
  })
  @ApiResponse({
    status: 200,
    description: 'Hasta 50 puntos ordenados por distancia',
  })
  async findNearby(@Query() nearbyDto: NearbyAirportsDto) {
    return this.airportsService.findNearby(nearbyDto);
  }

  @Get('por-codigo/:codigo')
  @ApiOperation({
    summary: 'Consulta un punto por código',
  })
  @ApiParam({
    name: 'code',
    description: 'Código iata o icao del punto',
    example: 'EZE',
  })
  @ApiResponse({
    status: 200,
    description: 'Punto con coordenadas y hasta 10 enlaces asociados',
  })
  @ApiResponse({
    status: 404,
    description: 'Punto no encontrado',
  })
  async findByCode(@Param('codigo') code: string) {
    return this.airportsService.findByCode(code);
  }
}
