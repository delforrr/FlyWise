import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import {
  useAnimatedNumber,
  easeOutExpo,
  easeOutCubic,
} from '../../app/shared/composables/useAnimatedNumber';

describe('useAnimatedNumber — Composable de Interpolación Numérica y HUD Counters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Curvas de Easing Matemáticas', () => {
    it('easeOutExpo mapea 0 a 0 y 1 a 1 con desaceleración exponencial', () => {
      expect(easeOutExpo(0)).toBe(0);
      expect(easeOutExpo(1)).toBe(1);
      expect(easeOutExpo(0.5)).toBeCloseTo(1 - Math.pow(2, -5), 5);
      expect(easeOutExpo(0.2)).toBeGreaterThan(0.2);
    });

    it('easeOutCubic mapea 0 a 0 y 1 a 1 con curva cúbica suave', () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
      expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 4);
      expect(easeOutCubic(0.2)).toBeGreaterThan(0.2);
    });
  });

  describe('Comportamiento Reactivo y Sanitización de Entradas', () => {
    it('inicializa con el valor objetivo numérico provisto', () => {
      const display = useAnimatedNumber(85.4);
      expect(display.value).toBe(85.4);
    });

    it('acepta una referencia reactiva (Ref<number>) como target', () => {
      const targetRef = ref(100);
      const display = useAnimatedNumber(targetRef);
      expect(display.value).toBe(100);
    });

    it('sanea valores no finitos (NaN, Infinity, undefined) resolviéndolos a 0', () => {
      const displayNaN = useAnimatedNumber(NaN as any);
      expect(displayNaN.value).toBe(0);

      const displayInf = useAnimatedNumber(Infinity as any);
      expect(displayInf.value).toBe(0);

      const displayNull = useAnimatedNumber(null as any);
      expect(displayNull.value).toBe(0);
    });

    it('actualiza el valor inmediatamente cuando la duración configurada es 0 o negativa', async () => {
      const target = ref(10);
      const display = useAnimatedNumber(target, { duration: 0 });

      expect(display.value).toBe(10);

      target.value = 50;
      await nextTick();

      expect(display.value).toBe(50);
    });

    it('actualiza inmediatamente cuando el valor objetivo coincide con el actual', async () => {
      const target = ref(42);
      const display = useAnimatedNumber(target);

      expect(display.value).toBe(42);
      target.value = 42;
      await nextTick();

      expect(display.value).toBe(42);
    });
  });

  describe('Accesibilidad y Preferencias del Sistema (prefers-reduced-motion)', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('omite la animación y actualiza instantáneamente si el usuario prefiere movimiento reducido', async () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const target = ref(20);
      const display = useAnimatedNumber(target, { duration: 800 });

      target.value = 150;
      await nextTick();

      expect(display.value).toBe(150);
    });
  });
});
