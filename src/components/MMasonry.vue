<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    cols?: number
    smCols?: number
    mdCols?: number
    lgCols?: number
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { cols: 2, gap: 'md' },
)

const gapPx: Record<string, number> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

const containerRef = ref<HTMLElement | null>(null)
const activeCols = ref(props.cols)

function getActiveCols() {
  const w = window.innerWidth
  if (props.lgCols && w >= 1024) return props.lgCols
  if (props.mdCols && w >= 768) return props.mdCols
  if (props.smCols && w >= 640) return props.smCols
  return props.cols
}

const slots = useSlots()

function layout() {
  activeCols.value = getActiveCols()
  const container = containerRef.value
  if (!container) return

  const gap = gapPx[props.gap]
  const cols = activeCols.value
  const children = Array.from(container.children) as HTMLElement[]

  const colWidth = (container.clientWidth - gap * (cols - 1)) / cols
  const colHeights = new Array(cols).fill(0)

  for (const child of children) {
    const shortest = colHeights.indexOf(Math.min(...colHeights))
    const x = shortest * (colWidth + gap)
    const y = colHeights[shortest]

    child.style.position = 'absolute'
    child.style.left = `${x}px`
    child.style.top = `${y}px`
    child.style.width = `${colWidth}px`

    colHeights[shortest] += child.offsetHeight + gap
  }

  container.style.height = `${Math.max(...colHeights) - gap}px`
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(layout)
  resizeObserver = new ResizeObserver(layout)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
  window.addEventListener('resize', layout)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', layout)
})

watch(() => [props.cols, props.smCols, props.mdCols, props.lgCols, props.gap], () => nextTick(layout))
watch(() => slots.default?.(), () => nextTick(layout), { flush: 'post' })
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <slot />
  </div>
</template>
