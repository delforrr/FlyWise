export type EvidenciaPublicacion = {
  ejecucionId: string | null;
  actualizada: boolean;
  vuelosTotales: number;
  fuentes: unknown;
};

function esFuenteUnica(fuentes: unknown, fuente: string) {
  return (
    Array.isArray(fuentes) && fuentes.length === 1 && fuentes[0] === fuente
  );
}

export function tienePublicacionExterna(evidencia: EvidenciaPublicacion) {
  return (
    evidencia.ejecucionId !== null ||
    (evidencia.actualizada &&
      evidencia.vuelosTotales > 0 &&
      !esFuenteUnica(evidencia.fuentes, 'Administrativa'))
  );
}

export function admiteFuente(
  actual: EvidenciaPublicacion & { fuente: string | null },
  candidata: string,
  autorizada: boolean,
) {
  return (
    autorizada ||
    (actual.fuente !== null
      ? actual.fuente === candidata
      : !tienePublicacionExterna(actual) ||
        esFuenteUnica(actual.fuentes, candidata))
  );
}
