import {
  ref,
  watch,
  onMounted,
  onUnmounted,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export interface UseAnimatedNumberOptions {
  /**
   * Animation duration in milliseconds. Defaults to 750ms (~600-800ms range).
   */
  duration?: number | MaybeRefOrGetter<number>;

  /**
   * Easing function mapping progress [0, 1] to eased value [0, 1]. Defaults to easeOutExpo.
   */
  easing?: (t: number) => number;

  /**
   * Whether to animate from `from` value on initial component mount. Defaults to true.
   */
  animateOnMount?: boolean;

  /**
   * Initial number to animate from on mount. Defaults to 0.
   */
  from?: number;
}

/**
 * Exponential ease-out curve: rapid initial rise with a smooth, luxury deceleration.
 */
export function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * Cubic ease-out curve: classic smooth deceleration.
 */
export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Checks whether client prefers reduced motion.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Composable that animates a reactive number from start to target value using requestAnimationFrame.
 *
 * - Smooth deceleration via easeOutExpo or custom easing.
 * - Configurable duration (~600-800ms).
 * - Respects prefers-reduced-motion (instant updates when reduced motion is preferred).
 * - Gracefully handles mid-animation value switches without layout jumps.
 * - Cleans up active animation frames on unmount.
 * - SSR-safe.
 */
export function useAnimatedNumber(
  target: MaybeRefOrGetter<number>,
  options: UseAnimatedNumberOptions = {}
): Ref<number> {
  const {
    duration = 750,
    easing = easeOutExpo,
    animateOnMount = true,
    from = 0,
  } = options;

  const getSafeTarget = (): number => {
    const raw = toValue(target);
    return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  };

  // SSR and initial render safety: match target initially
  const displayValue = ref<number>(getSafeTarget());

  let rafId: number | null = null;

  function cancelAnimation() {
    if (rafId !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
      }
      rafId = null;
    }
  }

  function animateTo(targetVal: number, fromVal?: number) {
    if (typeof window === "undefined" || prefersReducedMotion()) {
      cancelAnimation();
      displayValue.value = targetVal;
      return;
    }

    const dur = Math.max(0, toValue(duration));
    if (dur <= 0) {
      cancelAnimation();
      displayValue.value = targetVal;
      return;
    }

    const startVal = fromVal !== undefined ? fromVal : displayValue.value;
    if (startVal === targetVal) {
      cancelAnimation();
      displayValue.value = targetVal;
      return;
    }

    cancelAnimation();
    displayValue.value = startVal;

    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / dur, 1);
      const easedProgress = easing(progress);

      displayValue.value = startVal + (targetVal - startVal) * easedProgress;

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        displayValue.value = targetVal;
        rafId = null;
      }
    }

    rafId = requestAnimationFrame(step);
  }

  onMounted(() => {
    const targetVal = getSafeTarget();
    if (animateOnMount) {
      if (from !== targetVal) {
        animateTo(targetVal, from);
      } else {
        displayValue.value = targetVal;
      }
    } else {
      displayValue.value = targetVal;
    }
  });

  watch(
    () => getSafeTarget(),
    (newVal) => {
      animateTo(newVal);
    }
  );

  onUnmounted(() => {
    cancelAnimation();
  });

  return displayValue;
}
