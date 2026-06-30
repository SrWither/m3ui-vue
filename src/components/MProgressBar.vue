<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";

const props = withDefaults(
  defineProps<{
    value?: number;
    indeterminate?: boolean;
    color?: "primary" | "secondary" | "tertiary" | "error";
    variant?: "linear" | "wavy";
    label?: string;
    thickness?: number;
  }>(),
  { color: "primary", variant: "linear" },
);

const isIndeterminate = computed(() => props.indeterminate || props.value === undefined);
const clampedValue    = computed(() => Math.min(100, Math.max(0, props.value ?? 0)));

const colorMap: Record<
  "primary" | "secondary" | "tertiary" | "error",
  { bar: string; track: string; text: string }
> = {
  primary:   { bar: "bg-primary",   track: "bg-primary-container",   text: "text-primary"   },
  secondary: { bar: "bg-secondary", track: "bg-secondary-container", text: "text-secondary" },
  tertiary:  { bar: "bg-tertiary",  track: "bg-tertiary-container",  text: "text-tertiary"  },
  error:     { bar: "bg-error",     track: "bg-error-container",     text: "text-error"     },
};

// ── Wave geometry ─────────────────────────────────────────────────────────
const PERIOD     = 20;
const AMP        = 2.5;
const PERIODS    = 80;
const STEP       = 2;
const MARGIN_PX  = 4;   // gap between wave right-end and track start
const WAVE_START = 10;  // threshold % below which wave collapses to line

// thickness-derived (computed so they react to prop changes)
const effectiveThickness = computed(() =>
  props.thickness ?? (props.variant === "wavy" ? 3 : 4),
);
const waveMid  = computed(() => AMP + effectiveThickness.value / 2);
const waveViewH = computed(() => 2 * AMP + effectiveThickness.value);

const waveWidth = PERIOD * PERIODS; // 1600px — covers any container width

