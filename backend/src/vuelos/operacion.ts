export interface Operacion {
  fechaVuelo: string;
  numeroVuelo: string;
  origenId: string;
  destinoId: string;
  aerolineaId: string;
  estado: 'ARRIVED' | 'CANCELLED' | 'DIVERTED';
  demoraLlegadaMinutos: number | null;
}
export type ObservacionVuelo = Operacion & {
  fuente: string;
  idRegistroFuente: string;
};

export function validarOperacion(
  datos: Omit<Operacion, 'demoraLlegadaMinutos'> & {
    demoraLlegadaMinutos?: number | null;
  },
): Operacion {
  if (datos.origenId === datos.destinoId)
    throw new RangeError('Origen y destino deben ser distintos');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(datos.fechaVuelo) ||
    datos.fechaVuelo < '0001-01-01' ||
    !Number.isFinite(Date.parse(datos.fechaVuelo)) ||
    new Date(datos.fechaVuelo).toISOString().slice(0, 10) !== datos.fechaVuelo
  )
    throw new RangeError('Fecha de vuelo inválida');
  if (datos.fechaVuelo > new Date().toISOString().slice(0, 10))
    throw new RangeError('Sólo se admiten operaciones finalizadas');
  if (!['ARRIVED', 'CANCELLED', 'DIVERTED'].includes(datos.estado))
    throw new RangeError('Sólo se admiten resultados finales');
  if (
    datos.estado === 'ARRIVED'
      ? !Number.isInteger(datos.demoraLlegadaMinutos)
      : datos.demoraLlegadaMinutos != null
  )
    throw new RangeError(
      'ARRIVED requiere demora entera; CANCELLED y DIVERTED requieren demora nula',
    );
  return {
    fechaVuelo: datos.fechaVuelo,
    numeroVuelo: datos.numeroVuelo,
    origenId: datos.origenId,
    destinoId: datos.destinoId,
    aerolineaId: datos.aerolineaId,
    estado: datos.estado,
    demoraLlegadaMinutos: datos.demoraLlegadaMinutos ?? null,
  };
}
