<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    size?: number;
    wavy?: boolean;
  }>(),
  { size: 20, wavy: false },
);

const STROKE = 3;
const BUMPS = 9;

// amp fraction of r = 0.25 → max radius = r * 1.25
// Constrain so that max_r + STROKE/2 ≤ size/2 - 1 (1px margin from edge)
const r = computed(() => (props.size / 2 - 1 - STROKE / 2) / 1.25);
const cx = computed(() => props.size / 2);

// Build the full bumpy-circle path and its total length.
const wavyData = computed(() => {
  const CX = cx.value;
  const R = r.value;
  const amp = R * 0.08;
  const segs = BUMPS * 24; // smooth curve

  const pts: string[] = [];
  let len = 0;
  let px = 0,
    py = 0;

  for (let i = 0; i <= segs; i++) {
    const theta = (2 * Math.PI * i) / segs - Math.PI / 2;
    const rr = R + amp * Math.sin(BUMPS * theta);
    const x = CX + rr * Math.cos(theta);
    const y = CX + rr * Math.sin(theta);
    if (i > 0) len += Math.sqrt((x - px) ** 2 + (y - py) ** 2);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
    px = x;
    py = y;
  }

  // Visible arc ~58% of the circumference, gap fills the rest.
  const visible = len * 0.58;
  const gap = len - visible;
  const dash = `${visible.toFixed(1)} ${gap.toFixed(1)}`;

  // The wave "travels" by shifting dashoffset over exactly one full length,
  // so the crests slide around the path independently of the rotation.
  return { path: pts.join("") + "Z", dash, len: len.toFixed(1) };
});
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="status"
    aria-label="Cargando"
  >
    <!-- Standard circular spinner -->
    <span
      v-if="!wavy"
      class="block h-full w-full animate-spin rounded-full border-2 border-current border-t-transparent"
    />

    <!-- Wavy spinner (M3 Expressive): the whole shape rotates AND the wave
         travels along the stroke via dashoffset, giving the snake-like flow. -->
    <svg
      v-else
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      fill="none"
      class="animate-[m3-wavy-spin_2.8s_linear_infinite]"
      :style="`transform-origin: ${cx}px ${cx}px`"
    >
      <path
        :d="wavyData.path"
        stroke="currentColor"
        :stroke-width="STROKE"
        stroke-linecap="round"
        :stroke-dasharray="wavyData.dash"
        class="animate-[m3-wavy-travel_2s_linear_infinite]"
        :style="{ '--m3-wave-len': wavyData.len }"
      />
    </svg>
  </span>
</template>

<style>
/* The SVG element rotates the whole bumpy circle. */
@keyframes m3-wavy-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* The stroke's dashoffset slides by one full path length, so the crests
   appear to crawl along the circle — the "snake" motion of M3 Expressive.
   Negative direction makes the wave travel forward relative to the spin. */
@keyframes m3-wavy-travel {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: calc(var(--m3-wave-len) * -1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-\[m3-wavy-spin_2\.8s_linear_infinite\] {
    animation: m3-wavy-spin 2.8s linear infinite;
  }
  .animate-\[m3-wavy-travel_2s_linear_infinite\] {
    animation: none !important;
  }
}
</style>
