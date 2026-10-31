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
  CrearRutaDto,
  EditarRutaDto,
  CrearOfertaRutaDto,
  EditarOfertaRutaDto,
} from './dto/administrar-ruta.dto.js';
import { RoutesService } from './routes.service.js';

@ApiTags('Administración de rutas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/rutas')
export class AdministracionRutasController {
  constructor(private readonly service: RoutesService) {}
  @Get() listar(@Query() consulta: ConsultaCatalogoDto) {
    return this.service.listarAdmin(consulta);
  }
  @Get(':id') detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalleAdmin(id);
  }
  @Post() crear(@Body() datos: CrearRutaDto) {
    return this.service.crearAdmin(datos);
  }
  @Patch(':id') editar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: EditarRutaDto,
  ) {
    return this.service.editarAdmin(id, datos);
  }
  @Delete(':id')
  @HttpCode(204)
  archivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.archivarAdmin(id);
  }
  @Post(':id/ofertas') crearOferta(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: CrearOfertaRutaDto,
  ) {
    return this.service.crearOferta(id, datos);
  }
  @Patch(':id/ofertas/:ofertaId') editarOferta(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('ofertaId', new ParseUUIDPipe()) ofertaId: string,
    @Body() datos: EditarOfertaRutaDto,
  ) {
    return this.service.editarOferta(id, ofertaId, datos);
  }
  @Delete(':id/ofertas/:ofertaId')
  @HttpCode(204)
  archivarOferta(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('ofertaId', new ParseUUIDPipe()) ofertaId: string,
  ) {
    return this.service.archivarOferta(id, ofertaId);
  }
}
