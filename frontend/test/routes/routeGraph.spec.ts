import { describe, it, expect } from "vitest";
import {
  routeByIdMap,
  routesByAirportMap,
  outgoingRoutesMap,
  incomingRoutesMap,
  findRouteBetween,
  queryMatchingRoutes,
} from "../../app/features/route-audit/utils/routeGraph";
import { SEED_ROUTES } from "../../app/data/seedData";

describe("routeGraph — Algoritmos de Grafos y Búsqueda O(1) de Rutas", () => {
  describe("Integridad de Índices Map Precalculados (O(1))", () => {
    it("indexa todas las SEED_ROUTES por ID y por clave compuesta 'ORIG-DEST'", () => {
      expect(routeByIdMap.size).toBeGreaterThan(0);

      for (const route of SEED_ROUTES) {
        // Acceso por ID
        expect(routeByIdMap.get(route.id)).toBeDefined();
        // Acceso por tupla
        const compositeKey = `${route.originIata}-${route.destinationIata}`;
        expect(routeByIdMap.get(compositeKey)).toBeDefined();
      }
    });

    it("clasifica correctamente las rutas entrantes y salientes en outgoingRoutesMap e incomingRoutesMap", () => {
      for (const route of SEED_ROUTES) {
        const outgoing = outgoingRoutesMap.get(route.originIata);
        expect(outgoing).toBeDefined();
        expect(outgoing?.some((r) => r.id === route.id)).toBe(true);

        const incoming = incomingRoutesMap.get(route.destinationIata);
        expect(incoming).toBeDefined();
        expect(incoming?.some((r) => r.id === route.id)).toBe(true);
      }
    });
  });

  describe("findRouteBetween() — Resolución bidireccional de tramos", () => {
    it("encuentra una ruta directa en orden origen -> destino", () => {
      const sampleRoute = SEED_ROUTES[0];
      const found = findRouteBetween(sampleRoute.originIata, sampleRoute.destinationIata);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(sampleRoute.id);
    });

    it("encuentra la ruta directa de forma simétrica (destino -> origen)", () => {
      const sampleRoute = SEED_ROUTES[0];
      const foundReverse = findRouteBetween(sampleRoute.destinationIata, sampleRoute.originIata);

      expect(foundReverse).not.toBeNull();
      expect(foundReverse?.id).toBe(sampleRoute.id);
    });

    it("retorna null si alguno de los parámetros es undefined o cadena vacía", () => {
      expect(findRouteBetween(undefined, "MIA")).toBeNull();
      expect(findRouteBetween("EZE", undefined)).toBeNull();
      expect(findRouteBetween("", "MIA")).toBeNull();
      expect(findRouteBetween()).toBeNull();
    });

    it("retorna null cuando no existe conexión directa entre los aeropuertos", () => {
      const found = findRouteBetween("NON_EXISTENT_1", "NON_EXISTENT_2");
      expect(found).toBeNull();
    });
  });

  describe("queryMatchingRoutes() — Filtrado analítico y resolución de escalas", () => {
    it("sin selección de origen ni destino retorna el catálogo completo de rutas (SEED_ROUTES)", () => {
      const allRoutes = queryMatchingRoutes();
      expect(allRoutes).toHaveLength(SEED_ROUTES.length);
      expect(allRoutes).toEqual(SEED_ROUTES);
    });

    it("filtrando solo por origen retorna todas las conexiones que parten o tocan el Hub", () => {
      const originHub = "EZE";
      const routes = queryMatchingRoutes(originHub, undefined);
      const expected = routesByAirportMap.get(originHub) ?? [];

      expect(routes).toEqual(expected);
      expect(routes.length).toBe(expected.length);
    });

    it("filtrando solo por destino retorna todas las conexiones correspondientes al nodo destino", () => {
      const destHub = "MAD";
      const routes = queryMatchingRoutes(undefined, destHub);
      const expected = routesByAirportMap.get(destHub) ?? [];

      expect(routes).toEqual(expected);
      expect(routes.length).toBe(expected.length);
    });

    it("con origen y destino encuentra el tramo directo y las conexiones de 1 escala sin duplicados", () => {
      const sampleRoute = SEED_ROUTES[0];
      const orig = sampleRoute.originIata;
      const dest = sampleRoute.destinationIata;

      const results = queryMatchingRoutes(orig, dest);

      // Debe incluir la ruta directa
      expect(results.some((r) => r.id === sampleRoute.id)).toBe(true);

      // Verificamos ausencia de IDs duplicados
      const ids = results.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("retorna arreglo vacío si se consultan aeropuertos no existentes sin conexiones", () => {
      const results = queryMatchingRoutes("XYZ1", "XYZ2");
      expect(results).toEqual([]);
    });
  });
});
