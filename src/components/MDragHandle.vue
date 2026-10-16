<script setup lang="ts">
/**
 * M3's drag handle: the capsule users drag to resize or move something, e.g. the divider between two panes.
 * Port of Compose's `VerticalDragHandle`; it only draws the handle and its pressed/dragged look, the dragging
 * itself is up to the parent (MSplitter uses it).
 */
import { computed, ref, watch } from 'vue'
import { FAST_SPATIAL, useSpring } from '../composables/_useSpring'

const props = withDefaults(defineProps<{
  /** `vertical` is a tall capsule for horizontal drags (between side-by-side panes); `horizontal` is a wide one for vertical drags. */
  orientation?: 'vertical' | 'horizontal'
  /** Show the dragged look (the parent is dragging) */
  dragging?: boolean
}>(), { orientation: 'vertical', dragging: false })

const pressed = ref(false)

// DragHandleTokens: 4×48dp CornerFull in Outline at rest; 12×52dp CornerMedium in OnSurface pressed or
// dragged (CornerMedium is 12dp, which on a 12dp-wide bar is still a pill). ContainerWidth (24dp) is the
// touch area. VerticalDragHandle switches sizes instantly; this springs between them (Standard FastSpatial,
// like the library's other shape changes) and fades the color, a deliberate departure.
const active = computed(() => props.dragging || pressed.value)
const barEl = ref<HTMLElement | null>(null)
const { snap } = useSpring(
  () => (active.value ? [12, 52] : [4, 48]),
  ([thick, long]) => {
    if (!barEl.value) return
    const vertical = props.orientation === 'vertical'
    barEl.value.style.width = `${vertical ? thick : long}px`
    barEl.value.style.height = `${vertical ? long : thick}px`
  },
  FAST_SPATIAL,
)
// Same sizes, other axis: redraw
watch(() => props.orientation, () => snap())
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center"
    :class="orientation === 'vertical' ? 'h-13 w-6' : 'h-6 w-13'"
    @pointerdown="pressed = true"
    @pointerup="pressed = false"
    @pointerleave="pressed = false"
    @pointercancel="pressed = false"
  >
    <span
      ref="barEl"
      class="block rounded-full transition-colors duration-150"
      :class="active ? 'bg-on-surface' : 'bg-outline'"
    />
  </span>
</template>
