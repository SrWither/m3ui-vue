<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, useId } from "vue";

const props = withDefaults(
  defineProps<{
    value?: number;
    indeterminate?: boolean;
    color?: "primary" | "secondary" | "tertiary" | "error";
    variant?: "circle" | "wavy";
    label?: string;
    size?: number;
    thickness?: number;
  }>(),
  {
    color: "primary",
    variant: "wavy",
    size: 80,
    thickness: 3,
  },
);

const clampedValue = computed(() => Math.min(100, Math.max(0, props.value ?? 0)));

const svgColorMap: Record<"primary" | "secondary" | "tertiary" | "error", { fill: string; track: string }> = {
  primary:   { fill: "var(--color-primary)",   track: "var(--color-primary-container)"   },
  secondary: { fill: "var(--color-secondary)",  track: "var(--color-secondary-container)"  },
  tertiary:  { fill: "var(--color-tertiary)",   track: "var(--color-tertiary-container)"   },
  error:     { fill: "var(--color-error)",      track: "var(--color-error-container)"      },
};
const svgColor = computed(() => svgColorMap[props.color]);

// ── Geometry ─────────────────────────────────────────────────────────────
const R        = 40;
const CIRC     = 2 * Math.PI * R;
const BUMPS    = 12;
const SEGS     = BUMPS * 20;
const AMP_FRAC = 0.055;
const WAVE_START = 10;

// thickness-derived values (all scale together)
const strokeW = computed(() => props.thickness);
// mask must cover: stroke/2 + wave amplitude (R*AMP_FRAC) on each side + small padding
const maskSW  = computed(() => props.thickness + Math.ceil(2 * R * AMP_FRAC) + 2); // ≥ stroke+7
const edgeGap = computed(() => 0.75 + props.thickness * 0.25);

// Vue computed — the TARGET arc length the animation follows
const arcLen = computed(() => (clampedValue.value / 100) * CIRC);

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ── All animation state as plain JS variables (no Vue refs) ───────────────
//
// Why plain JS and not Vue refs?
// maskArcLen = displayedArcLen − 2*effGap.  It combines:
//   • displayedArcLen — must follow props.value smoothly (always)
//   • effGap          — driven by appearance/completion animations
// If we use CSS transitions for one part and rAF for the other they fight.
// Solution: run EVERYTHING in the same rAF tick.
//   • displayedArcLen uses exponential smoothing (~300ms feel, matches CSS ease)
//   • effGap changes come from the animation factors below
// DOM is updated via template refs (setAttribute), bypassing Vue's scheduler.

let displayedArcLen = 0;   // smoothly follows arcLen.value (exponential, τ=130ms)
let appearanceF     = 0;   // 0=hidden 1=visible, animated at WAVE_START threshold
let gapF            = 1;   // 1=open  0=closed,  animated during completion phase 1
let collapseF       = 1;   // 1=full  0=circle,  animated during completion phase 2
let animPhase       = 0;

// Per-animation: { from, to, t0 (startTime, -1=idle), dur }
type Anim = { from: number; to: number; t0: number; dur: number };
const appearAnim:  Anim = { from: 0, to: 0, t0: -1, dur: 500 };
const gapAnim:     Anim = { from: 1, to: 1, t0: -1, dur: 300 };
const collapseAnim:Anim = { from: 1, to: 1, t0: -1, dur: 800 };
const restoreAnim: Anim = { from: 1, to: 1, t0: -1, dur: 400 };

function startAnim(a: Anim, from: number, to: number, now: number) {
  a.from = from; a.to = to; a.t0 = now;
}
function tickAnim(a: Anim, now: number): number {
  if (a.t0 < 0) return a.to;
  const t = Math.min(1, (now - a.t0) / a.dur);
  const v = a.from + (a.to - a.from) * easeInOut(t);
  if (t >= 1) a.t0 = -1;
  return v;
}

