import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import {
  bloquearCatalogo,
  recalcularCantidadRutas,
} from '../prisma/catalog-state.js';
import { errorCatalogo } from '../prisma/catalog-error.js';
import type { Transaction } from '../prisma/db.js';
import {
  CrearRutaDto,
  EditarRutaDto,
  CrearOfertaRutaDto,
  EditarOfertaRutaDto,
} from './dto/administrar-ruta.dto.js';
import {
  and,
  or,
  type Condition,
  type CollectionRowOf,
} from '@prisma/orm-postgres/orm-client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExploreRoutesDto } from './dto/explore-routes.dto.js';
import { QueryDirectRouteDto } from './dto/query-direct-route.dto.js';
import { GlobalRoutesDto } from './dto/global-routes.dto.js';
import { COUNTRY_CONTINENTS } from '../countries/continents.js';

export interface GlobalConnection {
  id: string;
  origenId: string;
  destinoId: string;
  ida: DeckGlArcRoute[];
  vuelta: DeckGlArcRoute[];
}

export interface DeckGlArcRoute {
  id: string;
  rutaId: string;
  origen: {
    id: string;
    icao: string | null;
    iata: string | null;
    nombre: string;
    ciudad: string | null;
    pais: string;
    coordenadas: [number, number]; // [longitud, latitud] estándar Deck.gl
  };
  destino: {
    id: string;
    icao: string | null;
    iata: string | null;
    nombre: string;
    ciudad: string | null;
    pais: string;
    coordenadas: [number, number]; // [longitud, latitud] estándar Deck.gl
  };
  aerolinea: {
    iata: string | null;
    nombre: string;
  };
  distanciaKm: number | null;
  distanciaNm: number | null;
  otp15: null;
  escalas: number;
}

function includeRouteDetails(prisma: PrismaService) {
  return prisma.models.OfertaRuta.where((r) =>
    and(
      r.archivadoEn.isNull(),
      r.ruta.some((conexion) =>
        and(
          conexion.archivadoEn.isNull(),
          conexion.origen.some({ archivadoEn: null }),
          conexion.destino.some({ archivadoEn: null }),
        ),
      ),
      or(r.aerolineaId.isNull(), r.aerolinea.some({ archivadoEn: null })),
    ),
  )
    .include('ruta', (ruta) => ruta.include('origen').include('destino'))
    .include('aerolinea');
}

type RouteWithRelations = CollectionRowOf<
  ReturnType<typeof includeRouteDetails>
