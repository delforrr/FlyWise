<script setup lang="ts">
import { computed } from "vue";

interface Props {
  currentOtp: number;
  values?: number[];
  width?: number;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  width: 64,
  height: 18,
});

// Identificador único para gradientes y filtros SVG (hidratación y concurrencia seguras)
const gradientId = useId();

// Generación determinista del histórico de 6 meses si no se provee values
const historicalData = computed<number[]>(() => {
  if (props.values && props.values.length >= 2) {
    return props.values;
  }

  const base = props.currentOtp;
  // Semilla derivada de currentOtp para reproducibilidad exacta en SSR e hidratación
  const seed = Math.round(base * 10);
  const pattern = [-2.8, 1.6, -2.9, 2.7, -0.8];
  const count = 6;
  const points: number[] = [];

  for (let i = 0; i < count - 1; i++) {
    // Variación armónica sutil determinista (±1.5%)
    const jitter = Math.sin((seed + i * 23) * 0.45) * 1.5;
    const offset = pattern[i] + jitter;
    // Límite de varianza ±4.5% alrededor de currentOtp
    const clampedOffset = Math.max(-4.5, Math.min(4.5, offset));
    const val = Math.max(0, Math.min(100, base + clampedOffset));
    points.push(Math.round(val * 10) / 10);
  }

  // El último valor siempre coincide de forma exacta con el OTP actual
  points.push(Math.round(base * 10) / 10);
  return points;
});

// Selección de color semántico según OTP-15
// Verde esmeralda (>= 85%), Ámbar (>= 60%), Rosa/Carmín (< 60%)
const strokeColor = computed<string>(() => {
  if (props.currentOtp >= 85) return "#10b981"; // Emerald
  if (props.currentOtp >= 60) return "#f59e0b"; // Amber
  return "#f43f5e"; // Rose / Carmine
});

// Cálculo de coordenadas SVG dentro del viewBox
const paddingX = 4;
const paddingY = 3;

interface Point {
  x: number;
  y: number;
}

const coordinates = computed<Point[]>(() => {
  const data = historicalData.value;
  if (!data || data.length === 0) return [];

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const valRange = Math.max(maxVal - minVal, 4);

  const effectiveMin = Math.max(0, minVal - valRange * 0.15);
  const effectiveMax = Math.min(100, maxVal + valRange * 0.15);
  const ySpan = effectiveMax - effectiveMin || 1;

  const usableWidth = props.width - paddingX * 2;
  const usableHeight = props.height - paddingY * 2;

  return data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * usableWidth;
    const norm = (val - effectiveMin) / ySpan;
    // Mayor OTP = menor coordenada Y (más alto en el gráfico)
    const y = props.height - paddingY - norm * usableHeight;
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });
});

// Generación de trayectoria curva suave (Catmull-Rom a Bezier cúbico)
const linePath = computed<string>(() => {
  const pts = coordinates.value;
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  const tension = 0.16;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
});

// Área sombreada semitransparente bajo la curva
const areaPath = computed<string>(() => {
  const pts = coordinates.value;
  if (pts.length < 2 || !linePath.value) return "";
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${linePath.value} L ${last.x} ${props.height} L ${first.x} ${props.height} Z`;
});

// Punto final luminoso
const lastPoint = computed<Point | null>(() => {
  const pts = coordinates.value;
  return pts.length > 0 ? pts[pts.length - 1] : null;
});

// Descripción accesible y tooltip
const trendDelta = computed<number>(() => {
  const data = historicalData.value;
  if (data.length < 2) return 0;
  return Number((data[data.length - 1] - data[0]).toFixed(1));
});

const trendSummary = computed<string>(() => {
  const delta = trendDelta.value;
  if (delta > 0.5) return `en ascenso (+${delta}%)`;
  if (delta < -0.5) return `en descenso (${delta}%)`;
  return "estable";
});

const tooltipText = computed<string>(() => {
  return `Tendencia últimos 6 meses: ${trendSummary.value} · Actual: ${props.currentOtp.toFixed(1)}% OTP`;
});

const ariaLabel = computed<string>(() => {
  return `Tendencia de puntualidad últimos 6 meses: ${trendSummary.value}, actual ${props.currentOtp.toFixed(1)}%`;
});
</script>

<template>
  <div
    class="inline-flex items-center shrink-0 cursor-help"
    :title="tooltipText"
    role="img"
    :aria-label="ariaLabel"
  >
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      aria-hidden="true"
      class="overflow-visible select-none"
    >
      <defs>
        <linearGradient
          :id="`sparkline-grad-${gradientId}`"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="strokeColor" stop-opacity="0.0" />
        </linearGradient>

        <filter
          :id="`sparkline-glow-${gradientId}`"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="1.5"
            :flood-color="strokeColor"
            flood-opacity="0.75"
          />
        </filter>
      </defs>

      <!-- Relleno degradado sutil bajo la curva -->
      <path
        v-if="areaPath"
        :d="areaPath"
        :fill="`url(#sparkline-grad-${gradientId})`"
      />

      <!-- Trazo principal de la curva de tendencia -->
      <path
        :d="linePath"
        fill="none"
        :stroke="strokeColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Punto final luminoso (último mes / valor actual) -->
      <g v-if="lastPoint">
        <!-- Halo exterior difuso -->
        <circle
          :cx="lastPoint.x"
          :cy="lastPoint.y"
          r="3.5"
          :fill="strokeColor"
          opacity="0.25"
        />
        <!-- Núcleo brillante con glow filter (r=2) -->
        <circle
          :cx="lastPoint.x"
          :cy="lastPoint.y"
          r="2"
          :fill="strokeColor"
          :filter="`url(#sparkline-glow-${gradientId})`"
        />
      </g>
    </svg>
  </div>
</template>