// ── Watchers — write to plain JS anim objects, NOT to Vue refs ────────────
watch(clampedValue, (v, prev) => {
  if (props.indeterminate) return;
  if (prev <= WAVE_START && v  >  WAVE_START) startAnim(appearAnim, appearanceF, 1, performance.now());
  if (prev >  WAVE_START && v <= WAVE_START)  startAnim(appearAnim, appearanceF, 0, performance.now());

  if (v === 100) {
    // Snap appearance so collapse never starts mid-appear
    appearanceF = 1; appearAnim.t0 = -1;
    // Phase 1: close gap; tick will chain to phase 2 automatically
    restoreAnim.t0 = -1;
    startAnim(gapAnim, gapF, 0, performance.now());
    collapseAnim.t0 = -1; collapseAnim.to = 1; collapseF = 1; // reset phase 2
  } else if (prev === 100) {
    gapAnim.t0 = -1; gapAnim.to = 1;         // clear "to===0" sentinel
    collapseAnim.t0 = -1; collapseAnim.to = 1;
    restoreAnim.t0 = -1;
    // Restore gap and collapse simultaneously from wherever they are
    startAnim(restoreAnim, Math.min(gapF, collapseF), 1, performance.now());
  }
});

// ── Template refs for direct DOM updates ─────────────────────────────────
const maskCircleEl  = ref<SVGCircleElement  | null>(null);
const trackCircleEl = ref<SVGCircleElement  | null>(null);
const wavePath      = ref(buildPath(R * AMP_FRAC, 0));

// ── rAF tick — single source of truth for all visual updates ─────────────
let lastTime: number | null = null;
let rafId = 0;
const PHASE_PER_MS = (2 * Math.PI / BUMPS) / 90;
const ARC_TAU = 130; // ms time-constant for displayedArcLen smoothing

function tick(now: number) {
  const dt = lastTime !== null ? now - lastTime : 0;
  lastTime = now;

  // 1. Advance wave phase
  animPhase -= dt * PHASE_PER_MS;

  // 2. Smooth arc (exponential: 90% in ≈300ms, equivalent feel to CSS ease-out)
  if (dt > 0) {
    const k = 1 - Math.exp(-dt / ARC_TAU);
    displayedArcLen += (arcLen.value - displayedArcLen) * k;
  }

  // 3. Advance appearance animation
  appearanceF = tickAnim(appearAnim, now);

  // 4. Advance completion sequence
  //    Phase 1 (gap closing) chains automatically into Phase 2 (wave collapse)
  if (gapAnim.t0 >= 0 || gapAnim.to === 0) {
    gapF = tickAnim(gapAnim, now);
    if (gapAnim.t0 < 0 && gapF <= 0 && collapseAnim.t0 < 0 && collapseAnim.to !== 0) {
      // Phase 1 done — start phase 2
      startAnim(collapseAnim, collapseF, 0, now);
    }
  }
  if (collapseAnim.t0 >= 0 || collapseAnim.to === 0) {
    collapseF = tickAnim(collapseAnim, now);
  }

  // 5. Advance restore animation (undoes both gap and collapse)
  if (restoreAnim.t0 >= 0) {
    const r = tickAnim(restoreAnim, now);
    gapF = r; collapseF = r;
  }

  // 6. Compute derived visual values
  const combined = appearanceF * collapseF;
  const gap      = edgeGap.value * combined * gapF;
  const disp     = displayedArcLen;
  const dispGap  = CIRC - disp;

  // Mask circle
  const maskedArc = Math.max(0, disp - 2 * gap);
  const maskAngle = -90 + (gap / CIRC) * 360;
  const mc = maskCircleEl.value;
  if (mc) {
    mc.setAttribute('stroke-dasharray', `${maskedArc.toFixed(2)} ${(CIRC - maskedArc).toFixed(2)}`);
    mc.setAttribute('transform', `rotate(${maskAngle.toFixed(3)}, 50, 50)`);
  }

  // Track circle
  const trackLen = Math.max(0, dispGap - 2 * gap);
  const trackOff = Math.max(0, dispGap - gap);
  const tc = trackCircleEl.value;
  if (tc) {
    tc.setAttribute('stroke-dasharray', `${trackLen.toFixed(2)} ${(CIRC - trackLen).toFixed(2)}`);
    tc.setAttribute('stroke-dashoffset', trackOff.toFixed(2));
  }

  // Wave path
  wavePath.value = buildPath(R * AMP_FRAC * combined, animPhase);

  rafId = requestAnimationFrame(tick);
}

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

function startRaf() { if (!rafId) rafId = requestAnimationFrame(tick); }
function stopRaf() {
  cancelAnimationFrame(rafId);
  rafId = 0; lastTime = null;
  // Reset anim objects
  appearAnim.t0 = gapAnim.t0 = collapseAnim.t0 = restoreAnim.t0 = -1;
}

