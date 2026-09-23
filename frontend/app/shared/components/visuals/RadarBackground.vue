<script setup lang="ts">
interface Props {
  showSweep?: boolean;
  showWaypoints?: boolean;
  showGrid?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showSweep: true,
  showWaypoints: true,
  showGrid: true,
  class: "",
});

const waypoints = [
  { id: "WPT-01", label: "EZE / FIX", cx: 280, cy: 220, delay: "0s", duration: "3.2s" },
  { id: "WPT-02", label: "FL360", cx: 540, cy: 260, delay: "1.1s", duration: "2.8s" },
  { id: "WPT-03", label: "COR / VOR", cx: 330, cy: 520, delay: "2.3s", duration: "3.6s" },
  { id: "WPT-04", label: "MDZ / APP", cx: 580, cy: 490, delay: "0.7s", duration: "3.0s" },
  { id: "WPT-05", label: "BUE / CTR", cx: 400, cy: 370, delay: "1.8s", duration: "2.5s" },
];
</script>

<template>
  <div
    :class="[
      'radar-background-container relative w-full h-full pointer-events-none select-none overflow-visible flex items-center justify-center',
      props.class,
    ]"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid meet"
      class="radar-svg w-full h-full object-contain opacity-75 dark:opacity-85 transition-opacity duration-500 pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="radarSweepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.25" />
          <stop offset="35%" stop-color="var(--color-primary)" stop-opacity="0.10" />
          <stop offset="70%" stop-color="var(--color-secondary)" stop-opacity="0.03" />
          <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0" />
        </linearGradient>

        <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g transform="translate(400, 400)">
        <circle r="70" class="radar-ring" />
        <circle r="140" class="radar-ring" />
        <circle r="210" class="radar-ring" />
        <circle r="280" class="radar-ring" />
        <circle r="350" class="radar-ring radar-ring--outer" />

        <template v-if="showGrid">
          <line x1="0" y1="-370" x2="0" y2="370" class="radar-axis" />
          <line x1="-370" y1="0" x2="370" y2="0" class="radar-axis" />
          <line x1="-260" y1="-260" x2="260" y2="260" class="radar-axis-diagonal" />
          <line x1="-260" y1="260" x2="260" y2="-260" class="radar-axis-diagonal" />

          <g class="radar-ticks opacity-60 dark:opacity-45">
            <line x1="0" y1="-350" x2="0" y2="-360" class="radar-tick" />
            <line x1="350" y1="0" x2="360" y2="0" class="radar-tick" />
            <line x1="0" y1="350" x2="0" y2="360" class="radar-tick" />
            <line x1="-350" y1="0" x2="-360" y2="0" class="radar-tick" />
          </g>

          <text x="0" y="-355" class="radar-label" text-anchor="middle">360° N</text>
          <text x="360" y="4" class="radar-label" text-anchor="start">090° E</text>
          <text x="0" y="365" class="radar-label" text-anchor="middle">180° S</text>
          <text x="-360" y="4" class="radar-label" text-anchor="end">270° W</text>
        </template>

        <g v-if="showSweep" class="radar-sweep-group">
          <path
            d="M 0 0 L 0 -350 A 350 350 0 0 1 247 -247 Z"
            fill="url(#radarSweepGradient)"
            class="radar-sweep-fan"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-350"
            class="radar-sweep-line"
            filter="url(#radarGlow)"
          />
        </g>
      </g>

      <g v-if="showWaypoints" class="radar-waypoints-layer">
        <g
          v-for="wpt in waypoints"
          :key="wpt.id"
          :transform="`translate(${wpt.cx}, ${wpt.cy})`"
          class="radar-waypoint"
        >
          <circle
            r="10"
            class="radar-waypoint-ping"
            :style="{ animationDelay: wpt.delay, animationDuration: wpt.duration }"
          />
          <circle
            r="2.5"
            class="radar-waypoint-dot"
            :style="{ animationDelay: wpt.delay, animationDuration: wpt.duration }"
          />
          <path d="M -5 0 L 5 0 M 0 -5 L 0 5" class="radar-waypoint-cross" />
          <text x="8" y="3" class="radar-waypoint-text font-mono">
            {{ wpt.label }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.radar-background-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.radar-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--color-primary) 65%, var(--color-border-subtle));
  stroke-width: 1px;
  stroke-dasharray: 4 4;
  transition: stroke 0.3s ease;
}

.dark .radar-ring {
  stroke: color-mix(in srgb, var(--color-primary) 40%, transparent);
  stroke-width: 1px;
}

.radar-ring--outer {
  stroke-dasharray: none;
  stroke-width: 1.5px;
  stroke: var(--color-primary);
  stroke-opacity: 0.45;
}

.dark .radar-ring--outer {
  stroke: color-mix(in srgb, var(--color-primary) 65%, transparent);
  stroke-width: 1.5px;
  stroke-opacity: 0.45;
}

.radar-axis {
  stroke: color-mix(in srgb, var(--color-primary) 60%, var(--color-border-subtle));
  stroke-width: 0.85px;
  stroke-dasharray: 2 4;
}

.dark .radar-axis {
  stroke: color-mix(in srgb, var(--color-primary) 45%, transparent);
  stroke-width: 0.85px;
}

.radar-axis-diagonal {
  stroke: color-mix(in srgb, var(--color-primary) 40%, var(--color-border-subtle));
  stroke-width: 0.75px;
  stroke-dasharray: 2 6;
}

.dark .radar-axis-diagonal {
  stroke: color-mix(in srgb, var(--color-primary) 25%, transparent);
  stroke-width: 0.75px;
}

.radar-tick {
  stroke: var(--color-primary);
  stroke-width: 1.25px;
  opacity: 0.7;
}

.radar-label {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 800;
  fill: var(--color-text-main);
  letter-spacing: 0.12em;
  opacity: 0.65;
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.95);
}

.dark .radar-label {
  fill: var(--color-text-muted);
  opacity: 0.65;
  text-shadow: 0 0 8px color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.radar-sweep-group {
  transform-origin: 0 0;
  animation: radar-sweep-spin 8s linear infinite;
  will-change: transform;
}

@keyframes radar-sweep-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.radar-sweep-line {
  stroke: var(--color-primary);
  stroke-width: 1.5px;
  opacity: 0.85;
  filter: drop-shadow(0 0 3px var(--color-primary));
}

.radar-waypoint-dot {
  fill: var(--color-primary);
  filter: drop-shadow(0 0 3px var(--color-primary));
  animation: radar-dot-pulse 3s ease-in-out infinite;
}

.radar-waypoint-cross {
  stroke: var(--color-primary);
  stroke-width: 0.75px;
  opacity: 0.6;
}

.radar-waypoint-ping {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1px;
  transform-origin: center;
  animation: radar-ping-wave 3s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.radar-waypoint-text {
  font-size: 8px;
  font-weight: 700;
  fill: var(--color-text-main);
  letter-spacing: 0.06em;
  opacity: 0.75;
}

.dark .radar-waypoint-text {
  fill: var(--color-text-main);
  opacity: 0.85;
  text-shadow: 0 0 6px color-mix(in srgb, var(--color-primary) 50%, transparent);
}

@keyframes radar-ping-wave {
  0% { r: 2px; opacity: 0.85; }
  70% { r: 16px; opacity: 0; }
  100% { r: 16px; opacity: 0; }
}

@keyframes radar-dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 0.9; transform: scale(1.15); }
}
</style>
