import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CountriesService } from './countries.service.js';

@ApiTags('Agrupaciones')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista agrupaciones',
  })
  @ApiResponse({ status: 200, description: 'Agrupaciones disponibles' })
  async findAll() {
    return this.countriesService.findAll();
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Consulta una agrupación por nombre',
  })
  @ApiParam({
    name: 'name',
    example: 'Argentina',
    description: 'Nombre de la agrupación',
  })
  @ApiResponse({
    status: 200,
    description: 'Agrupación con hasta 50 puntos asociados',
  })
  @ApiResponse({ status: 404, description: 'Agrupación no encontrada' })
  async findByName(@Param('name') name: string) {
    return this.countriesService.findByName(name);
  }
}
