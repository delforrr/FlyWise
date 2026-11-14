export const MAX_ESCALAS = 2_147_483_647;
export const MIN_ESCALAS = 0;
export const CODIGO_OPERADORA_RUTA = /^[A-Z0-9]{2,3}$/;

export function extremosDistintos(origenId: string, destinoId: string) {
  return origenId !== destinoId;
}
