<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useLocale } from '../composables/useLocale';

const props = withDefaults(
  defineProps<{
    size?: number;
    contained?: boolean;
    color?: "primary" | "secondary" | "tertiary" | "error";
    label?: string;
  }>(),
  { size: 48, contained: false, color: "primary" },
);

const locale = useLocale();

// ContainedActiveColor is a different role (OnXContainer) from the bare
// ActiveIndicatorColor (X) — the shape recolors when it gains the contained
// circle behind it, it's not just the same tone on a new background.
const colorMap: Record<"primary" | "secondary" | "tertiary" | "error", { active: string; containedActive: string; container: string }> = {
  primary:   { active: "var(--color-primary)",   containedActive: "var(--color-on-primary-container)",   container: "var(--color-primary-container)"   },
  secondary: { active: "var(--color-secondary)", containedActive: "var(--color-on-secondary-container)", container: "var(--color-secondary-container)" },
  tertiary:  { active: "var(--color-tertiary)",  containedActive: "var(--color-on-tertiary-container)",  container: "var(--color-tertiary-container)"  },
  error:     { active: "var(--color-error)",     containedActive: "var(--color-on-error-container)",     container: "var(--color-error-container)"     },
};
const svgColor = computed(() => colorMap[props.color]);
const activeColor = computed(() => (props.contained ? svgColor.value.containedActive : svgColor.value.active));

// LoadingIndicatorTokens: ActiveSize=38dp against ContainerHeight/Width=48dp
// — the bare shape doesn't fill its container, it sits inset within it.
const BARE_RATIO = 38 / 48;
const innerSize = computed(() => Math.round(props.size * (props.contained ? 0.55 : BARE_RATIO)));

// ── Shape morph geometry ───────────────────────────────────────────────────
// Every shape is sampled as a radius multiplier at the same K angles, so any
// two shapes can be linearly interpolated point-by-point into a smooth
// in-between silhouette — the same trick as MSpinner's wavy path, applied to
// a rotating cast of shapes instead of a single fixed waveform.
const K = 120;
const R = 36;
// Hard ceiling on the sampled radius: the spring's overshoot can transiently
// push a point's interpolated radius past both shapes' own peaks, and the
// most eccentric shape (pill) already sits close to the viewBox edge — this
// keeps every shape's silhouette fully inside the 0..100 viewBox at all times.
const MAX_R = 47;
const angles: number[] = [];
const cosT: number[] = [];
const sinT: number[] = [];
for (let i = 0; i < K; i++) {
  const theta = (2 * Math.PI * i) / K - Math.PI / 2;
  angles.push(theta);
  cosT.push(Math.cos(theta));
  sinT.push(Math.sin(theta));
}

// Same seven-shape sequence (and rough proportions) as Google's own
// androidx.compose.material3.LoadingIndicator: SoftBurst → Cookie9Sided →
// Pentagon → Pill → Sunny → Cookie4Sided → Oval → (loops back to SoftBurst).
// Exact vertex data isn't public outside the Kotlin source, so each is
// approximated as a radius multiplier at the same K angles as the rest.
type ShapeFn = (theta: number) => number;
function ellipse(a: number, b: number): ShapeFn {
  return (t) => (a * b) / Math.sqrt((b * Math.cos(t)) ** 2 + (a * Math.sin(t)) ** 2);
}
const shapeFns: ShapeFn[] = [
  (t) => 1 + 0.07 * Math.cos(10 * t), // soft burst
  (t) => 1 + 0.15 * Math.cos(9 * t), // cookie (9 lobes)
  (t) => 1 + 0.1 * Math.cos(5 * t) + 0.02 * Math.cos(10 * t), // pentagon
  ellipse(1.3, 0.7), // pill
  (t) => 1 + 0.22 * Math.cos(8 * t), // sunny (8-point burst)
  (t) => 1 + 0.16 * Math.cos(4 * t), // cookie (4 lobes)
  ellipse(1.2, 0.8), // oval
];
const shapes: number[][] = shapeFns.map((fn) => angles.map(fn));
const SHAPE_COUNT = shapes.length;

// Timing/physics mirror the real component: ~650ms per shape, morphed by an
// underdamped spring (dampingRatio 0.6, stiffness 200) rather than a fixed
// easing curve — it overshoots slightly and settles, which is what reads as
// a "bounce". The exact same progress value drives a synced +90° rotation
// swing on top of a slow constant spin, so the turn is what visually carries
// the shape change instead of the two feeling like separate animations.
const MORPH_INTERVAL_MS = 650;
const GLOBAL_ROTATION_MS = 4666;
const DAMPING = 0.6;
const OMEGA_N = Math.sqrt(200);
const OMEGA_D = OMEGA_N * Math.sqrt(1 - DAMPING * DAMPING);

