<script setup lang="ts">
/**
 * A vertical list container (MList) with rich, flexible rows (MListItem) and optional section headers
 * (MListSubheader) — one-line to three-line items, leading/trailing elements, selection, navigation, segmented,
 * and expandable variants.
 *
 * @slot default MListItem / MListSubheader children
 * @event update:selected Fires when a selectable item is clicked (via v-model:selected)
 */
import { computed, onMounted, onUnmounted, provide, ref, shallowRef } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Compact vertical padding on child items */
    dense?: boolean
    /** Show separators between items — 'inset' aligns the line past a leading icon/avatar */
    dividers?: boolean | 'inset'
    /** Navigation variant with rounded (pill) active items, ideal for drawers */
    nav?: boolean
    /** Segmented style — items each get an individual rounded background instead of a flat list */
    segmented?: boolean
    /** Enable single-item selection — items compare their value prop against selected */
    selectable?: boolean
    /** Currently selected item value (v-model:selected) */
    selected?: string | number | null
    /** Default line count for child items that don't set their own lines prop */
    lines?: 1 | 2 | 3
  }>(),
  { dense: false, dividers: false, nav: false, segmented: false, selectable: false },
)

const emit = defineEmits<{
  'update:selected': [value: string | number | null]
}>()

// Segmented items need to know whether they open or close their run of items (SegmentedListItem's
// segmentedShapes(index, count)). A subheader or any other non-item child starts a new run.
const listEl = ref<HTMLElement>()
const positions = shallowRef(new Map<Element, 'single' | 'first' | 'middle' | 'last'>())
function measure() {
  const map = new Map<Element, 'single' | 'first' | 'middle' | 'last'>()
  let run: Element[] = []
  const flush = () => {
    run.forEach((el, i) => map.set(el, run.length === 1 ? 'single' : i === 0 ? 'first' : i === run.length - 1 ? 'last' : 'middle'))
    run = []
  }
  for (const child of listEl.value?.children ?? []) {
    if (child.getAttribute('role') === 'listitem') run.push(child)
    else flush()
  }
  flush()
  positions.value = map
}
let observer: MutationObserver | undefined
onMounted(() => {
  measure()
  if (listEl.value) {
    observer = new MutationObserver(measure)
    observer.observe(listEl.value, { childList: true })
  }
})
onUnmounted(() => observer?.disconnect())

provide('m-list', {
  segmentPosition: (el: Element | null | undefined) => (el ? positions.value.get(el) : undefined),
  dense: computed(() => props.dense),
  nav: computed(() => props.nav),
  segmented: computed(() => props.segmented),
  selectable: computed(() => props.selectable),
  selected: computed(() => props.selected),
  dividers: computed(() => props.dividers),
  lines: computed(() => props.lines),
  select: (value: string | number) => emit('update:selected', value),
})

const classes = computed(() => [
  'flex flex-col',
  // ListTokens.SegmentedGap = 2dp
  props.segmented ? 'gap-0.5 p-2' : 'py-2',
  props.nav && !props.segmented && 'gap-0.5 px-3',
])
</script>

<template>
  <ul ref="listEl" role="list" :class="classes">
    <slot />
  </ul>
</template>
