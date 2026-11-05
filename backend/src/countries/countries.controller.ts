import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CountriesService } from './countries.service.js';

@ApiTags('Agrupaciones')
@Controller('paises')
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

  @Get(':nombre')
  @ApiOperation({
    summary: 'Consulta una agrupación por nombre',
  })
  @ApiParam({
    name: 'nombre',
    example: 'Argentina',
    description: 'Nombre de la agrupación',
  })
  @ApiResponse({
    status: 200,
    description: 'Agrupación con hasta 50 puntos asociados',
  })
  @ApiResponse({ status: 404, description: 'Agrupación no encontrada' })
  async findByName(@Param('nombre') nombre: string) {
    return this.countriesService.findByName(nombre);
  }
}
