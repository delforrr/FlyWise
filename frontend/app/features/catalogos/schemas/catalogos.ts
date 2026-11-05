import { z } from "zod";

export const aeropuertoSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá un nombre.").max(255),
  ciudad: z
    .string()
    .trim()
    .max(255)
    .nullish()
    .transform((v) => v || null),
  paisId: z.uuid("Seleccioná un país."),
  iata: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(?:[A-Z]{3})?$/)
    .nullish()
    .transform((v) => v || null),
  icao: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(?:[A-Z0-9]{4})?$/)
    .nullish()
    .transform((v) => v || null),
  latitud: z.number("Ingresá la latitud.").min(-90).max(90),
  longitud: z.number("Ingresá la longitud.").min(-180).max(180),
});
export const aerolineaSchema = z
  .object({
    nombre: z.string().trim().min(1, "Ingresá un nombre.").max(255),
    paisId: z
      .uuid()
      .nullish()
      .transform((v) => v || null),
    iata: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^(?:[A-Z0-9]{2})?$/)
      .nullish()
      .transform((v) => v || null),
    icao: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^(?:[A-Z0-9]{3})?$/)
      .nullish()
      .transform((v) => v || null),
    actividad: z.enum(["desconocida", "activa", "inactiva"]),
  })
  .transform(({ actividad, ...datos }) => ({
    ...datos,
    activa: actividad === "desconocida" ? null : actividad === "activa",
  }));
export const rutaSchema = z
  .object({
    origenId: z.uuid("Seleccioná un origen."),
    destinoId: z.uuid("Seleccioná un destino."),
  })
  .refine((v) => v.origenId !== v.destinoId, {
    path: ["destinoId"],
    message: "El destino debe ser distinto del origen.",
  });
export const ofertaRutaSchema = z.object({
  aerolineaId: z
    .uuid()
    .nullish()
    .transform((v) => v || null),
  codigoAerolinea: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(?:[A-Z0-9]{2,3})?$/)
    .nullish()
    .transform((v) => v || null),
  codigoCompartido: z.boolean(),
  escalas: z.number().int().min(0).max(2147483647),
});
export type DatosOferta =
  z.output<typeof ofertaRutaSchema> | { protegidoManualmente: false };
export type DatosCatalogo =
  | z.output<typeof aeropuertoSchema>
  | z.output<typeof aerolineaSchema>
  | z.output<typeof rutaSchema>;
export type RecursoCatalogo = "aeropuertos" | "aerolineas" | "rutas";
export interface ReferenciaCatalogo {
  id: string;
  nombre: string;
  iata?: string | null;
  archivadoEn?: string | null;
}
export interface RegistroCatalogo {
  id: string;
  fuente?: string | null;
  archivadoEn: string | null;
  protegidoManualmente: boolean;
  nombre?: string;
  ciudad?: string | null;
  paisId?: string | null;
  nombrePais?: string;
  pais?: string | null;
  iata?: string | null;
  icao?: string | null;
  latitud?: number;
  longitud?: number;
  activa?: boolean | null;
  origenId?: string;
  destinoId?: string;
  aerolineaId?: string | null;
  codigoAerolinea?: string | null;
  codigoCompartido?: boolean;
  escalas?: number;
  ofertas?: RegistroCatalogo[];
  origen?: ReferenciaCatalogo;
  destino?: ReferenciaCatalogo;
  aerolinea?: ReferenciaCatalogo | null;
}
export interface PaginaCatalogo {
  datos: RegistroCatalogo[];
  total: number;
  pagina: number;
  limite: number;
}
