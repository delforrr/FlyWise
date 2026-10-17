import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AirportTooltipContent from "../../app/features/flight-map/components/tooltips/AirportTooltipContent.vue";
import RouteTooltipContent from "../../app/features/flight-map/components/tooltips/RouteTooltipContent.vue";
import ControlButton from "../../app/features/flight-map/components/controls/ControlButton.vue";
import MapTooltip from "../../app/features/flight-map/components/tooltips/MapTooltip.vue";
import MapControls from "../../app/features/flight-map/components/controls/MapControls.vue";
import { useMapPerformance } from "../../app/features/flight-map/composables/useMapPerformance";
import { useFlightSelection } from "../../app/features/route-audit/composables/useFlightSelection";
import type { Airport } from "../../app/types/airport";
import type { FlightRoute } from "../../app/types/route";

const UBadgeStub = {
  name: "UBadge",
  props: ["size", "variant", "color"],
  template: '<span class="u-badge-stub" :data-color="color"><slot /></span>',
};

const UIconStub = {
  name: "UIcon",
  props: ["name"],
  template: '<i class="u-icon-stub" :data-icon="name" />',
};

const OtpBadgeStub = {
  name: "OtpBadge",
  props: ["value"],
  template: '<span class="otp-badge-stub" :data-otp="value">{{ value }}%</span>',
};

const UButtonStub = {
  name: "UButton",
  props: ["disabled", "ariaLabel", "title"],
  emits: ["click"],
  template: '<button :disabled="disabled" :aria-label="ariaLabel" @click="$emit(\'click\', $event)"><slot /></button>',
};

const UTooltipStub = {
  name: "UTooltip",
  props: ["text", "content"],
  template: '<div class="u-tooltip-stub"><slot /></div>',
};

const HudContainerStub = {
  name: "HudContainer",
  template: '<div class="hud-container-stub"><slot /></div>',
};

const UPopoverStub = {
  name: "UPopover",
  template: '<div class="u-popover-stub"><slot /><slot name="content" /></div>',
};

const USeparatorStub = {
  name: "USeparator",
  template: '<hr class="u-separator-stub" />',
};

if (typeof (globalThis as any).useFlightMap === "undefined") {
  (globalThis as any).useFlightMap = () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    toggle3D: vi.fn(),
    fitRoute: vi.fn(),
    resetNorth: vi.fn(),
    currentPitch: (globalThis as any).ref ? (globalThis as any).ref(0) : { value: 0 },
    mapInstance: (globalThis as any).shallowRef ? (globalThis as any).shallowRef(null) : { value: null },
  });
}

