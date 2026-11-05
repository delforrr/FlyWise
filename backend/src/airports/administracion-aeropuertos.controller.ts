import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AdminGuard } from '../auth/auth.guard.js';
import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import {
  CrearAeropuertoDto,
  EditarAeropuertoDto,
} from './dto/administrar-aeropuerto.dto.js';
import { AirportsService } from './airports.service.js';

@ApiTags('Administración de aeropuertos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/aeropuertos')
export class AdministracionAeropuertosController {
  constructor(private readonly service: AirportsService) {}
  @Get() listar(@Query() consulta: ConsultaCatalogoDto) {
    return this.service.listarAdmin(consulta);
  }
  @Get(':id') detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalleAdmin(id);
  }
  @Post() crear(@Body() datos: CrearAeropuertoDto) {
    return this.service.crearAdmin(datos);
  }
  @Patch(':id') editar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: EditarAeropuertoDto,
  ) {
    return this.service.editarAdmin(id, datos);
  }
  @Delete(':id')
  @HttpCode(204)
  archivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.archivarAdmin(id);
  }
}
