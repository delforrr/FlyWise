import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CountriesService } from './countries.service';

@ApiTags('countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Obtiene el catálogo de países registrados en el sistema aeronáutico',
  })
  @ApiResponse({ status: 200, description: 'Lista de países' })
  async findAll() {
    return this.countriesService.findAll();
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Obtiene el detalle de un país y sus aeropuertos principales',
  })
  @ApiParam({
    name: 'name',
    example: 'Argentina',
    description: 'Nombre del país',
  })
  @ApiResponse({ status: 200, description: 'Detalle del país con aeropuertos' })
  @ApiResponse({ status: 404, description: 'País no encontrado' })
  async findByName(@Param('name') name: string) {
    return this.countriesService.findByName(name);
  }
}
