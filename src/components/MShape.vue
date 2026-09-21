<script lang="ts">
export { shapeNames } from 'shape-morph'
</script>

<script setup lang="ts">
import { onUnmounted, ref, useId, watch } from 'vue'
import { AnimatedMorph, getShape, toSvgPath, type ShapeName } from 'shape-morph'

export type { ShapeName }

// No default width/height here (matches MAspectRatio) — size it via `class`/`style` on the
// component itself, e.g. `class="h-16 w-16"`. A hardcoded `h-full w-full` would fight Tailwind's
// own (undefined) utility ordering against whatever sizing class the consumer passes through.
const props = withDefaults(
  defineProps<{
    /** One of M3's 35 named "expressive" shapes (MaterialShapes.kt), e.g. 'Cookie9Sided', 'Heart'. */
    shape: ShapeName
    /**
     * Fill color used when there's no default slot content to clip (a decorative solid shape).
     * SVG `fill`, not a `background-color` — a `bg-*` Tailwind class on the component itself has
     * no effect here; use `fill` (or a `text-*` class, since the default is `currentColor`).
     */
    fill?: string
    /** Spring-morph into the new outline when `shape` changes — false snaps instantly instead. */
    animate?: boolean
    /**
     * Multiplier on the morph spring's speed (1 = default). Scales stiffness by speed² and the
     * damping coefficient by speed, which time-scales the spring uniformly without changing its
     * character (same amount of overshoot/settle shape, just faster or slower).
     */
    speed?: number
  }>(),
  {
    fill: 'currentColor',
    animate: true,
    speed: 1,
  },
)

const clipId = `m3-shape-${useId()}`

// Normalized 0-1 coordinates (size: 1) so the path works as an objectBoundingBox clipPath,
// which scales correctly with the element's actual rendered size instead of a fixed px box.
const pathD = ref(toSvgPath(getShape(props.shape), 1))

let morph: AnimatedMorph | null = null
let settledShape = props.shape

// MaterialShapes is itself an Expressive-only M3 feature (MaterialShapes.kt requires
// @ExperimentalMaterial3ExpressiveApi), so this spring is ExpressiveMotionTokens.DefaultSpatial
// (dampingRatio 0.8, stiffness 380) — the scheme's general-purpose spatial spring, since no
// single Compose composable's own bespoke spring (e.g. LoadingIndicator's 0.6/200) is the
// "correct" one to copy for a generic shape primitive like this. shape-morph's AnimatedMorph
// spring uses a plain damping *coefficient*, not Compose's damping *ratio* — converted via
// damping = 2 * dampingRatio * sqrt(stiffness) = 2 * 0.8 * sqrt(380) ≈ 31.2.
const BASE_STIFFNESS = 380
const BASE_DAMPING = 31.2

function springFor(speed: number) {
  return { stiffness: BASE_STIFFNESS * speed ** 2, damping: BASE_DAMPING * speed }
}

watch(() => props.shape, (next, prev) => {
  if (!prev || next === prev) return
  morph?.dispose()
  if (!props.animate) {
    pathD.value = toSvgPath(getShape(next), 1)
    settledShape = next
    return
  }
  // AnimatedMorph only morphs between two named/RoundedPolygon endpoints, not from an
  // arbitrary in-flight shape, so a change that interrupts a running morph restarts from
  // the last shape that had actually settled rather than the current on-screen outline.
  morph = new AnimatedMorph(settledShape, next, {
    spring: springFor(props.speed),
    size: 1,
    onFrame: (frame) => { pathD.value = frame.pathD },
  })
  // The constructor only emits the start shape at progress 0 — setting `progress` is what
  // actually kicks off the spring animation toward the end shape (see shape-morph's own
  // useMorph, which drives this the same way). Skipping this makes the shape jump straight
  // to its final frame with no visible interpolation, one render behind the prop change.
  morph.progress = 1
  settledShape = next
})

onUnmounted(() => morph?.dispose())
</script>

<template>
  <span class="relative inline-block">
    <svg width="0" height="0" class="absolute">
      <defs>
        <clipPath :id="clipId" clipPathUnits="objectBoundingBox">
          <path :d="pathD" />
        </clipPath>
      </defs>
    </svg>

    <div v-if="$slots.default" class="h-full w-full" :style="{ clipPath: `url(#${clipId})` }">
      <slot />
    </div>
    <svg v-else viewBox="0 0 1 1" class="h-full w-full">
      <path :d="pathD" :fill="fill" />
    </svg>
  </span>
</template>
