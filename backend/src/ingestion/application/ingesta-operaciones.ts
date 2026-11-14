import type {
  AdaptadorOperaciones,
  EvidenciaOperacion,
  FilaOperacion,
  LoteOperaciones,
} from './adaptador-operaciones.js';

type Consumidor<T extends EvidenciaOperacion> = {
  iniciarLote?(lote: LoteOperaciones<T>): void;
  procesarFila(fila: FilaOperacion<T>): void | Promise<void>;
  terminarLote(lote: LoteOperaciones<T>): void | Promise<void>;
};

export async function ingerirOperaciones<Alcance, T extends EvidenciaOperacion>(
  adaptador: AdaptadorOperaciones<Alcance, T>,
  alcance: Alcance,
  consumidor: Consumidor<T>,
) {
  for await (const lote of adaptador.leerLotes(alcance)) {
    consumidor.iniciarLote?.(lote);
    for (const fila of lote.filas) await consumidor.procesarFila(fila);
    await consumidor.terminarLote(lote);
  }
}
