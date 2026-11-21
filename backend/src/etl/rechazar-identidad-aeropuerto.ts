import { BadRequestException, NotFoundException } from '@nestjs/common';
import { escribirCatalogo } from '../catalogos/catalog-state.js';
import type { Database } from '../prisma/db.js';

const ahora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function cambiarRechazoIdentidadAeropuerto(
  db: Database,
  params: { fuente: string; identificador: string },
  rechazado: boolean,
) {
  return escribirCatalogo(db, async (tx) => {
    const identidad =
      await tx.orm.public.IdentidadAeropuertoFuente.first(params);
    if (!identidad) throw new NotFoundException('Identidad no encontrada');
    if (identidad.aeropuertoId)
      throw new BadRequestException('La identidad ya está vinculada');
    if (Boolean(identidad.rechazadoEn) === rechazado) return identidad;
    return tx.orm.public.IdentidadAeropuertoFuente.where(params).update({
      rechazadoEn: rechazado ? ahora() : null,
    });
  });
}

export function rechazarTodasIdentidadesAeropuerto(db: Database) {
  return escribirCatalogo(db, async (tx) => {
    const pendientes = tx.orm.public.IdentidadAeropuertoFuente.where({
      aeropuertoId: null,
      rechazadoEn: null,
    }).where((i) => i.fuente.in(['OurAirports', 'OpenFlights']));
    return await pendientes.updateAndCount({ rechazadoEn: ahora() });
  });
}
