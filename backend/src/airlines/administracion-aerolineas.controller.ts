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
  CrearAerolineaDto,
  EditarAerolineaDto,
} from './dto/administrar-aerolinea.dto.js';
import { AirlinesService } from './airlines.service.js';

@ApiTags('Administración de aerolineas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/aerolineas')
export class AdministracionAerolineasController {
  constructor(private readonly service: AirlinesService) {}
  @Get() listar(@Query() consulta: ConsultaCatalogoDto) {
    return this.service.listarAdmin(consulta);
  }
  @Get(':id') detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.detalleAdmin(id);
  }
  @Post() crear(@Body() datos: CrearAerolineaDto) {
    return this.service.crearAdmin(datos);
  }
  @Patch(':id') editar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() datos: EditarAerolineaDto,
  ) {
    return this.service.editarAdmin(id, datos);
  }
  @Delete(':id')
  @HttpCode(204)
  archivar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.archivarAdmin(id);
  }
}
