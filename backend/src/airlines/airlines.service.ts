import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import {
  bloquearCatalogo,
  recalcularCantidadRutas,
} from '../prisma/catalog-state.js';
import { errorCatalogo } from '../prisma/catalog-error.js';
import {
  CrearAerolineaDto,
  EditarAerolineaDto,
} from './dto/administrar-aerolinea.dto.js';
import { and, or } from '@prisma/orm-postgres/orm-client';
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryAirlinesDto } from './dto/query-airlines.dto.js';

@Injectable()
export class AirlinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ q, page = 1, limit = 20 }: QueryAirlinesDto) {
    const term = q?.trim();
    const aerolineas = term
      ? this.prisma.models.Aerolinea.where({ archivadoEn: null }).where(
          (aerolinea) =>
            or(
              aerolinea.iata.eq(term.toUpperCase()),
              aerolinea.icao.eq(term.toUpperCase()),
              aerolinea.nombre.ilike(`%${term.replace(/[\\%_]/g, '\\$&')}%`),
            ),
        )
      : this.prisma.models.Aerolinea.where({ archivadoEn: null });
    const [data, { totalItems }] = await Promise.all([
      aerolineas
        .orderBy([
          (aerolinea, { fns }) =>
            fns.raw`COALESCE(${aerolinea.activa}::int, -1)`
              .returns('pg/int4@1')
              .desc(),
          (aerolinea) => aerolinea.nombre.asc(),
          (aerolinea) => aerolinea.id.asc(),
        ])
        .offset((page - 1) * limit)
        .limit(limit)
        .all(),
      aerolineas.aggregate((aggregate) => ({ totalItems: aggregate.count() })),
    ]);
    return {
      data,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findByCode(code: string) {
    const upperCode = code.trim().toUpperCase();
    const aerolineas = await this.prisma.models.Aerolinea.where({
      archivadoEn: null,
    })
      .where((aerolinea) =>
        or(aerolinea.iata.eq(upperCode), aerolinea.icao.eq(upperCode)),
      )
      .include('ofertas', (rutas) =>
        rutas
          .where((r) =>
            and(
              r.archivadoEn.isNull(),
              r.ruta.some((conexion) =>
                and(
                  conexion.archivadoEn.isNull(),
                  conexion.origen.some({ archivadoEn: null }),
                  conexion.destino.some({ archivadoEn: null }),
                ),
              ),
            ),
          )
          .limit(20)
          .include('ruta', (ruta) => ruta.include('origen').include('destino')),
      )
      .limit(2)
      .all();
    if (aerolineas.length > 1)
      throw new ConflictException(
        'Código ambiguo; seleccione la entidad por su identidad interna',
      );
    const [aerolinea] = aerolineas;
    if (!aerolinea)
      throw new NotFoundException(
        `Aerolínea con código ${upperCode} no encontrada`,
      );
    return aerolinea;
  }

  async listarAdmin(consulta: ConsultaCatalogoDto) {
    let query = this.prisma.models.Aerolinea;
    if (consulta.estado === 'vigentes')
      query = query.where({ archivadoEn: null });
    if (consulta.estado === 'archivados')
      query = query.where((a) => a.archivadoEn.isNotNull());
    if (consulta.busqueda) {
      const patron = `%${consulta.busqueda.replace(/[\\%_]/g, '\\$&')}%`;
      query = query.where((a) =>
        or(a.nombre.ilike(patron), a.iata.ilike(patron), a.icao.ilike(patron)),
      );
    }
    const [datos, resumen] = await Promise.all([
      query
        .orderBy([(a) => a.nombre.asc(), (a) => a.id.asc()])
        .offset((consulta.pagina - 1) * consulta.limite)
        .limit(consulta.limite)
        .all(),
      query.aggregate((a) => ({ total: a.count() })),
    ]);
    return {
      datos,
      total: Number(resumen.total),
      pagina: consulta.pagina,
      limite: consulta.limite,
    };
  }

  async detalleAdmin(id: string) {
    const registro = await this.prisma.models.Aerolinea.first({ id });
    if (!registro) throw new NotFoundException('La aerolínea no existe');
    return registro;
  }

  crearAdmin(datos: CrearAerolineaDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        const pais = datos.paisId
          ? await tx.orm.public.Pais.first({ id: datos.paisId })
          : null;
        if (datos.paisId && !pais)
          throw new NotFoundException('El país no existe');
        return tx.orm.public.Aerolinea.create({
          ...datos,
          pais: pais?.nombre ?? null,
          fuente: 'Administrativa',
          protegidoManualmente: true,
          vinculoPaisInferido: false,
        });
      })
      .catch(errorCatalogo);
  }

  editarAdmin(id: string, datos: EditarAerolineaDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        const actual = await tx.orm.public.Aerolinea.first({ id });
        if (!actual) throw new NotFoundException('La aerolínea no existe');
        if (actual.archivadoEn)
          throw new ConflictException('La aerolínea está archivada');
        const { protegidoManualmente, ...cambios } = datos;
        const pais = datos.paisId
          ? await tx.orm.public.Pais.first({ id: datos.paisId })
          : null;
        if (datos.paisId && !pais)
          throw new NotFoundException('El país no existe');
        return tx.orm.public.Aerolinea.where({ id }).update({
          ...cambios,
          ...(datos.paisId !== undefined
            ? { pais: pais?.nombre ?? null, vinculoPaisInferido: false }
            : {}),
          protegidoManualmente: Object.keys(cambios).length
            ? true
            : (protegidoManualmente ?? actual.protegidoManualmente),
        });
      })
      .catch(errorCatalogo);
  }

  async archivarAdmin(id: string) {
    await this.prisma.db.transaction(async (tx) => {
      await bloquearCatalogo(tx);
      const actual = await tx.orm.public.Aerolinea.first({ id });
      if (!actual) throw new NotFoundException('La aerolínea no existe');
      if (actual.archivadoEn) return;
      await tx.orm.public.Aerolinea.where({ id }).update({
        archivadoEn: new Date()
          .toISOString()
          .replace('T', ' ')
          .replace('Z', ''),
      });
      await recalcularCantidadRutas(tx);
    });
  }
}
