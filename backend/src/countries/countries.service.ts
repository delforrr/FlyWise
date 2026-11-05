import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { countryContinent } from './continents.js';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const paises = await this.prisma.models.Pais.orderBy((pais) =>
      pais.nombre.asc(),
    ).all();
    return paises.map((pais) => ({
      ...pais,
      continent: countryContinent(pais.codigoIso),
    }));
  }

  async findByName(nombre: string) {
    const pais = await this.prisma.models.Pais.where((pais) =>
      pais.nombre.ilike(nombre.replace(/[\\%_]/g, '\\$&')),
    ).first();
    if (!pais) throw new NotFoundException(`País "${nombre}" no encontrado`);
    const aeropuertos = await this.prisma.models.Aeropuerto.where((airport) =>
      airport.paisId.eq(pais.id),
    )
      .where({ archivadoEn: null })
      .orderBy((airport) => airport.cantidadRutas.desc())
      .limit(50)
      .all();
    return { ...pais, aeropuertos };
  }
}
