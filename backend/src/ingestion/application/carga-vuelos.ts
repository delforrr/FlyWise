export type ConsultaCargaVuelos =
  | { alcance: 'mensual'; periodo: string }
  | { alcance: 'tramo'; periodo: string; origenId: string; destinoId: string };

type EjecutarCarga<Alcance extends ConsultaCargaVuelos['alcance']> = (
  consulta: Extract<ConsultaCargaVuelos, { alcance: Alcance }>,
  solicitanteId: string,
) => Promise<{ ejecucionId: string }>;

export interface CargasVuelos {
  coberturaMensual: string;
  mensual: EjecutarCarga<'mensual'>;
  tramo: EjecutarCarga<'tramo'>;
}
