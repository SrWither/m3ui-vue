<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, useId } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    color?: "primary" | "secondary" | "tertiary" | "error";
    variant?: "circle" | "wavy";
    label?: string;
    size?: number;
  }>(),
  {
    color: "primary",
    variant: "wavy",
    size: 80,
  },
);

const clampedValue = computed(() => Math.min(100, Math.max(0, props.value)));

const svgColorMap: Record<"primary" | "secondary" | "tertiary" | "error", { fill: string; track: string }> = {
  primary:   { fill: "var(--color-primary)",   track: "var(--color-primary-container)"   },
  secondary: { fill: "var(--color-secondary)",  track: "var(--color-secondary-container)"  },
  tertiary:  { fill: "var(--color-tertiary)",   track: "var(--color-tertiary-container)"   },
  error:     { fill: "var(--color-error)",      track: "var(--color-error-container)"      },
};
const svgColor = computed(() => svgColorMap[props.color]);

// ── Geometry ─────────────────────────────────────────────────────────────
const R        = 40;
const STROKE   = 3;
const CIRC     = 2 * Math.PI * R;
const BUMPS    = 12;
const SEGS     = BUMPS * 20;
const AMP_FRAC = 0.055;
const MASK_SW  = 10;
const EDGE_GAP = 3;
const WAVE_START = 10;
const FADE_IN_W  = 8;

function fadeFactor(v: number): number {
  if (v <= WAVE_START) return 0;
  if (v <= WAVE_START + FADE_IN_W) return Math.sin(((v - WAVE_START) / FADE_IN_W) * (Math.PI / 2));
  return 1;
}

const arcLen = computed(() => (clampedValue.value / 100) * CIRC);
const gapLen = computed(() => CIRC - arcLen.value);

// ── Completion state ──────────────────────────────────────────────────────
// Two-phase completion when v reaches 100:
//
// Phase 1 — gap closes (CSS-driven, ~300ms):
//   gapFactor 1→0 as an instant ref change. The existing CSS transitions on
//   mask/track smoothly animate the visual gap away. No rAF needed here.
//
// Phase 2 — wave collapses (rAF-driven, 800ms):
//   After CSS settles (~350ms), completionFactor 1→0 via rAF.
//   CSS transitions are disabled during this phase (isCompleting=true)
//   so the rAF-driven mask/track updates are not blurred by CSS interpolation.

const gapFactor        = ref(1.0);  // 0 = gap closed, 1 = normal
const completionFactor = ref(1.0);  // 0 = wave collapsed, 1 = normal
const isCompleting     = ref(false);
let   completionAnimId = 0;
let   completionTimeout: ReturnType<typeof setTimeout> | null = null;

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function animateRef(
  target: number,
  duration: number,
  getter: () => number,
  setter: (v: number) => void,
  onDone?: () => void,
) {
  cancelAnimationFrame(completionAnimId);
  const from = getter();
  const t0   = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - t0) / duration);
    setter(from + (target - from) * easeInOut(t));
    if (t < 1) completionAnimId = requestAnimationFrame(step);
    else        onDone?.();
  }
  completionAnimId = requestAnimationFrame(step);
}

watch(clampedValue, (v, prev) => {
  if (v === 100) {
    // Phase 1: close gap — instant ref change, CSS transition handles the visual
    gapFactor.value = 0;
    // Phase 2: after CSS has settled, collapse wave to circle via rAF
    completionTimeout = setTimeout(() => {
      isCompleting.value = true;
      animateRef(0, 800,
        () => completionFactor.value,
        (x) => { completionFactor.value = x; },
        () => { isCompleting.value = false; },
      );
      completionTimeout = null;
    }, 350);
  } else if (prev === 100) {
    // Cancel any in-progress completion
    if (completionTimeout !== null) { clearTimeout(completionTimeout); completionTimeout = null; }
    cancelAnimationFrame(completionAnimId);
    isCompleting.value = false;
    // Re-open gap via CSS transition, restore amplitude via rAF (no CSS disable)
    gapFactor.value = 1;
    animateRef(1, 400,
      () => completionFactor.value,
      (x) => { completionFactor.value = x; },
    );
  }
});

// ── Derived values ────────────────────────────────────────────────────────
// effGap uses gapFactor — changes are instant refs, CSS transitions handle visuals.
// ampMultiplier uses completionFactor — changes via rAF with CSS transitions disabled.
const effGap        = computed(() => EDGE_GAP * fadeFactor(clampedValue.value) * gapFactor.value);
const ampMultiplier = computed(() => fadeFactor(clampedValue.value) * completionFactor.value);

const maskArcLen = computed(() => Math.max(0, arcLen.value - 2 * effGap.value));
const maskGapLen = computed(() => CIRC - maskArcLen.value);
const maskRotate = computed(() => -90 + (effGap.value / CIRC) * 360);

const trackLen    = computed(() => Math.max(0, gapLen.value - 2 * effGap.value));
const trackDash   = computed(() => `${trackLen.value.toFixed(2)} ${(CIRC - trackLen.value).toFixed(2)}`);
const trackOffset = computed(() => Math.max(0, gapLen.value - effGap.value).toFixed(2));

