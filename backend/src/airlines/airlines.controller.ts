import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AirlinesService } from './airlines.service';
import { QueryAirlinesDto } from './dto/query-airlines.dto';

@ApiTags('airlines')
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listado paginado de aerolíneas con filtros opcionales de búsqueda',
  })
  @ApiResponse({ status: 200, description: 'Listado de aerolíneas' })
  async findAll(@Query() queryDto: QueryAirlinesDto) {
    return this.airlinesService.findAll(queryDto);
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Obtiene el detalle de una aerolínea por código IATA o ICAO',
  })
  @ApiParam({
    name: 'code',
    example: 'AR',
    description: 'Código IATA (2 letras) o ICAO (3 letras)',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la aerolínea con rutas asociadas',
  })
  @ApiResponse({ status: 404, description: 'Aerolínea no encontrada' })
  async findByCode(@Param('code') code: string) {
    return this.airlinesService.findByCode(code);
  }
}
