<script lang="ts">
export { shapeNames } from 'shape-morph'
</script>

<script setup lang="ts">
import { onUnmounted, ref, useId, watch } from 'vue'
import { AnimatedMorph, getShape, toSvgPath, type ShapeName } from 'shape-morph'

export type { ShapeName }

const props = withDefaults(
  defineProps<{
    /** One of M3's 35 named "expressive" shapes (MaterialShapes.kt), e.g. 'Cookie9Sided', 'Heart'. */
    shape: ShapeName
    /** Fill color used when there's no default slot content to clip (a decorative solid shape). */
    fill?: string
    /** Spring-morph into the new outline when `shape` changes — false snaps instantly instead. */
    animate?: boolean
  }>(),
  {
    fill: 'currentColor',
    animate: true,
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
const SPRING = { stiffness: 380, damping: 31.2 }

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
    spring: SPRING,
    size: 1,
    onFrame: (frame) => { pathD.value = frame.pathD },
  })
  settledShape = next
})

onUnmounted(() => morph?.dispose())
</script>

<template>
  <span class="relative inline-block h-full w-full">
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
