<script setup lang="ts">
import { computed, provide } from 'vue'

const props = withDefaults(
  defineProps<{
    dense?: boolean
    dividers?: boolean | 'inset'
    nav?: boolean
    segmented?: boolean
    selectable?: boolean
    selected?: string | number | null
    lines?: 1 | 2 | 3
  }>(),
  { dense: false, dividers: false, nav: false, segmented: false, selectable: false },
)

const emit = defineEmits<{
  'update:selected': [value: string | number | null]
}>()

provide('m-list', {
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
  props.segmented ? 'gap-2 p-2' : 'py-2',
  props.nav && !props.segmented && 'gap-0.5 px-3',
])
</script>

<template>
  <ul role="list" :class="classes">
    <slot />
  </ul>
</template>
