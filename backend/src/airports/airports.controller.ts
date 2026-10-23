import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AirportsService } from './airports.service';
import { SearchAirportsDto } from './dto/search-airports.dto';
import { NearbyAirportsDto } from './dto/nearby-airports.dto';

@ApiTags('airports')
@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Búsqueda de aeropuertos para Command Palette y autocompletado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de aeropuertos coincidentes ordenados por relevancia',
  })
  async search(@Query() searchDto: SearchAirportsDto) {
    return this.airportsService.search(searchDto);
  }

  @Get('nearby')
  @ApiOperation({
    summary:
      'Búsqueda geoespacial de aeropuertos por radio de cobertura geográfica',
  })
  @ApiResponse({
    status: 200,
    description:
      'Aeropuertos dentro del radio especificado con distancia ortodrómica calculada',
  })
  async findNearby(@Query() nearbyDto: NearbyAirportsDto) {
    return this.airportsService.findNearby(nearbyDto);
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Obtiene el detalle de un aeropuerto por código IATA o ICAO',
  })
  @ApiParam({
    name: 'code',
    description: 'Código IATA (ej. EZE) o ICAO (ej. SAEZ)',
    example: 'EZE',
  })
  @ApiResponse({
    status: 200,
    description:
      'Detalle del aeropuerto con coordenadas WGS 84 y rutas activas',
  })
  @ApiResponse({
    status: 404,
    description: 'Aeropuerto no encontrado',
  })
  async findByCode(@Param('code') code: string) {
    return this.airportsService.findByCode(code);
  }
}
