import { BadRequestException, NotFoundException } from '@nestjs/common';
import { escribirCatalogo } from '../catalogos/catalog-state.js';
import type { Database } from '../prisma/db.js';
import { storeOurAirportsBatch } from './adapters/ourairports-store.js';
import type { CatalogRecord } from './catalog.js';
import { upsertCatalogBatch } from './catalog-store.js';

export function resolverIdentidadAeropuerto(
  db: Database,
  params: { fuente: string; identificador: string },
  aeropuertoId: string,
) {
  return escribirCatalogo(db, async (tx) => {
    const identity =
      await tx.orm.public.IdentidadAeropuertoFuente.first(params);
    if (!identity) throw new NotFoundException('Identidad no encontrada');
    const airport = await tx.orm.public.Aeropuerto.first({
      id: aeropuertoId,
      archivadoEn: null,
    });
    if (!airport)
      throw new BadRequestException('Aeropuerto inexistente o archivado');
    if (identity.aeropuertoId && identity.aeropuertoId !== airport.id)
      throw new BadRequestException('La identidad ya está resuelta');
    if (identity.aeropuertoId === airport.id) return identity;
    await tx.orm.public.IdentidadAeropuertoFuente.where(params).update({
      aeropuertoId: airport.id,
      rechazadoEn: null,
    });
    if (params.fuente === 'OpenFlights') {
      const otra = await tx.orm.public.IdentidadAeropuertoFuente.where({
        fuente: 'OpenFlights',
        aeropuertoId: airport.id,
      })
        .where((i) => i.identificador.neq(params.identificador))
        .first();
      if (otra)
        throw new BadRequestException('Identificador OpenFlights incompatible');
      await upsertCatalogBatch(tx, 'aeropuertos', [
        {
          ...(identity.observacion as CatalogRecord),
          id: airport.id,
          idOpenflights: Number(params.identificador),
        },
      ]);
    } else {
      await storeOurAirportsBatch(tx, 'aeropuertos', [
        identity.observacion as CatalogRecord,
      ]);
    }
    return tx.orm.public.IdentidadAeropuertoFuente.firstOrThrow(params);
  });
}