const maskTransition  = computed(() =>
  isCompleting.value ? "none" : "stroke-dasharray 300ms ease, transform 300ms ease");
const trackTransition = computed(() =>
  isCompleting.value ? "none" : "stroke-dasharray 300ms ease, stroke-dashoffset 300ms ease");

// ── Wave path ─────────────────────────────────────────────────────────────
function buildPath(amp: number, phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= SEGS; i++) {
    const theta = (2 * Math.PI * i) / SEGS - Math.PI / 2;
    const rr    = R + amp * Math.sin(BUMPS * theta + phase);
    const x     = 50 + rr * Math.cos(theta);
    const y     = 50 + rr * Math.sin(theta);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join("") + "Z";
}

// ── rAF wave animation ────────────────────────────────────────────────────
const wavePath = ref(buildPath(R * AMP_FRAC, 0));
let animPhase  = 0;
let lastTime: number | null = null;
let rafId      = 0;
const PHASE_PER_MS = (2 * Math.PI / BUMPS) / 90;

function tick(now: number) {
  if (lastTime !== null) animPhase -= (now - lastTime) * PHASE_PER_MS;
  lastTime = now;
  wavePath.value = buildPath(R * AMP_FRAC * ampMultiplier.value, animPhase);
  rafId = requestAnimationFrame(tick);
}

function startRaf() { if (!rafId) rafId = requestAnimationFrame(tick); }
function stopRaf() {
  cancelAnimationFrame(rafId);
  cancelAnimationFrame(completionAnimId);
  if (completionTimeout !== null) { clearTimeout(completionTimeout); completionTimeout = null; }
  rafId = 0;
  lastTime = null;
}

onMounted(() => {
  if (props.variant === "wavy") {
    if (clampedValue.value === 100) { gapFactor.value = 0; completionFactor.value = 0; }
    startRaf();
  }
});
onUnmounted(stopRaf);
watch(() => props.variant, (v) => (v === "wavy" ? startRaf() : stopRaf()));

const maskId = useId();
</script>

<template>
  <div class="inline-flex flex-col items-center gap-1">
    <span v-if="label" class="text-label-small text-on-surface-variant">{{ label }}</span>

    <svg
      :width="size" :height="size"
      viewBox="0 0 100 100"
      fill="none"
      role="progressbar"
      :aria-valuenow="clampedValue"
      aria-valuemin="0" aria-valuemax="100"
    >
      <!-- ── Wavy variant ──────────────────────────────────────────────── -->
      <template v-if="variant === 'wavy'">
        <defs>
          <mask :id="maskId" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100" height="100" fill="black" />
            <circle
              cx="50" cy="50" :r="R"
              fill="none"
              :stroke-width="MASK_SW"
              stroke="white"
              :style="{
                strokeDasharray: `${maskArcLen.toFixed(2)} ${maskGapLen.toFixed(2)}`,
                transform: `rotate(${maskRotate.toFixed(3)}deg)`,
                transformOrigin: '50px 50px',
                transition: maskTransition,
              }"
            />
          </mask>
        </defs>

        <!-- Track ring — unfilled region with effGap margin on both sides -->
        <circle
          cx="50" cy="50" :r="R"
          fill="none"
          :stroke-width="STROKE"
          :style="{
            stroke: svgColor.track,
            strokeDasharray: trackDash,
            strokeDashoffset: trackOffset,
            transform: 'rotate(-90deg)',
            transformOrigin: '50px 50px',
            transition: trackTransition,
          }"
        />

        <!-- Wave ring — amplitude driven by ampMultiplier, phase by rAF -->
        <path
          :d="wavePath"
          fill="none"
          :stroke-width="STROKE"
          stroke-linecap="round"
          stroke-linejoin="round"
          :mask="`url(#${maskId})`"
          :style="{ stroke: svgColor.fill }"
        />
      </template>

      <!-- ── Circle (smooth) variant ──────────────────────────────────── -->
      <template v-else>
        <circle cx="50" cy="50" :r="R" fill="none"
          :stroke-width="STROKE"
          :style="{ stroke: svgColor.track }"
        />
        <circle cx="50" cy="50" :r="R" fill="none"
          :stroke-width="STROKE"
          stroke-linecap="round"
          :style="{
            stroke: svgColor.fill,
            strokeDasharray: `${arcLen.toFixed(2)} ${CIRC}`,
            transform: 'rotate(-90deg)',
            transformOrigin: '50px 50px',
            transition: 'stroke-dasharray 300ms ease',
          }"
        />
      </template>

      <!-- Percentage label -->
      <text
        x="50" y="50"
        text-anchor="middle" dominant-baseline="middle"
        :style="{
          fill: svgColor.fill,
          fontSize: `${size < 60 ? 11 : 14}px`,
          fontWeight: '600',
          fontFamily: 'Roboto, sans-serif',
        }"
      >{{ clampedValue }}%</text>
    </svg>
  </div>
</template>
