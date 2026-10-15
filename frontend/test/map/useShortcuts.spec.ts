import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de useFlightMap y useFlightSelection
const mockToggle3D = vi.fn();
const mockResetNorth = vi.fn();
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockTriggerFit = vi.fn();
const mockClearSelection = vi.fn();

vi.mock("~/features/flight-map/composables/useFlightMap", () => ({
  useFlightMap: () => ({
    toggle3D: mockToggle3D,
    resetNorth: mockResetNorth,
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
  }),
}));

vi.mock("~/features/route-audit/composables/useFlightSelection", () => ({
  useFlightSelection: () => ({
    triggerFit: mockTriggerFit,
    clearSelection: mockClearSelection,
  }),
}));

import { useShortcuts } from "../../app/features/flight-map/composables/useShortcuts";

describe("useShortcuts — Composable de Atajos de Teclado Aeronáuticos del Cockpit", () => {
  let registeredShortcuts: Record<string, any> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__clearStateStore?.();
    registeredShortcuts = {};

    (globalThis as any).defineShortcuts = vi.fn((shortcutsObj: Record<string, any>) => {
      registeredShortcuts = shortcutsObj;
    });
  });

  it("registra todos los atajos de teclado requeridos en el cockpit HUD", () => {
    useShortcuts();

    expect((globalThis as any).defineShortcuts).toHaveBeenCalledTimes(1);
    expect(registeredShortcuts).toHaveProperty("escape");
    expect(registeredShortcuts).toHaveProperty("f");
    expect(registeredShortcuts).toHaveProperty("m");
    expect(registeredShortcuts).toHaveProperty("n");
    expect(registeredShortcuts).toHaveProperty("+");
    expect(registeredShortcuts).toHaveProperty("=");
    expect(registeredShortcuts).toHaveProperty("-");
  });

  describe("Atajo 'escape' — Cierre jerárquico y deselección", () => {
    it("cierra la paleta de comandos si está abierta sin deseleccionar", () => {
      const { commandPalette } = useShortcuts();
      commandPalette.value = true;

      registeredShortcuts.escape.handler();

      expect(commandPalette.value).toBe(false);
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("cierra el modal de atajos si está abierto sin deseleccionar", () => {
      const { shortcutsModal } = useShortcuts();
      shortcutsModal.value = true;

      registeredShortcuts.escape.handler();

      expect(shortcutsModal.value).toBe(false);
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("ejecuta clearSelection() cuando ningún modal está activo", () => {
      const { commandPalette, shortcutsModal } = useShortcuts();
      commandPalette.value = false;
      shortcutsModal.value = false;

      registeredShortcuts.escape.handler();

      expect(mockClearSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe("Atajos de Navegación y Cámara 3D / 2D", () => {
    it("atajo 'f' dispara triggerFit() para encuadrar la ruta seleccionada", () => {
      useShortcuts();
      registeredShortcuts.f();
      expect(mockTriggerFit).toHaveBeenCalledTimes(1);
    });

    it("atajo 'm' alterna la perspectiva 3D (toggle3D)", () => {
      useShortcuts();
      registeredShortcuts.m();
      expect(mockToggle3D).toHaveBeenCalledTimes(1);
    });

    it("atajo 'n' restablece la brújula al norte magnético (resetNorth)", () => {
      useShortcuts();
      registeredShortcuts.n();
      expect(mockResetNorth).toHaveBeenCalledTimes(1);
    });

    it("atajos '+' y '=' aumentan el nivel de zoom (zoomIn)", () => {
      useShortcuts();
      registeredShortcuts["+"]();
      expect(mockZoomIn).toHaveBeenCalledTimes(1);

      registeredShortcuts["="]();
      expect(mockZoomIn).toHaveBeenCalledTimes(2);
    });

    it("atajo '-' reduce el nivel de zoom (zoomOut)", () => {
      useShortcuts();
      registeredShortcuts["-"]();
      expect(mockZoomOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("Funciones de apertura/cierre de diálogos", () => {
    it("toggleCommandPalette() conmuta reactivamente el estado de la paleta", () => {
      const { commandPalette, toggleCommandPalette } = useShortcuts();
      expect(commandPalette.value).toBe(false);

      toggleCommandPalette();
      expect(commandPalette.value).toBe(true);

      toggleCommandPalette();
      expect(commandPalette.value).toBe(false);
    });

    it("toggleShortcutsModal() conmuta reactivamente el estado del modal", () => {
      const { shortcutsModal, toggleShortcutsModal } = useShortcuts();
      expect(shortcutsModal.value).toBe(false);

      toggleShortcutsModal();
      expect(shortcutsModal.value).toBe(true);

      toggleShortcutsModal();
      expect(shortcutsModal.value).toBe(false);
    });
  });
});
