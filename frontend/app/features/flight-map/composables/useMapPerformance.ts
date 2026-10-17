import { ref, computed } from "vue";

// Estado reactivo singleton a nivel módulo
const isMobileOrTouch = ref<boolean>(false);
const isLowEnd = ref<boolean>(false);
const isInitialized = ref<boolean>(false);

/**
 * Detecta si el hardware del cliente es de gama baja o tiene recursos restringidos
 * mediante concurrencia de CPU, memoria de dispositivo y renderer de GPU WebGL.
 */
export function detectLowEndHardware(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // 1. Núcleos de CPU <= 4 generalmente caracterizan a equipos modestos o móviles de entrada
  const concurrency = navigator.hardwareConcurrency;
  if (concurrency && concurrency <= 4) {
    return true;
  }

  // 2. Memoria RAM <= 4GB (DeviceMemory API en navegadores modernos)
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (memory && memory <= 4) {
    return true;
  }

  // 3. Inspección del renderer WebGL para detectar GPUs integradas / de bajo consumo
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = (
          gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string | null
        )?.toLowerCase() || "";
        if (
          renderer.includes("mali") ||
          renderer.includes("adreno 5") ||
          renderer.includes("adreno 61") ||
          renderer.includes("intel hd") ||
          renderer.includes("intel(r) hd") ||
          renderer.includes("swiftshader") ||
          renderer.includes("llvmpipe") ||
          renderer.includes("powervr")
        ) {
          return true;
        }
      }
    }
  } catch {
    // Si la consulta WebGL falla por restricciones de seguridad o permisos, continuar silenciosamente
  }

  return false;
}

/**
 * Detecta si el dispositivo es primariamente móvil o táctil (smartphone / tablet pequeña)
 */
export function detectMobileOrTouch(): boolean {
  if (typeof window === "undefined") return false;

  const isSmallScreen = window.innerWidth < 768;
  const hasTouchPoints =
    typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
  const isCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  return isSmallScreen || (hasTouchPoints && isCoarsePointer);
}

/**
 * Composable para la adaptación automática y transparente del rendimiento del mapa.
 */
export const useMapPerformance = () => {
  // Inicialización pasiva en el cliente una sola vez
  if (typeof window !== "undefined" && !isInitialized.value) {
    isMobileOrTouch.value = detectMobileOrTouch();
    isLowEnd.value = detectLowEndHardware();
    isInitialized.value = true;

    // Escuchar redimensionamiento de ventana para sincronizar cambios de viewport
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener(
      "resize",
      () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          isMobileOrTouch.value = detectMobileOrTouch();
        }, 150);
      },
      { passive: true },
    );
  }

  // Reglas de optimización computadas
  const allow3D = computed<boolean>(() => !isMobileOrTouch.value);
  const enableHoverPicking = computed<boolean>(() => !isMobileOrTouch.value);
  const enableTooltips = computed<boolean>(() => !isMobileOrTouch.value);
  const enableRadarRings = computed<boolean>(
    () => !isMobileOrTouch.value && !isLowEnd.value,
  );
  const enableLODLabels = computed<boolean>(
    () => isMobileOrTouch.value || isLowEnd.value,
  );

  const dpr = computed<number>(() => {
    if (typeof window === "undefined") return 1;
    const nativeDpr = window.devicePixelRatio || 1;
    if (isMobileOrTouch.value || isLowEnd.value) {
      // Clamping estricto en móvil / low-end para evitar saturar el GPU fill-rate
      return Math.min(nativeDpr, 1.25);
    }
    // Límite en desktop estándar para pantallas retina de alta resolución
    return Math.min(nativeDpr, 2.0);
  });

  const maxTileCache = computed<number>(() => {
    return isMobileOrTouch.value || isLowEnd.value ? 40 : 100;
  });

  /**
   * Permite sobreescribir el estado para testing o simulaciones de entorno.
   */
  function setPerformanceOverride(overrides: {
    isMobileOrTouch?: boolean;
    isLowEnd?: boolean;
  }): void {
    if (overrides.isMobileOrTouch !== undefined) {
      isMobileOrTouch.value = overrides.isMobileOrTouch;
    }
    if (overrides.isLowEnd !== undefined) {
      isLowEnd.value = overrides.isLowEnd;
    }
    isInitialized.value = true;
  }

  function resetPerformanceState(): void {
    isInitialized.value = false;
    if (typeof window !== "undefined") {
      isMobileOrTouch.value = detectMobileOrTouch();
      isLowEnd.value = detectLowEndHardware();
      isInitialized.value = true;
    } else {
      isMobileOrTouch.value = false;
      isLowEnd.value = false;
    }
  }

  return {
    isMobileOrTouch,
    isLowEnd,
    allow3D,
    enableHoverPicking,
    enableTooltips,
    enableRadarRings,
    enableLODLabels,
    dpr,
    maxTileCache,
    setPerformanceOverride,
    resetPerformanceState,
  };
};

export default useMapPerformance;
