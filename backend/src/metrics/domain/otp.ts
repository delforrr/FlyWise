import type { Operacion } from '../../entities/vuelos/domain/operacion.js';

const UMBRAL_OTP_MINUTOS = 15;
type EvidenciaOtp = Pick<Operacion, 'estado' | 'demoraLlegadaMinutos'>;

export function resumirPuntualidad(operaciones: Iterable<EvidenciaOtp>) {
  const resumen = {
    total: 0,
    elegibles: 0,
    puntuales: 0,
    cancelados: 0,
    desviados: 0,
    sinEvidencia: 0,
    demoraTotal: 0n,
  };
  for (const operacion of operaciones) acumularPuntualidad(resumen, operacion);
  return resumen;
}

export function acumularPuntualidad(
  resumen: ReturnType<typeof resumirPuntualidad>,
  { estado, demoraLlegadaMinutos }: EvidenciaOtp,
) {
  resumen.total++;
  if (estado === 'CANCELLED') {
    resumen.cancelados++;
  } else if (estado === 'DIVERTED') {
    resumen.desviados++;
    resumen.elegibles++;
  } else if (demoraLlegadaMinutos === null) {
    resumen.sinEvidencia++;
  } else {
    resumen.elegibles++;
    // El contador de demora de la API conserva minutos enteros.
    resumen.demoraTotal += BigInt(Math.ceil(demoraLlegadaMinutos));
    if (demoraLlegadaMinutos <= UMBRAL_OTP_MINUTOS) resumen.puntuales++;
  }
}

export function porcentajeOtp(puntuales: number, elegibles: number) {
  return elegibles === 0 ? null : (100 * puntuales) / elegibles;
}
