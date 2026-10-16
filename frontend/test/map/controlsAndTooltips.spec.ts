import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AirportTooltipContent from "../../app/features/flight-map/components/tooltips/AirportTooltipContent.vue";
import RouteTooltipContent from "../../app/features/flight-map/components/tooltips/RouteTooltipContent.vue";
import ControlButton from "../../app/features/flight-map/components/controls/ControlButton.vue";
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
      elevationFt: 67,
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
      flightNumber: "AR1300",
      airline: "Aerolíneas Argentinas",
      airlineIata: "AR",
      originIata: "EZE",
      originCity: "Buenos Aires",
      originCoordinates: [-58.5358, -34.8222],
      destinationIata: "MIA",
      destinationCity: "Miami",
      destinationCoordinates: [-80.2906, 25.7959],
      distanceKm: 7100,
      averageOtp15: 88.5,
      totalFlights: 320,
      delayMinutesAvg: 11,
      primaryAirline: "Aerolíneas Argentinas",
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
});

