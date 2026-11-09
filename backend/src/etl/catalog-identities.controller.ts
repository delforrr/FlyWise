import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { JwtAuthGuard, AdminGuard } from '../auth/auth.guard.js';
import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { escribirCatalogo } from '../catalogos/catalog-state.js';
import { storeOurAirportsBatch } from './adapters/ourairports-store.js';
import type { CatalogRecord } from './catalog.js';
import { upsertCatalogBatch } from './catalog-store.js';
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
    return escribirCatalogo(this.prisma.db, async (tx) => {
      const identity =
        await tx.orm.public.IdentidadAeropuertoFuente.first(params);
      if (!identity) throw new NotFoundException('Identidad no encontrada');
      const airport = await tx.orm.public.Aeropuerto.first({
        id: dto.aeropuertoId,
        archivadoEn: null,
      });
      if (!airport)
        throw new BadRequestException('Aeropuerto inexistente o archivado');
      if (identity.aeropuertoId && identity.aeropuertoId !== airport.id)
        throw new BadRequestException('La identidad ya está resuelta');
      await tx.orm.public.IdentidadAeropuertoFuente.where(params).update({
        aeropuertoId: airport.id,
      });
      if (params.fuente === 'OpenFlights') {
        const idOpenflights = Number(params.identificador);
        if (
          !Number.isInteger(idOpenflights) ||
          idOpenflights <= 0 ||
          idOpenflights > 2147483647 ||
          (airport.idOpenflights !== null &&
            airport.idOpenflights !== idOpenflights)
        )
          throw new BadRequestException(
            'Identificador OpenFlights incompatible',
          );
        await tx.orm.public.Aeropuerto.where({ id: airport.id }).update({
          idOpenflights,
        });
        await upsertCatalogBatch(tx, 'aeropuertos', [
          {
            ...(identity.observacion as CatalogRecord),
            id: airport.id,
            idOpenflights,
          },
        ]);
      } else {
        await storeOurAirportsBatch(tx, 'aeropuertos', [
          identity.observacion as CatalogRecord,
        ]);
      }
      return tx.orm.public.IdentidadAeropuertoFuente.firstOrThrow(params);
    });
  }
}
