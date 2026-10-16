<script setup lang="ts">
/**
 * Declarative absolute positioning without Tailwind classes. Supports manual offsets, placement shortcuts, and
 * per-axis control. Pair it with `MRelative` as the positioning parent.
 *
 * @slot default Content.
 */
import { computed } from 'vue'

export type Placement =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

const props = withDefaults(
  defineProps<{
    /** Preset corner/edge placement */
    placement?: Placement
    /** Distance from edges when using placement (applies to both axes) */
    offset?: string | number
    /** Horizontal offset — overrides offset for the X axis */
    offsetX?: string | number
    /** Vertical offset — overrides offset for the Y axis */
    offsetY?: string | number
    /**
     * Top offset (number = px). Defaults to 8px when neither placement nor any of top/right/bottom/left is set
     */
    top?: string | number
    /** Right offset */
    right?: string | number
    /** Bottom offset */
    bottom?: string | number
    /** Left offset. Defaults to 8px when neither placement nor any of top/right/bottom/left is set */
    left?: string | number
    /** Set all sides to 0 */
    inset?: boolean
    /** Z-index value */
    zIndex?: number
  }>(),
  { inset: false, offset: 0 },
)

function toUnit(v: string | number | undefined) {
  if (v === undefined) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

const style = computed(() => {
  if (props.inset) {
    return { position: 'absolute' as const, inset: '0', zIndex: props.zIndex }
  }

  if (props.placement) {
    const oy = toUnit(props.offsetY ?? props.offset)!
    const ox = toUnit(props.offsetX ?? props.offset)!
    const [y, x] = props.placement.split('-') as [string, string]
    const s: Record<string, string | undefined> = {
      position: 'absolute',
      zIndex: props.zIndex != null ? String(props.zIndex) : undefined,
    }
    if (y === 'top') { s.top = oy }
    else if (y === 'bottom') { s.bottom = oy }
    else { s.top = '50%'; s.transform = 'translateY(-50%)' }

    if (x === 'left') { s.left = ox }
    else if (x === 'right') { s.right = ox }
    else {
      s.left = '50%'
      s.transform = s.transform ? 'translate(-50%, -50%)' : 'translateX(-50%)'
    }
    return s
  }

  const hasAny = props.top !== undefined || props.right !== undefined || props.bottom !== undefined || props.left !== undefined
  return {
    position: 'absolute' as const,
    top: hasAny ? toUnit(props.top) : '8px',
    right: toUnit(props.right),
    bottom: toUnit(props.bottom),
    left: hasAny ? toUnit(props.left) : '8px',
    zIndex: props.zIndex,
  }
})
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
