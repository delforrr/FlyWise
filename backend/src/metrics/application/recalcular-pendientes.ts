import {
  tienePublicacionExterna,
  type EvidenciaPublicacion,
} from '../domain/autoridad-publicacion.js';

export const LOTE_METRICAS_PENDIENTES = 100;

export type Poblacion = {
  origenId: string;
  destinoId: string;
  aerolineaId: string;
  periodo: string;
};

type PublicacionesPendientes = {
  leerPendientes(): Promise<(Poblacion & EvidenciaPublicacion)[]>;
  limpiarPendiente(poblacion: Poblacion): Promise<void>;
  publicarAdministrativa(poblacion: Poblacion): Promise<void>;
};

export async function recalcularPendientes(repo: PublicacionesPendientes) {
  const pendientes = await repo.leerPendientes();
  for (const {
    ejecucionId,
    actualizada,
    vuelosTotales,
    fuentes,
    ...poblacion
  } of pendientes) {
    if (
      tienePublicacionExterna({
        ejecucionId,
        actualizada,
        vuelosTotales,
        fuentes,
      })
    )
      await repo.limpiarPendiente(poblacion);
    else await repo.publicarAdministrativa(poblacion);
  }
  return pendientes.length;
}
