import { BadRequestException } from '@nestjs/common';

// PostGIS accepts EWKT through Prisma's Raw column codec; values remain parameters.
export function ubicacionAeropuerto(latitud: number, longitud: number) {
  if (
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    Math.abs(latitud) > 90 ||
    Math.abs(longitud) > 180
  )
    throw new BadRequestException('Coordenadas inválidas');
  return `SRID=4326;POINT(${longitud} ${latitud})`;
}