function initWavy() {
  const v = clampedValue.value;
  displayedArcLen = arcLen.value;
  appearanceF = 0; gapF = 1; collapseF = 1;
  appearAnim.t0 = gapAnim.t0 = collapseAnim.t0 = restoreAnim.t0 = -1;
  appearAnim.to = 0; gapAnim.to = 1; collapseAnim.to = 1;
  if (v === 100) { appearanceF = 1; gapF = 0; collapseF = 0; gapAnim.to = 0; collapseAnim.to = 0; }
  else if (v > WAVE_START) { appearanceF = 1; appearAnim.to = 1; }
}

onMounted(() => {
  if (props.variant === "wavy" && !props.indeterminate) {
    initWavy();
    startRaf();
  }
});
onUnmounted(stopRaf);
watch(() => props.variant, (v) => {
  if (v === "wavy" && !props.indeterminate) { initWavy(); startRaf(); }
  else stopRaf();
});
watch(() => props.indeterminate, (v) => {
  if (v) stopRaf();
  else if (props.variant === "wavy") { initWavy(); startRaf(); }
});

const maskId = useId();
</script>

<template>
  <div class="inline-flex flex-col items-center gap-1">
    <span v-if="label" class="text-label-small text-on-surface-variant">{{ label }}</span>

    <div class="relative">
      <svg
        :width="size" :height="size"
        viewBox="0 0 100 100"
        fill="none"
        role="progressbar"
        :aria-valuenow="indeterminate ? undefined : clampedValue"
        aria-valuemin="0" aria-valuemax="100"
      >
        <!-- ── Indeterminate — same for both variants ─────────────────── -->
        <template v-if="indeterminate">
          <circle cx="50" cy="50" :r="R" fill="none" :stroke-width="strokeW"
            :style="{ stroke: svgColor.track }"
          />
          <circle cx="50" cy="50" :r="R" fill="none" :stroke-width="strokeW"
            stroke-linecap="round"
            :style="{ stroke: svgColor.fill, transformOrigin: '50px 50px', animation: 'm3-cpb-spin 1.4s linear infinite, m3-cpb-arc 3s ease-in-out infinite' }"
          />
        </template>

        <!-- ── Wavy variant ────────────────────────────────────────────── -->
        <template v-else-if="variant === 'wavy'">
          <defs>
            <mask :id="maskId" maskUnits="userSpaceOnUse">
              <rect x="0" y="0" width="100" height="100" fill="black" />
              <circle
                ref="maskCircleEl"
                cx="50" cy="50" :r="R"
                fill="none" :stroke-width="maskSW" stroke="white"
                stroke-dasharray="0 251"
                transform="rotate(-90, 50, 50)"
              />
            </mask>
          </defs>

          <circle
            ref="trackCircleEl"
            cx="50" cy="50" :r="R"
            fill="none" :stroke-width="strokeW"
            :style="{ stroke: svgColor.track }"
            stroke-dasharray="251 0"
            transform="rotate(-90, 50, 50)"
          />

          <path
            :d="wavePath"
            fill="none" :stroke-width="strokeW"
            stroke-linecap="round" stroke-linejoin="round"
            :mask="`url(#${maskId})`"
            :style="{ stroke: svgColor.fill }"
          />
        </template>

        <!-- ── Circle variant ────────────────────────────────────────── -->
        <template v-else-if="!indeterminate">
          <circle cx="50" cy="50" :r="R" fill="none"
            :stroke-width="strokeW" :style="{ stroke: svgColor.track }"
          />
          <circle cx="50" cy="50" :r="R" fill="none"
            :stroke-width="strokeW"
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

        <!-- Percentage label — hidden when indeterminate or slot content provided -->
        <text
          v-if="!indeterminate && !$slots.default"
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

      <!-- Slot content centered inside the ring -->
      <div
        v-if="$slots.default"
        class="absolute inset-0 flex items-center justify-center"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style>
/* Continuous rotation — linear so speed never changes */
@keyframes m3-cpb-spin {
  from { transform: rotate(-90deg); }
  to   { transform: rotate(270deg); }
}

/*
  Arc size oscillates between ~7 % and ~70 % of the circumference (CIRC ≈ 251.3).
  Combined with the spin at a different period (1.4 s vs 1.05 s, ratio 4:3),
  head and tail appear to move independently — matching the M3 indeterminate feel.
*/
@keyframes m3-cpb-arc {
  0%, 100% { stroke-dasharray: 18.8 232.5; }
  50%      { stroke-dasharray: 176  75.3;  }
}
</style>