describe("Map Tooltips — Componentes Visuales del Mapa Aeronáutico", () => {
  describe("AirportTooltipContent.vue — Ficha Táctica de Aeropuerto", () => {
    const mockLargeAirport: Airport = {
      id: "eze-01",
      iata: "EZE",
      icao: "SAEZ",
      name: "Ministro Pistarini International Airport",
      city: "Buenos Aires",
      country: "Argentina",
      coordinates: [-58.5358, -34.8222],
      type: "large_airport",
      elevation: 67,
      connectionsCount: 42,
    };

    it("renderiza IATA, OACI y categoriza como 'HUB INTERNACIONAL' para large_airport", () => {
      const wrapper = mount(AirportTooltipContent, {
        props: { airport: mockLargeAirport },
        global: { stubs: { UBadge: UBadgeStub, UIcon: UIconStub } },
      });

      expect(wrapper.text()).toContain("EZE");
      expect(wrapper.text()).toContain("(SAEZ)");
      expect(wrapper.text()).toContain("HUB INTERNACIONAL");
      expect(wrapper.text()).toContain("Ministro Pistarini International Airport");
      expect(wrapper.text()).toContain("Buenos Aires, Argentina");
    });

    it("clasifica como 'REGIONAL' para medium_airport y 'AEROPUERTO' para otros tipos", () => {
      const mediumAirport: Airport = {
        ...mockLargeAirport,
        type: "medium_airport",
      };
      const wrapperMedium = mount(AirportTooltipContent, {
        props: { airport: mediumAirport },
        global: { stubs: { UBadge: UBadgeStub, UIcon: UIconStub } },
      });
      expect(wrapperMedium.text()).toContain("REGIONAL");

      const smallAirport: Airport = {
        ...mockLargeAirport,
        type: "small_airport",
      };
      const wrapperSmall = mount(AirportTooltipContent, {
        props: { airport: smallAirport },
        global: { stubs: { UBadge: UBadgeStub, UIcon: UIconStub } },
      });
      expect(wrapperSmall.text()).toContain("AEROPUERTO");
    });

    it("formatea coordenadas geográficas bajo estándar SRID 4326 (WGS 84)", () => {
      const wrapper = mount(AirportTooltipContent, {
        props: { airport: mockLargeAirport },
        global: { stubs: { UBadge: UBadgeStub, UIcon: UIconStub } },
      });

      // [-58.5358, -34.8222] -> 34.8222°S, 58.5358°W
      expect(wrapper.text()).toContain("34.8222°S, 58.5358°W");
    });

    it("renderiza el contador de conexiones directas cuando está definido", () => {
      const wrapper = mount(AirportTooltipContent, {
        props: { airport: mockLargeAirport },
        global: { stubs: { UBadge: UBadgeStub, UIcon: UIconStub } },
      });

      expect(wrapper.text()).toContain("Conexiones directas:");
      expect(wrapper.text()).toContain("42");
    });
  });

  describe("RouteTooltipContent.vue — Ficha Táctica de Ruta y OTP-15", () => {
    const mockRoute: FlightRoute = {
      id: "R-EZE-MIA",
      originIata: "EZE",
      originName: "Ministro Pistarini Int. Airport",
      originCity: "Buenos Aires",
      originCoordinates: [-58.5358, -34.8222],
      destinationIata: "MIA",
      destinationName: "Miami International Airport",
      destinationCity: "Miami",
      destinationCoordinates: [-80.2906, 25.7959],
      distanceKm: 7100,
      averageOtp15: 88.5,
      primaryAirline: "Aerolíneas Argentinas",
      flightType: "direct",
      airlines: [
        {
          airlineCode: "AR",
          airlineName: "Aerolíneas Argentinas",
          otp15: 88.5,
          avgDelayMinutes: 11,
          cancellationRate: 0.8,
          sampleFlightsCount: 320,
        },
      ],
    };

    it("renderiza el par de aeropuertos, ciudades y aerolínea principal", () => {
      const wrapper = mount(RouteTooltipContent, {
        props: { route: mockRoute },
        global: { stubs: { UIcon: UIconStub, OtpBadge: OtpBadgeStub } },
      });

      expect(wrapper.text()).toContain("EZE");
      expect(wrapper.text()).toContain("MIA");
      expect(wrapper.text()).toContain("Buenos Aires");
      expect(wrapper.text()).toContain("Miami");
      expect(wrapper.text()).toContain("Aerolíneas Argentinas");
    });

    it("calcula y formatea la distancia en kilómetros y millas náuticas (1 nm = 1.852 km)", () => {
      const wrapper = mount(RouteTooltipContent, {
        props: { route: mockRoute },
        global: { stubs: { UIcon: UIconStub, OtpBadge: OtpBadgeStub } },
      });

      // 7100 km / 1.852 ≈ 3834 nm (compatible con separador de miles '.' o ',')
      expect(wrapper.text()).toMatch(/7[.,]100\s*km/);
      expect(wrapper.text()).toMatch(/3[.,]834\s*nm/);
    });

    it("enlaza la métrica de puntualidad averageOtp15 con OtpBadge", () => {
      const wrapper = mount(RouteTooltipContent, {
        props: { route: mockRoute },
        global: { stubs: { UIcon: UIconStub, OtpBadge: OtpBadgeStub } },
      });

      const otpBadge = wrapper.findComponent(OtpBadgeStub);
      expect(otpBadge.exists()).toBe(true);
      expect(otpBadge.props("value")).toBe(88.5);
    });
  });

  describe("ControlButton.vue — Botón Táctico de Cabina HUD", () => {
    it("renderiza botón con ícono predeterminado i-lucide-plus para zoomIn", () => {
      const wrapper = mount(ControlButton, {
        props: { type: "zoomIn" },
        global: { stubs: { UButton: UButtonStub, UIcon: UIconStub } },
      });

      const icon = wrapper.findComponent(UIconStub);
      expect(icon.exists()).toBe(true);
      expect(icon.props("name")).toBe("i-lucide-plus");
    });

    it("ejecuta callback personalizado y emite evento click al interactuar", async () => {
      const mockAction = vi.fn();
      const wrapper = mount(ControlButton, {
        props: { type: "zoomIn", action: mockAction },
        global: { stubs: { UButton: UButtonStub, UIcon: UIconStub } },
      });

      const button = wrapper.find("button");
      await button.trigger("click");

      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(wrapper.emitted("click")).toHaveLength(1);
    });

    it("renderiza badge con texto 2D cuando type='toggle3D'", () => {
      const wrapper = mount(ControlButton, {
        props: { type: "toggle3D" },
        global: { stubs: { UButton: UButtonStub, UIcon: UIconStub } },
      });

      expect(wrapper.text()).toContain("2D");
    });

    it("deshabilita el botón cuando el prop disabled es true", () => {
      const wrapper = mount(ControlButton, {
        props: { type: "zoomIn", disabled: true },
        global: { stubs: { UButton: UButtonStub, UIcon: UIconStub } },
      });

      const button = wrapper.find("button");
      expect(button.attributes("disabled")).toBeDefined();
    });
  });

  describe("MapTooltip.vue — Supresión de Tooltips según Rendimiento", () => {
    it("no renderiza el tooltip cuando enableTooltips es false (móvil/touch) incluso con hoveredEntity activo", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: true, isLowEnd: false });

      const { hoveredEntity } = useFlightSelection();
      hoveredEntity.value = {
        type: "airport",
        data: {
          id: "eze",
          iata: "EZE",
          name: "Ezeiza",
          coordinates: [-58.5, -34.8],
          type: "large_airport",
        } as any,
        x: 100,
        y: 100,
      };

      const wrapper = mount(MapTooltip, {
        global: {
          stubs: {
            UIcon: UIconStub,
            AirportTooltipContent: { template: '<div class="airport-tooltip-stub" />' },
            RouteTooltipContent: { template: '<div class="route-tooltip-stub" />' },
            Transition: false,
          },
        },
      });

      expect(wrapper.find(".fixed").exists()).toBe(false);
    });

    it("renderiza el tooltip cuando enableTooltips es true (desktop) con hoveredEntity activo", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: false, isLowEnd: false });

      const { hoveredEntity } = useFlightSelection();
      hoveredEntity.value = {
        type: "airport",
        data: {
          id: "eze",
          iata: "EZE",
          name: "Ezeiza",
          coordinates: [-58.5, -34.8],
          type: "large_airport",
        } as any,
        x: 100,
        y: 100,
      };

      const wrapper = mount(MapTooltip, {
        global: {
          stubs: {
            UIcon: UIconStub,
            AirportTooltipContent: { template: '<div class="airport-tooltip-stub" />' },
            RouteTooltipContent: { template: '<div class="route-tooltip-stub" />' },
            Transition: false,
          },
        },
      });

      expect(wrapper.find(".fixed").exists()).toBe(true);
    });
  });

  describe("MapControls.vue — Adaptación de Controles en Móviles", () => {
    it("oculta el botón toggle3D cuando allow3D es false (móviles)", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: true, isLowEnd: false });

      const wrapper = mount(MapControls, {
        global: {
          stubs: {
            HudContainer: HudContainerStub,
            UTooltip: UTooltipStub,
            UPopover: UPopoverStub,
            USeparator: USeparatorStub,
            UButton: UButtonStub,
            ControlButton: true,
            OtpBadge: true,
          },
        },
      });

      const controlButtons = wrapper.findAllComponents({ name: "ControlButton" });
      const toggle3dButton = controlButtons.find(
        (b) => b.attributes("type") === "toggle3D" || b.props("type") === "toggle3D",
      );
      expect(toggle3dButton).toBeUndefined();
    });

    it("muestra el botón toggle3D cuando allow3D es true (desktop)", () => {
      const perf = useMapPerformance();
      perf.setPerformanceOverride({ isMobileOrTouch: false, isLowEnd: false });

      const wrapper = mount(MapControls, {
        global: {
          stubs: {
            HudContainer: HudContainerStub,
            UTooltip: UTooltipStub,
            UPopover: UPopoverStub,
            USeparator: USeparatorStub,
            UButton: UButtonStub,
            ControlButton: true,
            OtpBadge: true,
          },
        },
      });

      const controlButtons = wrapper.findAllComponents({ name: "ControlButton" });
      const toggle3dButton = controlButtons.find(
        (b) => b.attributes("type") === "toggle3D" || b.props("type") === "toggle3D",
      );
      expect(toggle3dButton).toBeDefined();
    });
  });
});

