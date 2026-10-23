import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findByName(name: string) {
    const country = await this.prisma.country.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (!country) {
      throw new NotFoundException(`País "${name}" no encontrado`);
    }

    const airports = await this.prisma.airport.findMany({
      where: {
        countryName: { equals: country.name, mode: 'insensitive' },
      },
      take: 50,
      orderBy: { routeCount: 'desc' },
    });

    return {
      ...country,
      airports,
    };
  }
}