function springProgress(tSec: number): number {
  if (tSec <= 0) return 0;
  const decay = Math.exp(-DAMPING * OMEGA_N * tSec);
  return 1 - decay * (Math.cos(OMEGA_D * tSec) + ((DAMPING * OMEGA_N) / OMEGA_D) * Math.sin(OMEGA_D * tSec));
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const ptX = new Float64Array(K);
const ptY = new Float64Array(K);

// Straight segments between the K sampled points would facet visibly on the
// more eccentric shapes (the pill/oval's tips are high-curvature and get
// under-sampled by uniform angle steps) — a closed Catmull-Rom spline
// (converted to cubic Béziers) keeps every edge tangent-smooth regardless.
function buildPath(from: number[], to: number[], f: number): string {
  for (let i = 0; i < K; i++) {
    const r = Math.min(R * (from[i]! + (to[i]! - from[i]!) * f), MAX_R);
    ptX[i] = 50 + r * cosT[i]!;
    ptY[i] = 50 + r * sinT[i]!;
  }
  let d = `M${ptX[0]!.toFixed(2)},${ptY[0]!.toFixed(2)}`;
  for (let i = 0; i < K; i++) {
    const i0 = (i - 1 + K) % K;
    const i1 = i;
    const i2 = (i + 1) % K;
    const i3 = (i + 2) % K;
    const c1x = ptX[i1]! + (ptX[i2]! - ptX[i0]!) / 6;
    const c1y = ptY[i1]! + (ptY[i2]! - ptY[i0]!) / 6;
    const c2x = ptX[i2]! - (ptX[i3]! - ptX[i1]!) / 6;
    const c2y = ptY[i2]! - (ptY[i3]! - ptY[i1]!) / 6;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)},${c2x.toFixed(2)},${c2y.toFixed(2)},${ptX[i2]!.toFixed(2)},${ptY[i2]!.toFixed(2)}`;
  }
  return d + "Z";
}

const pathEl = ref<SVGPathElement | null>(null);
const svgEl = ref<SVGSVGElement | null>(null);
const prefersReducedMotion = ref(false);

let rafId = 0;
let mountTime = -1;
let shapeIndex = 0;
let segStart = -1;
let morphRotationTarget = 90; // starts at a quarter turn, like the source component

function tick(now: number) {
  if (mountTime < 0) mountTime = now;
  if (segStart < 0) segStart = now;

  const reduced = prefersReducedMotion.value;
  const interval = reduced ? MORPH_INTERVAL_MS * 1.8 : MORPH_INTERVAL_MS;
  let elapsed = now - segStart;
  if (elapsed >= interval) {
    shapeIndex = (shapeIndex + 1) % SHAPE_COUNT;
    morphRotationTarget = (morphRotationTarget + 90) % 360;
    segStart = now;
    elapsed = 0;
  }

  const p = reduced ? easeInOut(elapsed / interval) : springProgress(elapsed / 1000);
  const from = shapes[shapeIndex]!;
  const to = shapes[(shapeIndex + 1) % SHAPE_COUNT]!;
  pathEl.value?.setAttribute("d", buildPath(from, to, p));

  if (!reduced && svgEl.value) {
    const globalDeg = (((now - mountTime) / GLOBAL_ROTATION_MS) * 360) % 360;
    svgEl.value.style.transform = `rotate(${(p * 90 + morphRotationTarget + globalDeg).toFixed(2)}deg)`;
  }

  rafId = requestAnimationFrame(tick);
}

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  pathEl.value?.setAttribute("d", buildPath(shapes[0]!, shapes[0]!, 0));
  rafId = requestAnimationFrame(tick);
});
onUnmounted(() => cancelAnimationFrame(rafId));
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center"
    :class="contained ? 'rounded-full' : undefined"
    :style="{ width: `${size}px`, height: `${size}px`, backgroundColor: contained ? svgColor.container : undefined }"
    role="status"
    :aria-label="label ?? locale.loading"
  >
    <svg
      ref="svgEl"
      :width="innerSize"
      :height="innerSize"
      viewBox="0 0 100 100"
      shape-rendering="geometricPrecision"
      style="transform-origin: 50% 50%"
    >
      <path ref="pathEl" shape-rendering="geometricPrecision" :style="{ fill: activeColor }" />
    </svg>
  </span>
</template>
