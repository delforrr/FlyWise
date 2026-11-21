import type {
  AdaptadorOperaciones,
  EvidenciaOperacion,
  FilaOperacion,
  LoteOperaciones,
} from './adaptador-operaciones.js';

type Consumidor<T extends EvidenciaOperacion, Cursor> = {
  iniciarLote?(lote: LoteOperaciones<T, Cursor>): void;
  procesarFila(fila: FilaOperacion<T>): void | Promise<void>;
  terminarLote(lote: LoteOperaciones<T, Cursor>): void | Promise<void>;
};

export async function ingerirOperaciones<
  Alcance,
  T extends EvidenciaOperacion,
  Cursor,
>(
  adaptador: AdaptadorOperaciones<Alcance, T, Cursor>,
  alcance: Alcance,
  consumidor: Consumidor<T, Cursor>,
) {
  for await (const lote of adaptador.leerLotes(alcance)) {
    consumidor.iniciarLote?.(lote);
    for (const fila of lote.filas) await consumidor.procesarFila(fila);
    await consumidor.terminarLote(lote);
  }
}
