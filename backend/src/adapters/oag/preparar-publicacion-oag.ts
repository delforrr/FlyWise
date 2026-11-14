import {
  validarOperacion,
  type ObservacionVuelo,
} from '../../entities/vuelos/domain/operacion.js';
import type { OperacionOag } from './adaptador-oag.js';

export type VueloResuelto = Omit<OperacionOag, 'carrier'> & {
  aerolineaId: string;
};

export function prepararPublicacionOag(
  candidatos: Iterable<VueloResuelto>,
  alcance: { origenId: string; destinoId: string; coberturaMinimaPct: number },
  descartesLectura: number,
) {
  const porOperadora = new Map<
    string,
    {
      total: number;
      resueltas: number;
      llegadas: number;
      desviadas: number;
      canceladas: number;
    }
  >();
  let descartadas = descartesLectura;
  const observaciones: ObservacionVuelo[] = [];
  for (const vuelo of candidatos) {
    const resumen = porOperadora.get(vuelo.aerolineaId) ?? {
      total: 0,
      resueltas: 0,
      llegadas: 0,
      desviadas: 0,
      canceladas: 0,
    };
    porOperadora.set(vuelo.aerolineaId, resumen);
    resumen.total++;
    if (!vuelo.estado) {
      descartadas++;
      continue;
    }
    resumen.resueltas++;
    if (vuelo.estado === 'ARRIVED' && vuelo.demoraLlegadaMinutos !== null)
      resumen.llegadas++;
    if (vuelo.estado === 'DIVERTED') resumen.desviadas++;
    if (vuelo.estado === 'CANCELLED') resumen.canceladas++;
    try {
      observaciones.push({
        fuente: 'OAG',
        idRegistroFuente: JSON.stringify([vuelo.aerolineaId, vuelo.id]),
        ...validarOperacion({
          origenId: alcance.origenId,
          destinoId: alcance.destinoId,
          aerolineaId: vuelo.aerolineaId,
          fechaVuelo: vuelo.fechaVuelo,
          horarios: vuelo.horarios,
          numeroVuelo: vuelo.numeroVuelo,
          estado: vuelo.estado,
          demoraLlegadaMinutos: vuelo.demoraLlegadaMinutos,
        }),
      });
    } catch (error: unknown) {
      return { tipo: 'invalida', descartadas, error } as const;
    }
  }
  const cobertura = alcance.coberturaMinimaPct / 100;
  const tieneCobertura = [...porOperadora.values()].every(
    (r) =>
      r.resueltas >= cobertura * r.total &&
      r.llegadas >= cobertura * (r.total - r.canceladas - r.desviadas),
  );
  if (
    !observaciones.length ||
    !tieneCobertura ||
    observaciones.length < cobertura * (observaciones.length + descartadas)
  )
    return { tipo: 'cobertura-insuficiente', descartadas } as const;
  const totalesPorOperadora = Object.fromEntries(
    [...porOperadora].map(([id, resumen]) => [id, resumen.resueltas]),
  );
  return { tipo: 'lista', observaciones, totalesPorOperadora } as const;
}
