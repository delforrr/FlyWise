import { useFlightMap } from "./useFlightMap";
import { useFlightSelection } from "~/features/route-audit/composables/useFlightSelection";

/**
 * Composable useCockpitShortcuts
 *
 * Administra los atajos de teclado aeronáuticos para el cockpit del mapa de vuelos
 * utilizando el composable nativo defineShortcuts de Nuxt UI (@nuxt/ui):
 * - Escape: Cierra modales si están abiertos, o deselecciona rutas/aeropuertos activos.
 * - f: Reencuadra (Fit) la cámara en la ruta o hub seleccionado.
 * - m: Alterna perspectiva 3D (36°) y 2D (0°).
 * - n: Resetea la orientación de la cámara al Norte (bearing 0°).
 * - + / =: Zoom in en el mapa.
 * - -: Zoom out en el mapa.
 *
 * Nota: Los atajos meta_k y '?' son administrados directamente por sus respectivos
 * componentes (CommandPalette.vue y ShortcutsModal.vue) para evitar
 * listeners duplicados que abren y cierran el diálogo en el mismo tick.
 */
export function useShortcuts() {
  const { toggle3D, resetNorth, zoomIn, zoomOut } = useFlightMap();
  const { triggerFit, clearSelection } = useFlightSelection();
  const shortcutsModal = useState<boolean>("cockpit_shortcuts_modal", () => false);
  const commandPalette = useState<boolean>("cockpit_command_palette_open", () => false);
  const globalFilter = useState<boolean>('global_map_modal', () => false);

  function toggleCommandPalette(): void {
    commandPalette.value = !commandPalette.value;
  }

  function toggleShortcutsModal(): void {
    shortcutsModal.value = !shortcutsModal.value;
  }

  function handleEscape(event?: KeyboardEvent): void {
    // El diálogo gestiona Escape; no borrar la selección al cerrarlo o cerrar su selector.
    if (globalFilter.value || (event?.target instanceof Element && event.target.closest('[role="dialog"]'))) return;
    if (commandPalette.value) {
      commandPalette.value = false;
      return;
    }
    if (shortcutsModal.value) {
      shortcutsModal.value = false;
      return;
    }
    clearSelection();
  }

  defineShortcuts(computed(() => globalFilter.value ? {} : {
    escape: {
      usingInput: true,
      handler: (event: KeyboardEvent) => handleEscape(event),
    },
    f: () => triggerFit(),
    m: () => toggle3D(),
    n: () => resetNorth(),
    '+': () => zoomIn(),
    '=': () => zoomIn(),
    '-': () => zoomOut(),
  }));

  return {
    shortcutsModal,
    commandPalette,
    toggleCommandPalette,
    toggleShortcutsModal,
  };
}

export const useCockpitShortcuts = useShortcuts;
export default useShortcuts;
