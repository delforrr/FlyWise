import {
  includeRouteDetails,
  seleccionarConexiones,
  type RouteWithRelations,
} from './route-queries.js';
import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import {
  escribirCatalogo,
  proteccionManual,
  recalcularCantidadRutas,
} from '../catalogos/catalog-state.js';
import { escaparLike } from '../prisma/escape-like.js';
import type { Transaction } from '../prisma/db.js';
import {
  CrearRutaDto,
  EditarRutaDto,
  CrearOfertaRutaDto,
  EditarOfertaRutaDto,
} from './dto/administrar-ruta.dto.js';
import { and, or, type Condition } from '@prisma/orm-postgres/orm-client';
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
    const selected = await seleccionarConexiones(this.prisma, dto);
    if (!selected.length) return [];
    const rows = await includeRouteDetails(this.prisma)
      .where((route) => route.id.in(selected.map(({ id }) => id)))
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
    const { origenId, destinoId } = dto;
    const routes =
      origenId && destinoId
        ? await this.prisma.models.Ruta.where((route) => {
            const ida = and(
              route.origenId.eq(origenId),
              route.destinoId.eq(destinoId),
            );
            return dto.incluirRegreso
              ? or(
                  ida,
                  and(
                    route.origenId.eq(destinoId),
                    route.destinoId.eq(origenId),
                  ),
                )
              : ida;
          })
            .select('id')
            .all()
        : undefined;
    if (routes?.length === 0) return [];
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
        if (routes && origenId && destinoId) {
          const ida = route.ruta.some({ origenId, destinoId });
          conditions.push(
            route.rutaId.in(routes.map(({ id }) => id)),
            route.escalas.eq(0),
            dto.incluirRegreso
              ? or(
                  ida,
                  route.ruta.some({ origenId: destinoId, destinoId: origenId }),
                )
              : ida,
          );
        } else if (origenId) {
          conditions.push(
            or(
              route.ruta.some({ origenId }),
              route.ruta.some({ destinoId: origenId }),
            ),
          );
        } else if (destinoId) {
          conditions.push(route.ruta.some({ destinoId }));
        }
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
    const patron = consulta.busqueda
      ? `%${escaparLike(consulta.busqueda)}%`
      : null;
    if (patron) {
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
      patron
        ? this.contarRutasPorBusqueda(patron, consulta.estado)
        : query.aggregate((r) => ({ total: r.count() })),
    ]);
    return {
      datos,
      total: Number(resumen.total),
      pagina: consulta.pagina,
      limite: consulta.limite,
    };
  }

  private async contarRutasPorBusqueda(
    patron: string,
    estado: ConsultaCatalogoDto['estado'],
  ) {
    const [resumen] = await this.prisma.db.query(
      this.prisma.db.raw.sql`
        WITH aeropuertos_coincidentes AS MATERIALIZED (
          SELECT id FROM aeropuertos
          WHERE nombre ILIKE ${patron} OR iata ILIKE ${patron}
        )
        SELECT COUNT(*) AS total
        FROM rutas
        WHERE (${estado === 'todos'} OR (archivado_en IS NULL) = ${estado === 'vigentes'})
          AND (
            id ILIKE ${patron}
            OR origen_id IN (SELECT id FROM aeropuertos_coincidentes)
            OR destino_id IN (SELECT id FROM aeropuertos_coincidentes)
          )
      `
        .returnsRow({ total: 'pg/int8@1' })
        .build(),
    );
    return resumen;
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
    return escribirCatalogo(this.prisma.db, async (tx) => {
      await this.validarReferencias(tx, datos.origenId, datos.destinoId);
      const registro = await tx.orm.public.Ruta.create({
        ...datos,
        protegidoManualmente: true,
      });
      await recalcularCantidadRutas(tx);
      return registro;
    });
  }

  editarAdmin(id: string, datos: EditarRutaDto) {
    return escribirCatalogo(this.prisma.db, async (tx) => {
      const actual = await tx.orm.public.Ruta.first({ id });
      if (!actual) throw new NotFoundException('La ruta no existe');
      if (actual.archivadoEn)
        throw new ConflictException('La ruta está archivada');
      const cambiaExtremos =
        (datos.origenId !== undefined && datos.origenId !== actual.origenId) ||
        (datos.destinoId !== undefined && datos.destinoId !== actual.destinoId);
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
        protegidoManualmente: proteccionManual(
          cambios,
          protegidoManualmente,
          actual.protegidoManualmente,
        ),
      });
      await recalcularCantidadRutas(tx);
      return registro;
    });
  }

  async archivarAdmin(id: string) {
    await escribirCatalogo(this.prisma.db, async (tx) => {
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
    return escribirCatalogo(this.prisma.db, async (tx) => {
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
    });
  }

  editarOferta(rutaId: string, id: string, datos: EditarOfertaRutaDto) {
    return escribirCatalogo(this.prisma.db, async (tx) => {
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
        protegidoManualmente: proteccionManual(
          cambios,
          protegidoManualmente,
          actual.protegidoManualmente,
        ),
      });
      await recalcularCantidadRutas(tx);
      return oferta;
    });
  }

  async archivarOferta(rutaId: string, id: string) {
    await escribirCatalogo(this.prisma.db, async (tx) => {
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
