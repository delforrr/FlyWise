import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { countryContinent } from './continents.js';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const countries = await this.prisma.models.Country.orderBy((country) =>
      country.name.asc(),
    ).all();
    return countries.map((country) => ({ ...country, continent: countryContinent(country.isoCode) }));
  }

  async findByName(name: string) {
    const country = await this.prisma.models.Country.where((country) =>
      country.name.ilike(name.replace(/[\\%_]/g, '\\$&')),
    ).first();
    if (!country) throw new NotFoundException(`País "${name}" no encontrado`);
    const airports = await this.prisma.models.Airport.where((airport) =>
      airport.countryName.ilike(country.name.replace(/[\\%_]/g, '\\$&')),
    )
      .orderBy((airport) => airport.routeCount.desc())
      .limit(50)
      .all();
    return { ...country, airports };
  }
}
