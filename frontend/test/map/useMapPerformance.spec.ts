import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useMapPerformance,
  detectMobileOrTouch,
  detectLowEndHardware,
} from "../../app/features/flight-map/composables/useMapPerformance";

describe("useMapPerformance — Detección y Adaptación de Rendimiento de Hardware", () => {
  const originalInnerWidth = window.innerWidth;
  const originalNavigator = { ...window.navigator };

  beforeEach(() => {
    const perf = useMapPerformance();
    perf.resetPerformanceState();
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    vi.restoreAllMocks();
  });

  describe("detectMobileOrTouch() — Detección de Viewport y Pantallas Táctiles", () => {
    it("retorna true si el ancho de pantalla es inferior a 768px (móvil)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 412,
      });

      expect(detectMobileOrTouch()).toBe(true);
    });

    it("retorna false en desktop con pantalla ancha y sin puntero táctil grueso", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1280,
      });
      Object.defineProperty(navigator, "maxTouchPoints", {
        writable: true,
        configurable: true,
        value: 0,
      });

      expect(detectMobileOrTouch()).toBe(false);
    });

    it("retorna true en tablets con pantalla táctil primaria (pointer: coarse y maxTouchPoints > 0)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 820,
      });
      Object.defineProperty(navigator, "maxTouchPoints", {
        writable: true,
        configurable: true,
        value: 5,
      });

      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(detectMobileOrTouch()).toBe(true);
    });
  });

  describe("detectLowEndHardware() — Detección de Recursos Limitados", () => {
    it("retorna true si la concurrencia de CPU es <= 4 núcleos", () => {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        writable: true,
        configurable: true,
        value: 4,
      });

      expect(detectLowEndHardware()).toBe(true);
    });

    it("retorna true si la memoria RAM reportada es <= 4 GB", () => {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        writable: true,
        configurable: true,
        value: 8,
      });
      Object.defineProperty(navigator, "deviceMemory", {
        writable: true,
        configurable: true,
        value: 2,
      });

      expect(detectLowEndHardware()).toBe(true);
    });

    it("retorna false si hardwareConcurrency > 4 y deviceMemory > 4 sin GPU de bajo rendimiento", () => {
      Object.defineProperty(navigator, "hardwareConcurrency", {
        writable: true,
        configurable: true,
        value: 8,
      });
      Object.defineProperty(navigator, "deviceMemory", {
        writable: true,
        configurable: true,
        value: 16,
      });

      expect(detectLowEndHardware()).toBe(false);
    });
  });

  describe("useMapPerformance() — Flags Reactivos y Adaptación", () => {
    it("aplica perfil estricto de optimización cuando isMobileOrTouch es true", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: true, isLowEnd: false });

      expect(perf.allow3D.value).toBe(false); // 2D estricto en móviles
      expect(perf.enableHoverPicking.value).toBe(false); // Sin picking en hover
      expect(perf.enableTooltips.value).toBe(false); // Sin tooltips en móviles
      expect(perf.enableRadarRings.value).toBe(false); // Poda de anillos decorativos
      expect(perf.enableLODLabels.value).toBe(true); // LOD activo para mega-hubs
      expect(perf.maxTileCache.value).toBe(40); // Caché conservadora
      expect(perf.dpr.value).toBeLessThanOrEqual(1.25); // Clamping de DPR
    });

    it("permite experiencia gráfica completa cuando el dispositivo es desktop de alto rendimiento", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: false, isLowEnd: false });

      expect(perf.allow3D.value).toBe(true);
      expect(perf.enableHoverPicking.value).toBe(true);
      expect(perf.enableTooltips.value).toBe(true);
      expect(perf.enableRadarRings.value).toBe(true);
      expect(perf.enableLODLabels.value).toBe(false);
      expect(perf.maxTileCache.value).toBe(100);
      expect(perf.dpr.value).toBeLessThanOrEqual(2.0);
    });

    it("limita DPR y habilita LOD en desktop si se detecta hardware de bajos recursos (isLowEnd = true)", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: false, isLowEnd: true });

      expect(perf.allow3D.value).toBe(true); // En desktop mantiene 3D
      expect(perf.enableTooltips.value).toBe(true); // En desktop mantiene tooltips con ratón
      expect(perf.enableRadarRings.value).toBe(false); // Desactiva anillos secundarios
      expect(perf.enableLODLabels.value).toBe(true); // Activa LOD para mega-hubs
      expect(perf.dpr.value).toBeLessThanOrEqual(1.25); // Reduce resolución de render
      expect(perf.maxTileCache.value).toBe(40);
    });
  });
});