// Static path for indeterminate — built once with the wavy default (thickness=3)
const STATIC_MID = AMP + 3 / 2; // = 4
const staticWavePath = (() => {
  let d = "";
  for (let x = 0; x <= waveWidth; x += STEP) {
    const y = STATIC_MID - AMP * Math.sin((x / PERIOD) * Math.PI * 2);
    d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(2)} `;
  }
  return d.trim();
})();

// ── rAF state (plain JS — no Vue refs to avoid 60fps reactive overhead) ───
//
// Architecture mirrors MCircleProgressBar:
//   • displayedValue  follows clampedValue with exponential smoothing (~300ms)
//   • appearanceF     animates 0↔1 at the WAVE_START threshold and at 100%
//   • animPhase       advances every frame to scroll the wave leftward
// clip-path and track.left are written via direct DOM setAttribute/style
// to avoid the CSS-transition vs rAF conflict.
let displayedValue = 0;
let appearanceF    = 0;
let animPhase      = 0;

type Anim = { from: number; to: number; t0: number; dur: number };
const appearAnim: Anim = { from: 0, to: 0, t0: -1, dur: 500 };

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function startAnim(a: Anim, from: number, to: number, now: number) {
  if (Math.abs(from - to) < 0.001) { a.t0 = -1; a.to = to; return; }
  a.from = from; a.to = to; a.t0 = now;
}
function tickAnim(a: Anim, now: number): number {
  if (a.t0 < 0) return a.to;
  const t = Math.min(1, (now - a.t0) / a.dur);
  const v = a.from + (a.to - a.from) * easeInOut(t);
  if (t >= 1) a.t0 = -1;
  return v;
}

// ── Template refs for direct DOM updates ─────────────────────────────────
const waveClipEl = ref<HTMLDivElement | null>(null);
const trackEl    = ref<HTMLDivElement | null>(null);
const wavePath   = ref("");  // updated in tick → drives path's :d binding

// ── rAF tick ─────────────────────────────────────────────────────────────
let lastTime: number | null = null;
let rafId = 0;
const PHASE_PER_MS = (2 * Math.PI) / 800; // one full PERIOD scroll per 800ms
const VALUE_TAU    = 130;                  // exponential τ → ~300ms 90%-settle

function buildWavePath(factor: number, ph: number): string {
  const mid = waveMid.value;
  const pts: string[] = [];
  for (let x = 0; x <= waveWidth; x += STEP) {
    const y = mid - AMP * factor * Math.sin((x / PERIOD) * Math.PI * 2 + ph);
    pts.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function tick(now: number) {
  const dt = lastTime !== null ? now - lastTime : 0;
  lastTime = now;

  // 1. Wave phase scrolls leftward
  animPhase -= dt * PHASE_PER_MS;

  // 2. Smooth displayed value (exponential interpolation)
  if (dt > 0) {
    const k = 1 - Math.exp(-dt / VALUE_TAU);
    displayedValue += (clampedValue.value - displayedValue) * k;
  }

  // 3. Advance appearance animation
  appearanceF = tickAnim(appearAnim, now);

  // 4. Update DOM directly
  const margin = MARGIN_PX * appearanceF;
  const dv     = displayedValue;

  if (waveClipEl.value)
    waveClipEl.value.style.clipPath = `inset(0 ${(100 - dv).toFixed(3)}% 0 0)`;

  if (trackEl.value) {
    trackEl.value.style.left   = `calc(${dv.toFixed(3)}% + ${margin.toFixed(2)}px)`;
    trackEl.value.style.height = `${effectiveThickness.value}px`;
  }

  // 5. Rebuild wave path (drives :d via Vue ref)
  wavePath.value = buildWavePath(appearanceF, animPhase);

  rafId = requestAnimationFrame(tick);
}

// ── Watchers ─────────────────────────────────────────────────────────────
watch(clampedValue, (v, prev) => {
  if (props.variant !== "wavy" || isIndeterminate.value) return;
  const now = performance.now();

  if      (prev <= WAVE_START && v > WAVE_START && v < 100) startAnim(appearAnim, appearanceF, 1, now);
  else if (prev > WAVE_START  && v <= WAVE_START)           startAnim(appearAnim, appearanceF, 0, now);
  else if (v === 100)                                       startAnim(appearAnim, appearanceF, 0, now);
  else if (prev === 100 && v > WAVE_START)                  startAnim(appearAnim, appearanceF, 1, now);
});

function initAndStart() {
  displayedValue = clampedValue.value;
  const v = clampedValue.value;
  appearanceF   = (v > WAVE_START && v < 100) ? 1 : 0;
  appearAnim.to = appearanceF;
  appearAnim.t0 = -1;

  // Set initial DOM values immediately to avoid a one-frame flash
  const margin = MARGIN_PX * appearanceF;
  if (waveClipEl.value)
    waveClipEl.value.style.clipPath = `inset(0 ${(100 - v).toFixed(3)}% 0 0)`;
  if (trackEl.value) {
    trackEl.value.style.left   = `calc(${v.toFixed(3)}% + ${margin.toFixed(2)}px)`;
    trackEl.value.style.height = `${effectiveThickness.value}px`;
  }
  wavePath.value = buildWavePath(appearanceF, animPhase);

  if (!rafId) rafId = requestAnimationFrame(tick);
}

function stopRaf() {
  cancelAnimationFrame(rafId);
  rafId = 0; lastTime = null;
  appearAnim.t0 = -1;
}

onMounted(() => {
  if (props.variant === "wavy" && !isIndeterminate.value) initAndStart();
});
onUnmounted(stopRaf);

watch(() => props.variant, async (v) => {
  if (v === "wavy" && !isIndeterminate.value) { await nextTick(); initAndStart(); }
  else stopRaf();
});
watch(isIndeterminate, async (v) => {
  if (!v && props.variant === "wavy") { await nextTick(); initAndStart(); }
  else stopRaf();
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <span v-if="label" class="text-label-small text-on-surface-variant">{{ label }}</span>

    <!-- ── Linear variant ────────────────────────────────────────────────── -->
    <div
      v-if="variant === 'linear'"
      class="relative w-full overflow-hidden rounded-full"
      :class="colorMap[color].track"
      :style="{ height: `${effectiveThickness}px` }"
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
      class="relative w-full overflow-visible"
      :style="{ height: `${waveViewH}px` }"
      role="progressbar"
      :aria-valuenow="isIndeterminate ? undefined : clampedValue"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <!-- DETERMINATE — rAF drives clip-path, track.left, and wave path -->
      <template v-if="!isIndeterminate">
        <!-- Active wave, clipped to displayedValue% -->
        <div
          ref="waveClipEl"
          class="absolute inset-0 overflow-hidden"
          style="clip-path: inset(0 100% 0 0)"
        >
          <svg
            class="absolute top-0 left-0 h-full"
            :class="colorMap[color].text"
            :width="waveWidth"
            :height="waveViewH"
            :viewBox="`0 0 ${waveWidth} ${waveViewH}`"
          >
            <path
              :d="wavePath"
              fill="none"
              stroke="currentColor"
              :stroke-width="effectiveThickness"
              stroke-linecap="round"
            />
          </svg>
        </div>

        <!-- Inactive track — rAF owns left and height; no Vue-managed left -->
        <div
          ref="trackEl"
          class="absolute right-0"
          :class="colorMap[color].track"
          style="border-radius: 9999px; top: 50%; transform: translateY(-50%);"
        />

        <!-- Stop dot at far right -->
        <div
          class="absolute rounded-full"
          :class="colorMap[color].bar"
          :style="{
            right: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            width: `${effectiveThickness}px`,
            height: `${effectiveThickness}px`,
          }"
        />
      </template>

      <!-- INDETERMINATE — keeps original CSS-animated wide strip -->
      <div v-else class="absolute inset-0 overflow-hidden rounded-full">
        <div
          class="absolute top-0 left-0 h-full animate-[m3-wave-flow_0.9s_linear_infinite]"
          :class="colorMap[color].text"
          :style="{ width: `${waveWidth}px` }"
        >
          <svg
            :width="waveWidth"
            :height="waveViewH"
            :viewBox="`0 0 ${waveWidth} ${waveViewH}`"
            class="h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              :d="staticWavePath"
              fill="none"
              stroke="currentColor"
              :stroke-width="effectiveThickness"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes m3-wave-flow {
  from { transform: translateX(0); }
  to   { transform: translateX(-20px); }
}

@keyframes m3-progress-indeterminate {
  0%   { left: -40%; }
  100% { left: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .animate-\[m3-wave-flow_1\.2s_linear_infinite\],
  .animate-\[m3-wave-flow_0\.9s_linear_infinite\],
  .animate-\[m3-progress-indeterminate_1\.6s_ease-in-out_infinite\] {
    animation: none !important;
  }
}
</style>
