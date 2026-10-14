<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MBottomSheet from './MBottomSheet.vue'
import { useWindowSizeClass } from '../composables/useWindowSizeClass'

/*
 * M3 supporting-pane canonical layout, after androidx SupportingPaneScaffold: from the
 * expanded width class (840px) up, the supporting pane sits beside the main one with a 24dp
 * spacer at its preferred width (360dp, 412dp from large). Below that, its default adapt
 * strategy is `Reflow(Main)`: it moves under the main pane ('below' here). 'sheet' follows
 * the `Levitate` bottom-sheet sample instead: hidden until opened, then in a bottom sheet.
 * Measured on the component itself, not the window.
 */
const props = withDefaults(defineProps<{
  /** Where the supporting pane goes when there's room for only one pane. */
  singlePane?: 'below' | 'sheet'
  /** With `singlePane="sheet"`: whether the sheet is open (v-model:open). */
  open?: boolean
  /** With `singlePane="sheet"`: the sheet's title. */
  sheetTitle?: string
  /** Supporting pane width in the two-pane layout. Defaults to M3's 360px (412px from the large width class). */
  supportingWidth?: string
}>(), { singlePane: 'below', open: false })

const emit = defineEmits<{ 'update:open': [boolean] }>()

defineSlots<{
  main?: (props: { twoPane: boolean }) => unknown
  supporting?: (props: { twoPane: boolean }) => unknown
}>()

const root = ref<HTMLElement>()
const { widthClass } = useWindowSizeClass(root)
const twoPane = computed(() => widthClass.value !== 'compact' && widthClass.value !== 'medium')
const width = computed(() =>
  props.supportingWidth ?? (widthClass.value === 'large' || widthClass.value === 'extra-large' ? '412px' : '360px'),
)
const inSheet = computed(() => !twoPane.value && props.singlePane === 'sheet')
// Once the pane fits beside the main one, an open sheet would pop back up on the next narrowing.
watch(twoPane, (two) => {
  if (two && props.open) emit('update:open', false)
})
</script>

<template>
  <div ref="root" class="flex gap-6" :class="twoPane ? 'overflow-hidden' : 'flex-col overflow-y-auto'">
    <!--
      Two panes: each scrolls on its own (give the component a height). One pane, 'below': the
      whole thing scrolls as a single column.
    -->
    <div class="min-w-0" :class="twoPane ? 'min-h-0 flex-1 overflow-auto' : 'shrink-0'">
      <slot name="main" :two-pane="twoPane" />
    </div>
    <div
      v-if="!inSheet"
      :class="twoPane ? 'min-h-0 shrink-0 overflow-auto' : 'shrink-0'"
      :style="twoPane ? { width } : undefined"
    >
      <slot name="supporting" :two-pane="twoPane" />
    </div>
    <MBottomSheet
      v-else
      :model-value="open"
      :title="sheetTitle"
      @update:model-value="emit('update:open', $event)"
    >
      <slot name="supporting" :two-pane="false" />
    </MBottomSheet>
  </div>
</template>
