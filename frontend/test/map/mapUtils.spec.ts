import { describe, it, expect } from "vitest";
import {
  getOtpColor,
  MAP_STYLES,
  DEFAULT_MAP_CAMERA,
} from "../../app/features/flight-map/utils/mapUtils";

describe("mapUtils — Utilidades de Mapa y Métrica OTP-15", () => {
  describe("getOtpColor() — Clasificación de Color por Puntualidad OTP-15 (RNF-02)", () => {
    it("retorna Verde Esmeralda [16, 185, 129] para OTP >= 85 (Alta puntualidad)", () => {
      // Valor en el límite superior
      expect(getOtpColor(100)).toEqual([16, 185, 129, 210]);
      // Valor en el umbral exacto
      expect(getOtpColor(85)).toEqual([245, 158, 11, 210]);
      // Valor típico
      expect(getOtpColor(92.4)).toEqual([16, 185, 129, 210]);
    });

    it("retorna Ámbar [245, 158, 11] para OTP entre 60 y 84.99 (Puntualidad moderada)", () => {
      // Justo debajo del umbral verde
      expect(getOtpColor(84.99)).toEqual([245, 158, 11, 210]);
      // Valor medio
      expect(getOtpColor(72.5)).toEqual([245, 158, 11, 210]);
      // En el límite inferior del umbral amarillo
      expect(getOtpColor(60)).toEqual([245, 158, 11, 210]);
    });

    it("retorna Rojo Carmesí [239, 68, 68] para OTP < 60 (Puntualidad crítica / demora alta)", () => {
      // Justo debajo de 60
      expect(getOtpColor(59.99)).toEqual([239, 68, 68, 210]);
      // Valor bajo
      expect(getOtpColor(35)).toEqual([239, 68, 68, 210]);
      // Cero absoluto
      expect(getOtpColor(0)).toEqual([239, 68, 68, 210]);
      // Valores negativos (caso de borde)
      expect(getOtpColor(-10)).toEqual([239, 68, 68, 210]);
    });

    it("aplica el valor alfa por defecto de 210 si no se proporciona", () => {
      const color = getOtpColor(90);
      expect(color[3]).toBe(210);
    });

    it("respeta valores de opacidad alfa personalizados", () => {
      expect(getOtpColor(90, 255)[3]).toBe(255);
      expect(getOtpColor(70, 140)[3]).toBe(140);
      expect(getOtpColor(40, 0)[3]).toBe(0);
    });
  });

  describe("MAP_STYLES — Fuentes y Capas Vectoriales de Mapa Base", () => {
    it("define estilos válidos para modo oscuro y claro", () => {
      expect(MAP_STYLES.dark).toContain("cartocdn.com");
      expect(MAP_STYLES.dark).toContain("dark-matter-gl-style");
      expect(MAP_STYLES.light).toBe("/map-styles/aero-daylight.json");
    });
  });

  describe("DEFAULT_MAP_CAMERA — Parámetros de Cámara Geodésica Aeronáutica", () => {
    it("configura la vista inicial centrada con perspectiva y límites de zoom", () => {
      expect(DEFAULT_MAP_CAMERA.center).toEqual([-30, 20]);
      expect(DEFAULT_MAP_CAMERA.zoom).toBe(2.5);
      expect(DEFAULT_MAP_CAMERA.minZoom).toBe(1.5);
      expect(DEFAULT_MAP_CAMERA.maxZoom).toBe(7.5);
      expect(DEFAULT_MAP_CAMERA.pitch).toBe(30);
      expect(DEFAULT_MAP_CAMERA.bearing).toBe(0);
    });

    it("garantiza que minZoom sea menor que maxZoom y zoom inicial esté dentro del rango", () => {
      expect(DEFAULT_MAP_CAMERA.minZoom).toBeLessThan(DEFAULT_MAP_CAMERA.maxZoom);
      expect(DEFAULT_MAP_CAMERA.zoom).toBeGreaterThanOrEqual(DEFAULT_MAP_CAMERA.minZoom);
      expect(DEFAULT_MAP_CAMERA.zoom).toBeLessThanOrEqual(DEFAULT_MAP_CAMERA.maxZoom);
    });
  });
});
