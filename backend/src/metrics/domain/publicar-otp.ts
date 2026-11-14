import { acumularPuntualidad, resumirPuntualidad } from './otp.js';
import type { Operacion } from '../../entities/vuelos/domain/operacion.js';

type FilaOtp = Pick<Operacion, 'estado' | 'demoraLlegadaMinutos'> & {
  fuente: string;
};

export interface RepositorioPublicacionOtp {
  leer(): AsyncIterable<ReadonlyArray<FilaOtp>>;
  publicar(
    resumen: ReturnType<typeof resumirPuntualidad>,
    fuentes: string[],
  ): Promise<void>;
}

export async function publicarOtp(
  repositorio: RepositorioPublicacionOtp,
  fuenteVigente?: string,
) {
  const resumen = resumirPuntualidad([]);
  const fuentes = new Set<string>(fuenteVigente ? [fuenteVigente] : []);
  for await (const lote of repositorio.leer()) {
    for (const vuelo of lote) {
      acumularPuntualidad(resumen, vuelo);
      fuentes.add(vuelo.fuente);
    }
  }
  await repositorio.publicar(resumen, [...fuentes]);
}
