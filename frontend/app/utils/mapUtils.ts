export type RGBAColor = [number, number, number, number];

export const MAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

export const DEFAULT_MAP_CAMERA = {
  center: [-30, 20] as [number, number],
  zoom: 2.5,
  pitch: 30,
  bearing: 0,
} as const;

/**
 * Retorna el color RGBA correspondiente según la métrica OTP-15 estándar:
 * - >= 85%: Verde Esmeralda (Alta puntualidad)
 * - >= 60%: Ámbar / Amarillo (Puntualidad media)
 * - < 60%: Rojo Carmesí (Puntualidad crítica / altas demoras)
 */
export function getOtpColor(otp15: number, alpha: number = 210): RGBAColor {
  if (otp15 >= 85) return [16, 185, 129, alpha]; // 🟢 OTP-Good (Emerald)
  if (otp15 >= 60) return [245, 158, 11, alpha]; // 🟡 OTP-Warning (Amber)
  return [239, 68, 68, alpha]; // 🔴 OTP-Critical (Crimson)
}
