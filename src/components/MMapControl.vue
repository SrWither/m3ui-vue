<script setup lang="ts">
/**
 * Your own control in a corner of an `MMap`, stacked with MapLibre's (zoom, geolocate…) in that corner. With `group`
 * (the default) it's a control group like the zoom buttons: put `<button>`s with a Material Symbols icon in it and
 * they get the same M3 look. Without it, anything goes (an `MFab`, an `MSearchBar`, a card). With a `#panel` slot it
 * expands in place: a button in it calls `toggle` and the control grows into a panel with your content (a layer
 * picker, filters, a legend), and back. Its size springs whenever its content changes size, so the other controls in
 * the corner move along instead of jumping. Available from the `/map` entry point.
 *
 * @slot default The control's content; `{ expanded, toggle }` when it has a `#panel`
 * @slot panel What the control expands into (`v-model:expanded`); `{ close }`. Escape or a press outside it closes it
 * @event update:expanded Emitted when the panel opens or closes — powers v-model:expanded
 */
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { motionSprings } from '../composables/motion'
import { playSamples, prefersReducedMotion, sampleAt, sampleSpring } from '../composables/_springAnimation'
import type { MapControlPosition } from './MMap.vue'

// Attributes (class, style…) go on what's shown on the map, not on the hidden wrapper it's rendered in
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The corner */
    position?: MapControlPosition
    /** Draw it as a control group (a surface with dividers between buttons), like MapLibre's zoom buttons */
    group?: boolean
    /** Expanded into its `#panel` (v-model:expanded) */
    expanded?: boolean
    /** Springs the control's size when its content changes size (expanding, or anything else) */
    animate?: boolean
  }>(),
  { position: 'top-right', group: true, expanded: false, animate: true },
)

const emit = defineEmits<{ 'update:expanded': [boolean] }>()
const slots = useSlots()

const el = ref<HTMLElement>()
const { onReady } = useMap()

// ── Expanding into the panel ────────────────────────────────────────────────────────────────────────────
const open = ref(props.expanded)
watch(() => props.expanded, (v) => { open.value = v })
const showPanel = computed(() => open.value && !!slots.panel)
function setOpen(v: boolean) {
  if (v === open.value) return
  open.value = v
  emit('update:expanded', v)
}
const toggle = () => setOpen(!open.value)
const close = () => setOpen(false)

function onOutside(e: PointerEvent) {
  if (showPanel.value && !el.value?.contains(e.target as Node)) close()
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showPanel.value) {
    close()
    e.stopPropagation()
  }
}

// ── Size: a spring between the old and the new size whenever the content resizes (Standard DefaultSpatial).
// The new layout is already there when the ResizeObserver reports it, before it paints, so the animation starts
// from the old size without a flash; the content is clipped while it runs. Width/height can't run on the
// compositor, but a control is small. ──────────────────────────────────────────────────────────────────────
let size: { w: number; h: number } | null = null
let anim: Animation | null = null
let samples: number[] = []
let from = { w: 0, h: 0 }
let to = { w: 0, h: 0 }
let observer: ResizeObserver | null = null

function measure(): { w: number; h: number } {
  return { w: el.value!.offsetWidth, h: el.value!.offsetHeight }
}

function onResize() {
  const node = el.value
  if (!node || anim) return
  const next = measure()
  if (size && (next.w !== size.w || next.h !== size.h) && props.animate && !prefersReducedMotion()) grow(node, size, next)
  size = next
}

function grow(node: HTMLElement, a: { w: number; h: number }, b: { w: number; h: number }) {
  from = a
  to = b
  samples = sampleSpring(0, 1, 0, motionSprings.standard.defaultSpatial, 0.002)
  node.style.overflow = 'hidden'
  const lerp = (p: number) => ({ width: `${a.w + (b.w - a.w) * p}px`, height: `${a.h + (b.h - a.h) * p}px` })
  anim = playSamples(node, samples, lerp)
  if (!anim) return finish(node)
  anim.onfinish = () => finish(node)
}

function finish(node: HTMLElement) {
  anim?.cancel()
  anim = null
  node.style.overflow = ''
  // The content may have changed size again while it ran
  const now = measure()
  if (now.w !== to.w || now.h !== to.h) {
    size = to
    onResize()
  } else size = now
}

// A size change while it runs (closed mid-opening) starts from where it is, not from the old size
function retarget() {
  const node = el.value
  if (!node || !anim) return
  const p = sampleAt(samples, anim.currentTime)
  const at = { w: from.w + (to.w - from.w) * p, h: from.h + (to.h - from.h) * p }
  anim.onfinish = null
  anim.cancel()
  anim = null
  size = at
  onResize()
}
watch(showPanel, retarget, { flush: 'post' })

let map: Maplibre.Map | undefined
// MapLibre's IControl: the element it places in the corner
const control: Maplibre.IControl = {
  onAdd: () => el.value!,
  onRemove: () => el.value?.remove(),
}

onReady((m) => {
  map = m
  if (el.value) m.addControl(control, props.position)
})

watch(() => props.position, (position) => {
  if (!map || !el.value) return
  map.removeControl(control)
  map.addControl(control, position)
})

onMounted(() => {
  document.addEventListener('pointerdown', onOutside, true)
  if (typeof ResizeObserver === 'undefined' || !el.value) return
  observer = new ResizeObserver(onResize)
  observer.observe(el.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true)
  observer?.disconnect()
  anim?.cancel()
  if (map?.hasControl(control)) map.removeControl(control)
})
</script>

<template>
  <!-- Moved into the map's corner by MapLibre -->
  <div class="hidden">
    <div
      ref="el"
      class="maplibregl-ctrl m3-map-control"
      :class="showPanel ? 'm3-map-control-panel' : group ? 'maplibregl-ctrl-group' : ''"
      v-bind="$attrs"
      @keydown="onKeyDown"
    >
      <div v-if="showPanel" class="m3-map-control-panel-in">
        <slot name="panel" :close="close" />
      </div>
      <slot v-else :expanded="open" :toggle="toggle" />
    </div>
  </div>
</template>
