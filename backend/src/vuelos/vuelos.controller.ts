import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AdminGuard } from '../auth/auth.guard.js';
import { VuelosService } from './vuelos.service.js';
import {
  ConsultaVuelosDto,
  EditarVueloDto,
  OperacionDto,
  VersionVueloDto,
} from './dto/vuelo.dto.js';
import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';

type Actor = { user: { id: string } };
@ApiTags('Administración de operaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/vuelos')
export class VuelosController {
  constructor(private readonly service: VuelosService) {}
  @Get() listar(@Query() consulta: ConsultaVuelosDto) {
    return this.service.listar(consulta);
  }
  @Post() crear(@Body() datos: OperacionDto, @Req() req: Actor) {
    return this.service.crear(datos, req.user.id);
  }
  @Get(':id') detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalle(id);
  }
  @Get(':id/historial') historial(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() consulta: ConsultaCatalogoDto,
  ) {
    return this.service.historial(id, consulta.pagina, consulta.limite);
  }
  @Patch(':id') editar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: EditarVueloDto,
    @Req() req: Actor,
  ) {
    return this.service.editar(id, datos, req.user.id);
  }
  @Post(':id/archivar') archivar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: VersionVueloDto,
    @Req() req: Actor,
  ) {
    return this.service.archivar(id, datos.version, req.user.id);
  }
  @Post(':id/restaurar') restaurar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: VersionVueloDto,
    @Req() req: Actor,
  ) {
    return this.service.restaurar(id, datos.version, req.user.id);
  }
  @Post(':id/restablecer-fuente') restablecer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: VersionVueloDto,
    @Req() req: Actor,
  ) {
    return this.service.restablecerFuente(id, datos.version, req.user.id);
  }
}
