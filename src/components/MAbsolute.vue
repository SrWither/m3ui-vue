<script setup lang="ts">
import { computed } from 'vue'

export type Placement =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

const props = withDefaults(
  defineProps<{
    placement?: Placement
    offset?: string | number
    top?: string | number
    right?: string | number
    bottom?: string | number
    left?: string | number
    inset?: boolean
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
    const o = toUnit(props.offset)!
    const [y, x] = props.placement.split('-') as [string, string]
    const s: Record<string, string | undefined> = {
      position: 'absolute',
      zIndex: props.zIndex != null ? String(props.zIndex) : undefined,
    }
    if (y === 'top') { s.top = o }
    else if (y === 'bottom') { s.bottom = o }
    else { s.top = '50%'; s.transform = 'translateY(-50%)' }

    if (x === 'left') { s.left = o }
    else if (x === 'right') { s.right = o }
    else {
      s.left = '50%'
      s.transform = s.transform ? 'translate(-50%, -50%)' : 'translateX(-50%)'
    }
    return s
  }

  return {
    position: 'absolute' as const,
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
