import { describe, it, expect } from "vitest";
import {
  aeropuertoSchema,
  aerolineaSchema,
  rutaSchema,
} from "../../app/features/catalogos/schemas/catalogos";

describe("Formularios de catálogos", () => {
  it("exige coordenadas, normaliza códigos opcionales y conserva actividad desconocida", () => {
    expect(
      aeropuertoSchema.safeParse({
        nombre: "Ezeiza",
        paisId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      aerolineaSchema.parse({
        nombre: "Operadora",
        iata: " ab ",
        icao: "",
        actividad: "desconocida",
      }),
    ).toMatchObject({ iata: "AB", icao: null, activa: null, paisId: null });
  });
  it("rechaza una ruta con extremos iguales", () => {
    const id = crypto.randomUUID();
    expect(
      rutaSchema.safeParse({
        origenId: id,
        destinoId: id,
        codigoCompartido: false,
        escalas: 0,
      }).success,
    ).toBe(false);
  });
});