>;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async global(dto: GlobalRoutesDto): Promise<GlobalConnection[]> {
    if (
      (dto.mode === 'paises' && dto.paisOrigenId === dto.paisDestinoId) ||
      (dto.mode === 'continents' &&
        dto.continenteOrigen === dto.continenteDestino)
    ) {
      throw new BadRequestException('Selecciona dos lugares diferentes');
    }
    const entries = Object.entries(COUNTRY_CONTINENTS);
    const originCodes = JSON.stringify(
      entries
        .filter(
          ([, continent]) =>
            dto.mode !== 'continents' || continent === dto.continenteOrigen,
        )
        .map(([iso]) => iso),
    );
    const destinationCodes = JSON.stringify(
      entries
        .filter(
          ([, continent]) =>
            dto.mode !== 'continents' || continent === dto.continenteDestino,
        )
        .map(([iso]) => iso),
    );
    const symmetric = dto.mode === 'global' || dto.mode === 'domestic';
    const selected = await this.prisma.db.query(
      this.prisma.db.raw.sql`
      WITH candidates AS (
        SELECT DISTINCT
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.nombre), o.id) > (COALESCE(d.iata, d.icao, d.nombre), d.id) THEN d.id ELSE o.id END AS "origenId",
          CASE WHEN ${symmetric} AND (COALESCE(o.iata, o.icao, o.nombre), o.id) > (COALESCE(d.iata, d.icao, d.nombre), d.id) THEN o.id ELSE d.id END AS "destinoId",
          o.cantidad_rutas + d.cantidad_rutas AS score
        FROM ofertas_ruta r JOIN rutas conexion ON conexion.id=r.ruta_id
        JOIN aeropuertos o ON o.id = conexion.origen_id
        JOIN aeropuertos d ON d.id = conexion.destino_id
        LEFT JOIN paises oc ON oc.id = o.pais_id
        LEFT JOIN paises dc ON dc.id = d.pais_id
        WHERE r.archivado_en IS NULL AND conexion.archivado_en IS NULL AND o.archivado_en IS NULL AND d.archivado_en IS NULL AND (r.aerolinea_id IS NULL OR EXISTS (SELECT 1 FROM aerolineas a WHERE a.id=r.aerolinea_id AND a.archivado_en IS NULL)) AND r.escalas = 0 AND (
          ${dto.mode === 'global'} OR (
            UPPER(TRIM(oc.codigo_iso)) IN (SELECT jsonb_array_elements_text(${originCodes}::jsonb))
            AND UPPER(TRIM(dc.codigo_iso)) IN (SELECT jsonb_array_elements_text(${destinationCodes}::jsonb))
            AND (
              (${dto.mode === 'domestic'} AND oc.id = ${dto.paisOrigenId ?? ''}::text AND dc.id = oc.id)
              OR (${dto.mode === 'paises'} AND oc.id = ${dto.paisOrigenId ?? ''}::text AND dc.id = ${dto.paisDestinoId ?? ''}::text)
              OR ${dto.mode === 'continents'}
            )
          )
        )
      ), pairs AS (
        SELECT * FROM candidates ORDER BY score DESC, "origenId", "destinoId" LIMIT ${dto.limit ?? 50}
      )
      SELECT r.id, p."origenId", p."destinoId"
      FROM pairs p JOIN ofertas_ruta r ON r.escalas = 0 JOIN rutas conexion ON conexion.id=r.ruta_id AND (
        (conexion.origen_id = p."origenId" AND conexion.destino_id = p."destinoId") OR
        (conexion.destino_id = p."origenId" AND conexion.origen_id = p."destinoId")
      )
      ORDER BY p.score DESC, p."origenId", p."destinoId", r.id
    `
        .returnsRow({
          id: 'pg/text@1',
          origenId: 'pg/text@1',
          destinoId: 'pg/text@1',
        })
        .build(),
    );
    if (!selected.length) return [];
    const rows = await includeRouteDetails(this.prisma)
      .where((route) => or(...selected.map(({ id }) => route.id.eq(id))))
      .all();
    const arcs = new Map(
      (await this.withDistances(rows)).map((row) => [
        row.id,
        this.mapToDeckGlArc(row),
      ]),
    );
    const connections = new Map<string, GlobalConnection>();
    for (const row of selected) {
      const arc = arcs.get(row.id);
      if (!arc) continue;
      const id = `${row.origenId}/${row.destinoId}`;
      let conexion = connections.get(id);
      if (!conexion) {
        conexion = {
          id,
          origenId: row.origenId,
          destinoId: row.destinoId,
          ida: [],
          vuelta: [],
        };
        connections.set(id, conexion);
      }
      (arc.origen.id === row.origenId ? conexion.ida : conexion.vuelta).push(
        arc,
      );
    }
    return [...connections.values()];
  }

  async explore(dto: ExploreRoutesDto): Promise<DeckGlArcRoute[]> {
    const { origen, aerolinea, limit = 100 } = dto;
    if (
      dto.origenId &&
      dto.origenId.toLowerCase() === dto.destinoId?.toLowerCase()
    )
      throw new BadRequestException(
        'El origen y el destino deben ser aeropuertos distintos',
      );

    if (dto.incluirRegreso && (!dto.origenId || !dto.destinoId)) {
      throw new BadRequestException('incluirRegreso requiere origen y destino');
    }
    const query = includeRouteDetails(this.prisma)
      .where((route) => {
        const conditions: Condition[] = [];
        if (origen) {
          const iata = origen.trim().toUpperCase();
          conditions.push(
            route.ruta.some((r) =>
              or(r.origen.some({ iata }), r.destino.some({ iata })),
            ),
          );
        }
        if (dto.incluirRegreso && dto.origenId && dto.destinoId) {
          conditions.push(
            or(
              and(
                route.ruta.some({ origenId: dto.origenId }),
                route.ruta.some({ destinoId: dto.destinoId }),
              ),
              and(
                route.ruta.some({ origenId: dto.destinoId }),
                route.ruta.some({ destinoId: dto.origenId }),
              ),
            ),
          );
        } else if (dto.origenId)
          conditions.push(
            dto.destinoId
              ? route.ruta.some({ origenId: dto.origenId })
              : or(
                  route.ruta.some({ origenId: dto.origenId }),
                  route.ruta.some({ destinoId: dto.origenId }),
                ),
          );
        if (dto.destinoId && !dto.incluirRegreso)
          conditions.push(route.ruta.some({ destinoId: dto.destinoId }));
        if (dto.origenId && dto.destinoId) conditions.push(route.escalas.eq(0));
        if (aerolinea)
          conditions.push(
            route.codigoAerolinea.eq(aerolinea.trim().toUpperCase()),
          );
        return and(...conditions);
      })
      .orderBy([
        (route, { fns }) =>
          fns.raw`(SELECT cantidad_rutas FROM aeropuertos WHERE id = (SELECT origen_id FROM rutas WHERE id = ${route.rutaId}))`
            .returns('pg/int4@1')
            .desc(),
        (route) => route.id.asc(),
      ]);
    const rows = await (dto.incluirRegreso ? query : query.limit(limit)).all();
    const rutas = await this.withDistances(rows);

    return rutas.map((r) => this.mapToDeckGlArc(r));
  }

  async findDirect(dto: QueryDirectRouteDto) {
    const codigoOrigen = dto.origen.trim().toUpperCase();
    const codigoDestino = dto.destino.trim().toUpperCase();
    if (codigoOrigen === codigoDestino)
      throw new BadRequestException(
        'El origen y el destino deben ser aeropuertos distintos',
      );
    const endpoints: string[] = [];
    for (const code of [codigoOrigen, codigoDestino]) {
      const aeropuertos = await this.prisma.models.Aeropuerto.where((a) =>
        or(a.iata.eq(code), a.icao.eq(code)),
      )
        .where({ archivadoEn: null })
        .select('id')
        .limit(2)
        .all();
      if (aeropuertos.length > 1)
        throw new ConflictException('Código de aeropuerto ambiguo');
      if (!aeropuertos.length)
        throw new NotFoundException(
          `Aeropuerto con código ${code} no encontrado`,
        );
      endpoints.push(aeropuertos[0].id);
    }
    const [origenId, destinoId] = endpoints;
    if (origenId === destinoId)
      throw new BadRequestException(
        'El origen y el destino deben ser aeropuertos distintos',
      );

    const rows = await includeRouteDetails(this.prisma)
      .where((route) =>
        and(
          route.ruta.some({ origenId }),
          route.ruta.some({ destinoId }),
          route.escalas.eq(0),
        ),
      )
      .all();
    const rutas = await this.withDistances(rows);

    if (!rutas.length) {
      throw new NotFoundException(
        `No se encontraron vuelos directos entre ${codigoOrigen} y ${codigoDestino}`,
      );
    }

    const first = rutas[0];
    const distanciaKm = first.distanciaKm;

    return {
      origen: {
        iata: first.origen.iata,
        nombre: first.origen.nombre,
        ciudad: first.origen.ciudad,
        pais: first.origen.nombrePais,
        coordenadas: [first.origen.longitud, first.origen.latitud],
      },
      destino: {
        iata: first.destino.iata,
        nombre: first.destino.nombre,
        ciudad: first.destino.ciudad,
        pais: first.destino.nombrePais,
        coordenadas: [first.destino.longitud, first.destino.latitud],
      },
      distanciaKm: Math.round(distanciaKm * 10) / 10,
      distanciaNm: Math.round((distanciaKm / 1.852) * 10) / 10,
      cantidadOperadores: rutas.length,
      operadores: rutas.map((r) => ({
        nombreAerolinea:
          r.aerolinea?.nombre ?? r.codigoAerolinea ?? 'Desconocida',
        iataAerolinea: r.aerolinea?.iata ?? r.codigoAerolinea,
        escalas: r.escalas,
      })),
    };
  }

  private async withDistances(ofertas: RouteWithRelations[]) {
    const rows = ofertas.map((oferta) => {
      if (!oferta.ruta)
        throw new NotFoundException('La ruta ya no está disponible');
      return {
        ...oferta,
        origenId: oferta.ruta.origenId,
        destinoId: oferta.ruta.destinoId,
        origen: oferta.ruta.origen,
        destino: oferta.ruta.destino,
      };
    });
    const missing = rows;
    const distances = missing.length
      ? await this.prisma.db.query(
          this.prisma.db.raw.sql`
          SELECT r.id, ST_DistanceSphere(o.ubicacion::geometry, d.ubicacion::geometry) / 1000 AS "distanciaKm"
          FROM ofertas_ruta r JOIN rutas conexion ON conexion.id=r.ruta_id
          JOIN aeropuertos o ON o.id = conexion.origen_id
          JOIN aeropuertos d ON d.id = conexion.destino_id
          WHERE r.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(missing.map((route) => route.id))}::jsonb))
        `
            .returnsRow({ id: 'pg/text@1', distanciaKm: 'pg/float8@1' })
            .build(),
        )
      : [];
    const byId = new Map(
      distances.map((route) => [route.id, route.distanciaKm]),
    );
    return rows.map((route) => {
      const distanciaKm = byId.get(route.id);
      if (distanciaKm === undefined)
        throw new NotFoundException('La ruta ya no está disponible');
      return { ...route, distanciaKm };
    });
  }

  private mapToDeckGlArc(
    route: Awaited<ReturnType<RoutesService['withDistances']>>[number],
  ): DeckGlArcRoute {
    const distanciaKm = route.distanciaKm;

    return {
      id: route.id,
      rutaId: route.rutaId,
      origen: {
        id: route.origen.id,
        icao: route.origen.icao,
        iata: route.origen.iata,
        nombre: route.origen.nombre,
        ciudad: route.origen.ciudad,
        pais: route.origen.nombrePais,
        coordenadas: [route.origen.longitud, route.origen.latitud],
      },
      destino: {
        id: route.destino.id,
        icao: route.destino.icao,
        iata: route.destino.iata,
        nombre: route.destino.nombre,
        ciudad: route.destino.ciudad,
        pais: route.destino.nombrePais,
        coordenadas: [route.destino.longitud, route.destino.latitud],
      },
      aerolinea: {
        iata: route.aerolinea?.iata ?? route.codigoAerolinea,
        nombre:
          route.aerolinea?.nombre ?? route.codigoAerolinea ?? 'Desconocida',
      },
      distanciaKm: Math.round(distanciaKm * 10) / 10,
      distanciaNm: Math.round((distanciaKm / 1.852) * 10) / 10,
      otp15: null,
      escalas: route.escalas,
    };
  }

  async listarAdmin(consulta: ConsultaCatalogoDto) {
    let query = this.prisma.models.Ruta.include('origen')
      .include('destino')
      .include('ofertas', (ofertas) => ofertas.include('aerolinea'));
    if (consulta.estado === 'vigentes')
      query = query.where({ archivadoEn: null });
    if (consulta.estado === 'archivados')
      query = query.where((r) => r.archivadoEn.isNotNull());
    if (consulta.busqueda) {
      const patron = `%${consulta.busqueda.replace(/[\\%_]/g, '\\$&')}%`;
      query = query.where((r) =>
        or(
          r.id.ilike(patron),
          r.origen.some((a) =>
            or(a.nombre.ilike(patron), a.iata.ilike(patron)),
          ),
          r.destino.some((a) =>
            or(a.nombre.ilike(patron), a.iata.ilike(patron)),
          ),
        ),
      );
    }
    const [datos, resumen] = await Promise.all([
      query
        .orderBy((r) => r.id.asc())
        .offset((consulta.pagina - 1) * consulta.limite)
        .limit(consulta.limite)
        .all(),
      query.aggregate((r) => ({ total: r.count() })),
    ]);
    return {
      datos,
      total: Number(resumen.total),
      pagina: consulta.pagina,
      limite: consulta.limite,
    };
  }

  async detalleAdmin(id: string) {
    const registro = await this.prisma.models.Ruta.include('origen')
      .include('destino')
      .include('ofertas', (ofertas) => ofertas.include('aerolinea'))
      .first({ id });
    if (!registro) throw new NotFoundException('La ruta no existe');
    return registro;
  }

  private async validarReferencias(
    tx: Transaction,
    origenId: string,
    destinoId: string,
    aerolineaId?: string | null,
  ) {
    if (origenId === destinoId)
      throw new BadRequestException(
        'El origen y el destino deben ser distintos',
      );
    const aeropuertos = await tx.orm.public.Aeropuerto.where((a) =>
      or(a.id.eq(origenId), a.id.eq(destinoId)),
    )
      .where({ archivadoEn: null })
      .all();
    if (aeropuertos.length !== 2)
      throw new NotFoundException(
        'Los aeropuertos deben existir y estar sin archivar',
      );
    if (
      aerolineaId &&
      !(await tx.orm.public.Aerolinea.first({
        id: aerolineaId,
        archivadoEn: null,
      }))
    )
      throw new NotFoundException(
        'La aerolínea debe existir y estar sin archivar',
      );
  }

  crearAdmin(datos: CrearRutaDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        await this.validarReferencias(tx, datos.origenId, datos.destinoId);
        const registro = await tx.orm.public.Ruta.create({
          ...datos,
          protegidoManualmente: true,
        });
        await recalcularCantidadRutas(tx);
        return registro;
      })
      .catch(errorCatalogo);
  }

  editarAdmin(id: string, datos: EditarRutaDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        const actual = await tx.orm.public.Ruta.first({ id });
        if (!actual) throw new NotFoundException('La ruta no existe');
        if (actual.archivadoEn)
          throw new ConflictException('La ruta está archivada');
        const cambiaExtremos =
          (datos.origenId !== undefined &&
            datos.origenId !== actual.origenId) ||
          (datos.destinoId !== undefined &&
            datos.destinoId !== actual.destinoId);
        if (
          cambiaExtremos &&
          (await tx.orm.public.OfertaRuta.first({ rutaId: id }))
        ) {
          throw new ConflictException(
            'Los aeropuertos de una ruta con ofertas no pueden modificarse',
          );
        }
        const { protegidoManualmente, ...cambios } = datos;
        const referencia = { ...actual, ...cambios };
        if (Object.keys(cambios).length)
          await this.validarReferencias(
            tx,
            referencia.origenId,
            referencia.destinoId,
          );
        const registro = await tx.orm.public.Ruta.where({ id }).update({
          ...cambios,
          protegidoManualmente: Object.keys(cambios).length
            ? true
            : (protegidoManualmente ?? actual.protegidoManualmente),
        });
        await recalcularCantidadRutas(tx);
        return registro;
      })
      .catch(errorCatalogo);
  }

  async archivarAdmin(id: string) {
    await this.prisma.db.transaction(async (tx) => {
      await bloquearCatalogo(tx);
      const actual = await tx.orm.public.Ruta.first({ id });
      if (!actual) throw new NotFoundException('La ruta no existe');
      if (actual.archivadoEn) return;
      await tx.orm.public.Ruta.where({ id }).update({
        archivadoEn: new Date()
          .toISOString()
          .replace('T', ' ')
          .replace('Z', ''),
      });
      await recalcularCantidadRutas(tx);
    });
  }

  private async rutaVigente(tx: Transaction, rutaId: string) {
    const ruta = await tx.orm.public.Ruta.first({ id: rutaId });
    if (!ruta) throw new NotFoundException('La ruta no existe');
    if (ruta.archivadoEn) throw new ConflictException('La ruta está archivada');
    await this.validarReferencias(tx, ruta.origenId, ruta.destinoId);
    return ruta;
  }

  crearOferta(rutaId: string, datos: CrearOfertaRutaDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        await this.rutaVigente(tx, rutaId);
        if (
          datos.aerolineaId &&
          !(await tx.orm.public.Aerolinea.first({
            id: datos.aerolineaId,
            archivadoEn: null,
          }))
        )
          throw new NotFoundException(
            'La aerolínea debe existir y estar sin archivar',
          );
        const oferta = await tx.orm.public.OfertaRuta.create({
          ...datos,
          rutaId,
          fuente: 'Administrativa',
          protegidoManualmente: true,
        });
        await recalcularCantidadRutas(tx);
        return oferta;
      })
      .catch(errorCatalogo);
  }

  editarOferta(rutaId: string, id: string, datos: EditarOfertaRutaDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        await this.rutaVigente(tx, rutaId);
        const actual = await tx.orm.public.OfertaRuta.first({ id, rutaId });
        if (!actual)
          throw new NotFoundException('La oferta no existe en esta ruta');
        if (actual.archivadoEn)
          throw new ConflictException('La oferta está archivada');
        if (
          datos.aerolineaId &&
          !(await tx.orm.public.Aerolinea.first({
            id: datos.aerolineaId,
            archivadoEn: null,
          }))
        )
          throw new NotFoundException(
            'La aerolínea debe existir y estar sin archivar',
          );
        const { protegidoManualmente, ...cambios } = datos;
        const oferta = await tx.orm.public.OfertaRuta.where({
          id,
          rutaId,
        }).update({
          ...cambios,
          protegidoManualmente: Object.keys(cambios).length
            ? true
            : (protegidoManualmente ?? actual.protegidoManualmente),
        });
        await recalcularCantidadRutas(tx);
        return oferta;
      })
      .catch(errorCatalogo);
  }

  async archivarOferta(rutaId: string, id: string) {
    await this.prisma.db.transaction(async (tx) => {
      await bloquearCatalogo(tx);
      const actual = await tx.orm.public.OfertaRuta.first({ id, rutaId });
      if (!actual)
        throw new NotFoundException('La oferta no existe en esta ruta');
      if (!actual.archivadoEn)
        await tx.orm.public.OfertaRuta.where({ id, rutaId }).update({
          archivadoEn: new Date()
            .toISOString()
            .replace('T', ' ')
            .replace('Z', ''),
        });
      await recalcularCantidadRutas(tx);
    });
  }
}
