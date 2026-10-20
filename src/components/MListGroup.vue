<script setup lang="ts">
/**
 * A group of items inside an MList, optionally titled. In a segmented list each group is a rounded run of its
 * own (its first and last items take the large outer corners), set apart from the items and groups around it,
 * like the grouped cards of a settings screen. Elsewhere it only groups and titles its items. Assistive
 * technology announces it as a nested list named by its title.
 *
 * @slot default MListItem children
 * @slot title Custom title content, replacing the title prop
 */
import { computed, inject, provide, ref, useId, type ComputedRef } from 'vue'
import { useSegmentRuns } from '../composables/_useSegmentRuns'

withDefaults(
  defineProps<{
    /** Heading above the group, styled like MListSubheader */
    title?: string
    /** Align the title with items that have a leading icon (adds left padding) */
    inset?: boolean
  }>(),
  { inset: false },
)

// Same context as MList's, with the group's own runs: its items are measured against each other, not the list
const parent = inject<({ segmented: ComputedRef<boolean>; nav: ComputedRef<boolean> } & Record<string, unknown>) | null>('m-list', null)
const groupEl = ref<HTMLElement>()
const segmentPosition = useSegmentRuns(groupEl)
if (parent) provide('m-list', { ...parent, segmentPosition })

const segmented = computed(() => parent?.segmented.value ?? false)
const nav = computed(() => parent?.nav.value ?? false)
const titleId = `m3-list-group-${useId()}`
</script>

<template>
  <li role="none" class="m3-list-group flex flex-col" :class="segmented && 'm3-list-group-segmented'">
    <div
      v-if="title || $slots.title"
      :id="titleId"
      class="px-4 pb-2 text-label-medium font-medium text-on-surface-variant"
      :class="[segmented ? 'pt-2' : 'pt-4', inset && 'pl-16']"
    >
      <slot name="title">{{ title }}</slot>
    </div>
    <ul
      ref="groupEl"
      role="list"
      :aria-labelledby="title || $slots.title ? titleId : undefined"
      class="flex flex-col"
      :class="(segmented || nav) && 'gap-0.5'"
    >
      <slot />
    </ul>
  </li>
</template>

<style>
/* Segmented: 10px plus the list's 2dp gap sets a group apart from what comes before and after it.
   In the components layer so a consumer's margin utility still wins. */
@layer components {
  .m3-list-group-segmented:not(:first-child),
  .m3-list-group-segmented + li[role='listitem'] {
    margin-top: 10px;
  }
}
</style>
