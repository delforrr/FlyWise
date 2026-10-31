import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AirlinesService } from './airlines.service.js';
import { QueryAirlinesDto } from './dto/query-airlines.dto.js';

@ApiTags('Entidades')
@Controller('aerolineas')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista entidades con búsqueda y paginación',
  })
  @ApiResponse({ status: 200, description: 'Entidades y datos de paginación' })
  async findAll(@Query() queryDto: QueryAirlinesDto) {
    return this.airlinesService.findAll(queryDto);
  }

  @Get('por-codigo/:codigo')
  @ApiOperation({
    summary: 'Consulta una entidad por código',
  })
  @ApiParam({
    name: 'code',
    example: 'AR',
    description: 'Código iata o icao de la entidad',
  })
  @ApiResponse({
    status: 200,
    description: 'Entidad con hasta 20 enlaces asociados',
  })
  @ApiResponse({ status: 404, description: 'Entidad no encontrada' })
  async findByCode(@Param('codigo') code: string) {
    return this.airlinesService.findByCode(code);
  }
}
