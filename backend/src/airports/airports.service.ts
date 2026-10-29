import { or } from '@prisma/orm-postgres/orm-client';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogAirportsDto } from './dto/catalog-airports.dto.js';
import { SearchAirportsDto } from './dto/search-airports.dto.js';
import { NearbyAirportsDto } from './dto/nearby-airports.dto.js';

export interface NearbyAirportResult {
  id: string;
  name: string;
  city: string | null;
  countryName: string;
  iata: string | null;
  icao: string | null;
  latitude: number;
  longitude: number;
  routeCount: number;
  distanceKm: number;
}

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  catalog(dto: CatalogAirportsDto) {
    return this.prisma.models.Airport.orderBy([
      (a) => a.routeCount.desc(),
      (a) => a.id.asc(),
    ])
      .offset(dto.offset)
      .limit(dto.limit)
      .all();
  }

  async search(searchDto: SearchAirportsDto) {
    const term = searchDto.q.trim();
    const upperTerm = term.toUpperCase();

    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    return this.prisma.models.Airport.where((airport) =>
      or(
        airport.iata.eq(upperTerm),
        airport.icao.eq(upperTerm),
        airport.name.ilike(pattern),
        airport.city.ilike(pattern),
      ),
    )
      .orderBy([
        (airport) => airport.routeCount.desc(),
        (airport) => airport.name.asc(),
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
        name, 
        city, 
        country_name as "countryName", 
        iata, 
        icao, 
        latitude, 
        longitude,
        route_count as "routeCount",
        ROUND((ST_DistanceSphere(
          location::geometry,
          ST_SetSRID(ST_MakePoint(${nearbyDto.lng}, ${nearbyDto.lat}), 4326)
        ) / 1000)::numeric, 1)::float as "distanceKm"
      FROM airports
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${nearbyDto.lng}, ${nearbyDto.lat}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY "distanceKm" ASC
      LIMIT 50;
    `
        .returnsRow({
          id: 'pg/text@1',
          name: 'pg/text@1',
          city: { codecId: 'pg/text@1', nullable: true },
          countryName: 'pg/text@1',
          iata: { codecId: 'pg/text@1', nullable: true },
          icao: { codecId: 'pg/text@1', nullable: true },
          latitude: 'pg/float8@1',
          longitude: 'pg/float8@1',
          routeCount: 'pg/int4@1',
          distanceKm: 'pg/float8@1',
        })
        .build(),
    );
  }

  async findByCode(code: string) {
    const upperCode = code.trim().toUpperCase();

    const airports = await this.prisma.models.Airport.where((airport) =>
      or(airport.iata.eq(upperCode), airport.icao.eq(upperCode)),
    )
      .include('originRoutes', (routes) =>
        routes.limit(10).include('destination').include('airline'),
      )
      .limit(2).all();
    if (airports.length > 1) throw new ConflictException("Código ambiguo; seleccione la entidad por su identidad interna");
    const [airport] = airports;

    if (!airport) {
      throw new NotFoundException(
        `Aeropuerto con código ${upperCode} no encontrado`,
      );
    }

    return airport;
  }
}

