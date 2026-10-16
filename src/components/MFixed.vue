<script setup lang="ts">
/**
 * Same API as MAbsolute but uses `position: fixed`. Positions elements relative to the viewport, not a
 * positioned ancestor.
 *
 * @slot default Content.
 */
import { computed } from 'vue'
import type { Placement } from './MAbsolute.vue'

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
    /** Top offset (number = px) */
    top?: string | number
    /** Right offset */
    right?: string | number
    /** Bottom offset */
    bottom?: string | number
    /** Left offset */
    left?: string | number
    /** Set all sides to 0 */
    inset?: boolean
    /** Z-index value */
    zIndex?: number
  }>(),
  { inset: false, zIndex: 50, offset: 0 },
)

function toUnit(v: string | number | undefined) {
  if (v === undefined) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

const style = computed(() => {
  if (props.inset) {
    return { position: 'fixed' as const, inset: '0', zIndex: props.zIndex }
  }

  if (props.placement) {
    const oy = toUnit(props.offsetY ?? props.offset)!
    const ox = toUnit(props.offsetX ?? props.offset)!
    const [y, x] = props.placement.split('-') as [string, string]
    const s: Record<string, string | undefined> = {
      position: 'fixed',
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

  return {
    position: 'fixed' as const,
    top: toUnit(props.top),
    right: toUnit(props.right),
    bottom: toUnit(props.bottom),
    left: toUnit(props.left),
    zIndex: props.zIndex,
  }
})
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
