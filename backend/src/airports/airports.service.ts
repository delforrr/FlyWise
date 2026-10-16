import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchAirportsDto } from './dto/search-airports.dto';
import { NearbyAirportsDto } from './dto/nearby-airports.dto';

export interface NearbyAirportResult {
  id: string;
  name: string;
  city: string | null;
  countryName: string;
  iata: string | null;
  icao: string | null;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  routeCount: number;
  distanceKm: number;
}

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(searchDto: SearchAirportsDto) {
    const term = searchDto.q.trim();
    const upperTerm = term.toUpperCase();

    return this.prisma.airport.findMany({
      where: {
        OR: [
          { iata: upperTerm },
          { icao: upperTerm },
          { name: { contains: term, mode: 'insensitive' } },
          { city: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ routeCount: 'desc' }, { name: 'asc' }],
      take: searchDto.limit ?? 20,
    });
  }

  async findNearby(
    nearbyDto: NearbyAirportsDto,
  ): Promise<NearbyAirportResult[]> {
    const radiusMeters = nearbyDto.radiusKm * 1000;

    return this.prisma.$queryRaw<NearbyAirportResult[]>`
      SELECT 
        id, 
        name, 
        city, 
        country_name as "countryName", 
        iata, 
        icao, 
        latitude, 
        longitude,
        altitude_ft as "altitudeFt", 
        route_count as "routeCount",
        ROUND((ST_DistanceSphere(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
          ST_SetSRID(ST_MakePoint(${nearbyDto.lng}, ${nearbyDto.lat}), 4326)
        ) / 1000)::numeric, 1)::float as "distanceKm"
      FROM airports
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${nearbyDto.lng}, ${nearbyDto.lat}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY "distanceKm" ASC
      LIMIT 50;
    `;
  }

  async findByCode(code: string) {
    const upperCode = code.trim().toUpperCase();

    const airport = await this.prisma.airport.findFirst({
      where: {
        OR: [{ iata: upperCode }, { icao: upperCode }],
      },
      include: {
        originRoutes: {
          take: 10,
          include: {
            destination: true,
            airline: true,
          },
        },
      },
    });

    if (!airport) {
      throw new NotFoundException(
        `Aeropuerto con código ${upperCode} no encontrado`,
      );
    }

    return airport;
  }
}
