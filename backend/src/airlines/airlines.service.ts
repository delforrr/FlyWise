import { or } from '@prisma/orm-postgres/orm-client';
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
    const airlines = term
      ? this.prisma.models.Airline.where((airline) =>
          or(
            airline.iata.eq(term.toUpperCase()),
            airline.icao.eq(term.toUpperCase()),
            airline.name.ilike(`%${term.replace(/[\\%_]/g, '\\$&')}%`),
          ),
        )
      : this.prisma.models.Airline;
    const [data, { totalItems }] = await Promise.all([
      airlines
        .orderBy([
          (airline, { fns }) =>
            fns.raw`COALESCE(${airline.active}::int, -1)`
              .returns('pg/int4@1')
              .desc(),
          (airline) => airline.name.asc(),
          (airline) => airline.id.asc(),
        ])
        .offset((page - 1) * limit)
        .limit(limit)
        .all(),
      airlines.aggregate((aggregate) => ({ totalItems: aggregate.count() })),
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
    const airlines = await this.prisma.models.Airline.where((airline) =>
      or(airline.iata.eq(upperCode), airline.icao.eq(upperCode)),
    )
      .include('routes', (routes) =>
        routes.limit(20).include('origin').include('destination'),
      )
      .limit(2)
      .all();
    if (airlines.length > 1)
      throw new ConflictException(
        'Código ambiguo; seleccione la entidad por su identidad interna',
      );
    const [airline] = airlines;
    if (!airline)
      throw new NotFoundException(
        `Aerolínea con código ${upperCode} no encontrada`,
      );
    return airline;
  }
}
