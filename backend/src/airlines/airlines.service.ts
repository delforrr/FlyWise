import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAirlinesDto } from './dto/query-airlines.dto';

@Injectable()
export class AirlinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(queryDto: QueryAirlinesDto) {
    const { q, page = 1, limit = 20 } = queryDto;
    const skip = (page - 1) * limit;

    const where = q
      ? {
          OR: [
            { iata: { equals: q.trim().toUpperCase() } },
            { icao: { equals: q.trim().toUpperCase() } },
            { name: { contains: q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.airline.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.airline.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCode(code: string) {
    const upperCode = code.trim().toUpperCase();

    const airline = await this.prisma.airline.findFirst({
      where: {
        OR: [{ iata: upperCode }, { icao: upperCode }],
      },
      include: {
        routes: {
          take: 20,
          include: {
            origin: true,
            destination: true,
          },
        },
      },
    });

    if (!airline) {
      throw new NotFoundException(
        `Aerolínea con código ${upperCode} no encontrada`,
      );
    }

    return airline;
  }
}
