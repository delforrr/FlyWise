import { onMounted, onUnmounted } from "vue";
import { useFlightMap } from "./useFlightMap";
import { useFlightSelection } from "~/features/route-audit/composables/useFlightSelection";

/**
 * Composable useCockpitShortcuts
 *
 * Administra los atajos de teclado aeronáuticos para el cockpit del mapa de vuelos:
 * - '3': Alterna perspectiva 3D (36°) y 2D (0°).
 * - 'n' / 'N': Resetea la orientación de la cámara al Norte (bearing 0°).
 * - 'f' / 'F': Reencuadra (Fit) la cámara en la ruta o hub seleccionado.
 * - 'Escape': Deselecciona la ruta y aeropuertos activos.
 * - '?' (o Shift + '/'): Abre la guía de atajos del cockpit.
 *
 * Incluye guardrail de protección de contexto para no interceptar teclas mientras
 * el usuario escribe en inputs, textareas, selectores o comboboxes.
 */
export function useCockpitShortcuts() {
  const { toggle3D, resetNorth } = useFlightMap();
  const { triggerFit, clearSelection } = useFlightSelection();
  const shortcutsModal = useState<boolean>("cockpit_shortcuts_modal", () => false);

  function handleKeyDown(e: KeyboardEvent): void {
    // 0. Limitar atajos de cabina exclusivamente a pantallas de escritorio (>= 768px)
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return;
    }

    // 1. Evitar interceptar atajos nativos del sistema o del navegador (Ctrl+F, Cmd+N, Alt+...)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // 2. Guardrail de protección de contexto: si el foco está en un campo de texto interactivo, ignorar
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        Boolean(target.closest('[role="combobox"]')) ||
        Boolean(target.closest("input")) ||
        Boolean(target.closest("select")) ||
        Boolean(target.closest("textarea")))
    ) {
      return;
    }

    // 3. '3': Alternar perspectiva 3D / 2D
    if (e.key === "3") {
      e.preventDefault();
      toggle3D();
      return;
    }

    // 4. 'n' o 'N': Orientar al Norte magnético
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      resetNorth();
      return;
    }

    // 5. 'f' o 'F': Fit / Reencuadrar cámara en ruta o hub activo
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      triggerFit();
      return;
    }

    // 6. 'Escape': Deseleccionar y restablecer vista
    if (e.key === "Escape") {
      e.preventDefault();
      clearSelection();
      return;
    }

    // 7. '?' o Shift + '/': Abrir modal de ayuda de atajos
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      shortcutsModal.value = true;
      return;
    }
  }

  onMounted(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }
  });

  onUnmounted(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeyDown);
    }
  });

  return {
    shortcutsModal,
  };
}

export default useCockpitShortcuts;
