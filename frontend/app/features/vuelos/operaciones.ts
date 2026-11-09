import { z } from "zod";
import type { ReferenciaCatalogo } from "~/features/catalogos/schemas/catalogos";

export const operacionSchema = z
  .object({
    fechaVuelo: z.iso
      .date()
      .refine(
        (fecha) => fecha <= new Date().toISOString().slice(0, 10),
        "Sólo se admiten operaciones finalizadas.",
      ),
    numeroVuelo: z
      .string()
      .trim()
      .min(1, "Ingresá el número de vuelo.")
      .max(30),
    origenId: z.uuid("Seleccioná el origen."),
    destinoId: z.uuid("Seleccioná el destino."),
    aerolineaId: z.uuid("Seleccioná la aerolínea."),
    estado: z.enum(["ARRIVED", "CANCELLED", "DIVERTED"]),
    demoraLlegadaMinutos: z
      .number()
      .int()
      .min(-2147483648)
      .max(2147483647)
      .nullable(),
  })
  .refine(
    (d) => d.origenId !== d.destinoId,
    "El origen y destino deben ser distintos.",
  )
  .refine(
    (d) =>
      d.estado === "ARRIVED"
        ? d.demoraLlegadaMinutos !== null
        : d.demoraLlegadaMinutos === null,
    "ARRIVED requiere demora; cancelados y desviados requieren demora nula.",
  );
export type DatosOperacion = z.infer<typeof operacionSchema>;
export interface Vuelo extends DatosOperacion {
  id: string;
  version: number;
  fuente: string;
  idRegistroFuente: string;
  ejecucionEtlId: string | null;
  protegidoManualmente: boolean;
  archivadoEn: string | null;
  ultimaObservacion: DatosOperacion | null;
  origen: ReferenciaCatalogo;
  destino: ReferenciaCatalogo;
  aerolinea: ReferenciaCatalogo;
}
export interface HistorialOperacion {
  version: number;
  accion: string;
  actorId: string | null;
  instantanea: Record<string, unknown>;
  creadoEn: string;
}
export interface MetricaOperacion {
  vuelosTotales: number;
  vuelosCancelados: number;
  vuelosDesviados: number;
  vuelosPuntuales: number;
  otp15: number | null;
  pendiente: boolean;
  errorActualizacion: string | null;
  actualizadoEn: string | null;
  fuentes: string[];
}
export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}
