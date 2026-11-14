import { resolverIdentidadAeropuerto } from './resolver-identidad-aeropuerto.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { JwtAuthGuard, AdminGuard } from '../auth/auth.guard.js';
import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { escaparLike } from '../prisma/escape-like.js';

class IdentityParams {
  @IsIn(['OurAirports', 'OpenFlights']) fuente!: string;
  @IsString() @Length(1, 100) identificador!: string;
}
class ResolveIdentityDto {
  @IsUUID() aeropuertoId!: string;
}

@ApiTags('Correspondencias de fuentes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/fuentes/identidades')
export class CatalogIdentitiesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async pending(@Query() query: ConsultaCatalogoDto) {
    let rows = this.prisma.models.IdentidadAeropuertoFuente.where({
      aeropuertoId: null,
    }).where((identity) => identity.fuente.in(['OurAirports', 'OpenFlights']));
    if (query.busqueda)
      rows = rows.where((i) =>
        i.identificador.ilike(`%${escaparLike(query.busqueda!)}%`),
      );
    return rows
      .orderBy((i) => i.identificador.asc())
      .offset((query.pagina - 1) * query.limite)
      .limit(query.limite)
      .all();
  }
  @Patch(':fuente/:identificador')
  async resolve(
    @Param() params: IdentityParams,
    @Body() dto: ResolveIdentityDto,
  ) {
    return resolverIdentidadAeropuerto(
      this.prisma.db,
      params,
      dto.aeropuertoId,
    );
  }
}
