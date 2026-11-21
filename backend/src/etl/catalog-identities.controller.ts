import { resolverIdentidadAeropuerto } from './resolver-identidad-aeropuerto.js';
import {
  cambiarRechazoIdentidadAeropuerto,
  rechazarTodasIdentidadesAeropuerto,
} from './rechazar-identidad-aeropuerto.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsString, IsUUID, Length } from 'class-validator';
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
class ConsultaIdentidadesDto extends ConsultaCatalogoDto {
  @ApiPropertyOptional({
    description: 'Listar rechazadas en lugar de pendientes',
  })
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  rechazadas: boolean = false;
}
class RechazoIdentityDto {
  @IsBoolean() rechazado!: boolean;
}

@ApiTags('Correspondencias de fuentes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/fuentes/identidades')
export class CatalogIdentitiesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async pending(@Query() query: ConsultaIdentidadesDto) {
    let rows = this.prisma.models.IdentidadAeropuertoFuente.where({
      aeropuertoId: null,
    }).where((identity) => identity.fuente.in(['OurAirports', 'OpenFlights']));
    rows = query.rechazadas
      ? rows.where((i) => i.rechazadoEn.isNotNull())
      : rows.where({ rechazadoEn: null });
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
  @Patch('rechazar-todo')
  async rechazarTodo() {
    const rechazadas = await rechazarTodasIdentidadesAeropuerto(this.prisma.db);
    return { rechazadas };
  }
  @Patch(':fuente/:identificador/rechazo')
  async rechazar(
    @Param() params: IdentityParams,
    @Body() dto: RechazoIdentityDto,
  ) {
    return cambiarRechazoIdentidadAeropuerto(
      this.prisma.db,
      params,
      dto.rechazado,
    );
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
