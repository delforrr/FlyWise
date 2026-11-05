import { ConsultaCatalogoDto } from '../common/dto/consulta-catalogo.dto.js';
import {
  bloquearCatalogo,
  recalcularCantidadRutas,
} from '../prisma/catalog-state.js';
import { errorCatalogo } from '../prisma/catalog-error.js';
import {
  CrearAeropuertoDto,
  EditarAeropuertoDto,
} from './dto/administrar-aeropuerto.dto.js';
import { and, or } from '@prisma/orm-postgres/orm-client';
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogAirportsDto } from './dto/catalog-airports.dto.js';
import { SearchAirportsDto } from './dto/search-airports.dto.js';
import { NearbyAirportsDto } from './dto/nearby-airports.dto.js';

export interface NearbyAirportResult {
  id: string;
  nombre: string;
  ciudad: string | null;
  nombrePais: string;
  iata: string | null;
  icao: string | null;
  latitud: number;
  longitud: number;
  cantidadRutas: number;
  distanciaKm: number;
}

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  catalog(dto: CatalogAirportsDto) {
    return this.prisma.models.Aeropuerto.where({ archivadoEn: null })
      .orderBy([(a) => a.cantidadRutas.desc(), (a) => a.id.asc()])
      .offset(dto.offset)
      .limit(dto.limit)
      .all();
  }

  async search(searchDto: SearchAirportsDto) {
    const term = searchDto.q.trim();
    const upperTerm = term.toUpperCase();

    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    return this.prisma.models.Aeropuerto.where((airport) =>
      or(
        airport.iata.eq(upperTerm),
        airport.icao.eq(upperTerm),
        airport.nombre.ilike(pattern),
        airport.ciudad.ilike(pattern),
      ),
    )
      .where({ archivadoEn: null })
      .orderBy([
        (airport) => airport.cantidadRutas.desc(),
        (airport) => airport.nombre.asc(),
      ])
      .limit(searchDto.limit ?? 20)
      .all();
  }

  async findNearby(
    nearbyDto: NearbyAirportsDto,
  ): Promise<NearbyAirportResult[]> {
    const radiusMeters = nearbyDto.radiusKm * 1000;

    return this.prisma.db.query(
      this.prisma.db.raw.sql`
      SELECT
        id,
        nombre,
        ciudad,
        nombre_pais as "nombrePais",
        iata,
        icao,
        latitud,
        longitud,
        cantidad_rutas as "cantidadRutas",
        ROUND((ST_DistanceSphere(
          ubicacion::geometry,
          ST_SetSRID(ST_MakePoint(${nearbyDto.lng}, ${nearbyDto.lat}), 4326)
        ) / 1000)::numeric, 1)::float as "distanciaKm"
      FROM aeropuertos
      WHERE archivado_en IS NULL AND ST_DWithin(
        ubicacion,
        ST_SetSRID(ST_MakePoint(${nearbyDto.lng}, ${nearbyDto.lat}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY "distanciaKm" ASC
      LIMIT 50;
    `
        .returnsRow({
          id: 'pg/text@1',
          nombre: 'pg/text@1',
          ciudad: { codecId: 'pg/text@1', nullable: true },
          nombrePais: 'pg/text@1',
          iata: { codecId: 'pg/text@1', nullable: true },
          icao: { codecId: 'pg/text@1', nullable: true },
          latitud: 'pg/float8@1',
          longitud: 'pg/float8@1',
          cantidadRutas: 'pg/int4@1',
          distanciaKm: 'pg/float8@1',
        })
        .build(),
    );
  }

  async findByCode(code: string) {
    const upperCode = code.trim().toUpperCase();

    const aeropuertos = await this.prisma.models.Aeropuerto.where((airport) =>
      or(airport.iata.eq(upperCode), airport.icao.eq(upperCode)),
    )
      .where({ archivadoEn: null })
      .include('rutasOrigen', (rutas) =>
        rutas
          .where((r) =>
            and(
              r.archivadoEn.isNull(),
              r.destino.some({ archivadoEn: null }),
              r.ofertas.some((f) =>
                and(
                  f.archivadoEn.isNull(),
                  or(
                    f.aerolineaId.isNull(),
                    f.aerolinea.some({ archivadoEn: null }),
                  ),
                ),
              ),
            ),
          )
          .limit(10)
          .include('destino')
          .include('ofertas', (ofertas) =>
            ofertas
              .where((f) =>
                and(
                  f.archivadoEn.isNull(),
                  or(
                    f.aerolineaId.isNull(),
                    f.aerolinea.some({ archivadoEn: null }),
                  ),
                ),
              )
              .include('aerolinea'),
          ),
      )
      .limit(2)
      .all();
    if (aeropuertos.length > 1)
      throw new ConflictException(
        'Código ambiguo; seleccione la entidad por su identidad interna',
      );
    const [airport] = aeropuertos;

    if (!airport) {
      throw new NotFoundException(
        `Aeropuerto con código ${upperCode} no encontrado`,
      );
    }

    return airport;
  }

  async listarAdmin(consulta: ConsultaCatalogoDto) {
    let query = this.prisma.models.Aeropuerto;
    if (consulta.estado === 'vigentes')
      query = query.where({ archivadoEn: null });
    if (consulta.estado === 'archivados')
      query = query.where((a) => a.archivadoEn.isNotNull());
    if (consulta.busqueda) {
      const patron = `%${consulta.busqueda.replace(/[\\%_]/g, '\\$&')}%`;
      query = query.where((a) =>
        or(
          a.nombre.ilike(patron),
          a.iata.ilike(patron),
          a.icao.ilike(patron),
          a.ciudad.ilike(patron),
        ),
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
    const registro = await this.prisma.models.Aeropuerto.first({ id });
    if (!registro) throw new NotFoundException('El aeropuerto no existe');
    return registro;
  }

  crearAdmin(datos: CrearAeropuertoDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        const pais = await tx.orm.public.Pais.first({ id: datos.paisId });
        if (!pais) throw new NotFoundException('El país no existe');
        return tx.orm.public.Aeropuerto.create({
          ...datos,
          nombrePais: pais.nombre,
          fuente: 'Administrativa',
          protegidoManualmente: true,
          vinculoPaisInferido: false,
        });
      })
      .catch(errorCatalogo);
  }

  editarAdmin(id: string, datos: EditarAeropuertoDto) {
    return this.prisma.db
      .transaction(async (tx) => {
        await bloquearCatalogo(tx);
        const actual = await tx.orm.public.Aeropuerto.first({ id });
        if (!actual) throw new NotFoundException('El aeropuerto no existe');
        if (actual.archivadoEn)
          throw new ConflictException('El aeropuerto está archivado');
        const { protegidoManualmente, ...cambios } = datos;
        const pais = datos.paisId
          ? await tx.orm.public.Pais.first({ id: datos.paisId })
          : undefined;
        if (datos.paisId && !pais)
          throw new NotFoundException('El país no existe');
        return tx.orm.public.Aeropuerto.where({ id }).update({
          ...cambios,
          ...(pais
            ? { nombrePais: pais.nombre, vinculoPaisInferido: false }
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
      const actual = await tx.orm.public.Aeropuerto.first({ id });
      if (!actual) throw new NotFoundException('El aeropuerto no existe');
      if (actual.archivadoEn) return;
      await tx.orm.public.Aeropuerto.where({ id }).update({
        archivadoEn: new Date()
          .toISOString()
          .replace('T', ' ')
          .replace('Z', ''),
      });
      await recalcularCantidadRutas(tx);
    });
  }
}
