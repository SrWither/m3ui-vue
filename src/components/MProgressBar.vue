<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value?: number;
    indeterminate?: boolean;
    color?: "primary" | "secondary" | "tertiary" | "error";
    variant?: "linear" | "wavy";
    label?: string;
  }>(),
  {
    color: "primary",
    variant: "linear",
  },
);

const isIndeterminate = computed(() => props.indeterminate || props.value === undefined);
const clampedValue = computed(() => Math.min(100, Math.max(0, props.value ?? 0)));

const colorMap: Record<
  "primary" | "secondary" | "tertiary" | "error",
  { bar: string; track: string; text: string }
> = {
  primary: { bar: "bg-primary", track: "bg-primary-container", text: "text-primary" },
  secondary: { bar: "bg-secondary", track: "bg-secondary-container", text: "text-secondary" },
  tertiary: { bar: "bg-tertiary", track: "bg-tertiary-container", text: "text-tertiary" },
  error: { bar: "bg-error", track: "bg-error-container", text: "text-error" },
};

// ── Wave geometry ────────────────────────────────────────────────────────
// Smooth sine wave sampled as a single polyline path.
// Period = 20px (one full up-down cycle). We render a wide strip so that
// translating by exactly one period gives a seamless infinite scroll.
const PERIOD = 20; // px per full sine cycle
const AMP = 2.5; // amplitude (bar is 8px tall, mid at 4)
const MID = 4;
const VIEW_H = 8;
const PERIODS = 80; // total cycles → 1600px strip
const STEP = 1; // px sampling resolution

const waveWidth = PERIOD * PERIODS;

const wavePath = (() => {
  let d = "";
  for (let x = 0; x <= waveWidth; x += STEP) {
    const y = MID - AMP * Math.sin((x / PERIOD) * Math.PI * 2);
    d += (x === 0 ? "M" : "L") + x + "," + y.toFixed(2) + " ";
  }
  return d.trim();
})();
</script>

<template>
  <div class="flex flex-col gap-1">
    <span v-if="label" class="text-label-small text-on-surface-variant">{{ label }}</span>

    <!-- ── Linear variant ────────────────────────────────────────────────── -->
    <div
      v-if="variant === 'linear'"
      class="relative h-1 w-full overflow-hidden rounded-full"
      :class="colorMap[color].track"
      role="progressbar"
      :aria-valuenow="isIndeterminate ? undefined : clampedValue"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        v-if="!isIndeterminate"
        class="h-full rounded-full transition-[width] duration-300 ease-in-out"
        :class="colorMap[color].bar"
        :style="{ width: `${clampedValue}%` }"
      />
      <div
        v-else
        class="absolute inset-y-0 w-2/5 rounded-full animate-[m3-progress-indeterminate_1.6s_ease-in-out_infinite]"
        :class="colorMap[color].bar"
      />
    </div>

    <!-- ── Wavy variant ───────────────────────────────────────────────────── -->
    <div
      v-else
      class="relative h-2 w-full overflow-visible"
      role="progressbar"
      :aria-valuenow="isIndeterminate ? undefined : clampedValue"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <!-- DETERMINATE -->
      <template v-if="!isIndeterminate">
        <!-- Active (wavy) portion: clipped to value%, but the wave keeps flowing -->
        <div
          class="absolute inset-0 overflow-hidden"
          :style="{
            clipPath: `inset(0 ${100 - clampedValue}% 0 0)`,
            transition: 'clip-path 300ms ease',
          }"
        >
          <div
            class="absolute top-0 left-0 h-full animate-[m3-wave-flow_0.8s_linear_infinite]"
            :class="colorMap[color].text"
            :style="{ width: `${waveWidth}px` }"
          >
            <svg
              :width="waveWidth"
              :height="VIEW_H"
              :viewBox="`0 0 ${waveWidth} ${VIEW_H}`"
              class="h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                :d="wavePath"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </div>

        <!-- Inactive (straight track) portion -->
        <div
          class="absolute inset-y-0 right-0 flex items-center"
          :class="colorMap[color].track"
          :style="{ left: `calc(${clampedValue}% + 4px)`, transition: 'left 300ms ease' }"
          style="border-radius: 9999px; height: 4px; top: 50%; transform: translateY(-50%)"
        />

        <!-- Stop indicator (dot at the end of the track) -->
        <div
          class="absolute rounded-full"
          :class="colorMap[color].bar"
          :style="{
            right: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '4px',
            height: '4px',
          }"
        />
      </template>

      <!-- INDETERMINATE -->
      <div v-else class="absolute inset-0 overflow-hidden rounded-full">
        <div
          class="absolute top-0 left-0 h-full animate-[m3-wave-flow_0.9s_linear_infinite]"
          :class="colorMap[color].text"
          :style="{ width: `${waveWidth}px` }"
        >
          <svg
            :width="waveWidth"
            :height="VIEW_H"
            :viewBox="`0 0 ${waveWidth} ${VIEW_H}`"
            class="h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              :d="wavePath"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Scroll exactly one period (20px) so the loop is perfectly seamless. */
@keyframes m3-wave-flow {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-20px);
  }
}

@keyframes m3-progress-indeterminate {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-\[m3-wave-flow_1\.2s_linear_infinite\],
  .animate-\[m3-wave-flow_0\.9s_linear_infinite\],
  .animate-\[m3-progress-indeterminate_1\.6s_ease-in-out_infinite\] {
    animation: none !important;
  }
}
</style>
