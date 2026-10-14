<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWindowSizeClass } from '../composables/useWindowSizeClass'

/*
 * M3 list-detail canonical layout, after androidx ListDetailPaneScaffold +
 * calculatePaneScaffoldDirective: from the expanded width class (840px) up, list and detail
 * sit side by side with a 24dp spacer and the list at its preferred width (360dp, 412dp from
 * large); below that only one pane shows, the detail when it's the current destination
 * (`showDetail`), the list otherwise. Measured on the component itself, not the window.
 */
const props = withDefaults(defineProps<{
  /** Whether the detail is the current destination. One-pane layouts show it instead of the list. */
  showDetail?: boolean
  /** List pane width in the two-pane layout. Defaults to M3's 360px (412px from the large width class). */
  listWidth?: string
}>(), { showDetail: false })

const emit = defineEmits<{ 'update:showDetail': [boolean] }>()

defineSlots<{
  list?: (props: { twoPane: boolean }) => unknown
  /** `back()` returns to the list (sets `showDetail` to false). */
  detail?: (props: { twoPane: boolean; back: () => void }) => unknown
}>()

const root = ref<HTMLElement>()
const { widthClass } = useWindowSizeClass(root)
const twoPane = computed(() => widthClass.value !== 'compact' && widthClass.value !== 'medium')
const width = computed(() =>
  props.listWidth ?? (widthClass.value === 'large' || widthClass.value === 'extra-large' ? '412px' : '360px'),
)
const back = () => emit('update:showDetail', false)

// One pane: both stay mounted (the list keeps its scroll position and the detail its state),
// the hidden one is moved aside, made invisible and `inert`.
const listHidden = computed(() => !twoPane.value && props.showDetail)
const detailHidden = computed(() => !twoPane.value && !props.showDetail)
</script>

<template>
  <div ref="root" class="relative flex overflow-hidden" :class="twoPane ? 'gap-6' : ''">
    <!-- No default size: give it a height so each pane scrolls on its own. -->
    <div
      class="min-h-0 overflow-auto"
      :class="twoPane ? 'shrink-0' : ['m3-ld-pane absolute inset-0', listHidden && 'm3-ld-list-hidden']"
      :style="twoPane ? { width } : undefined"
      :inert="listHidden || undefined"
      :aria-hidden="listHidden || undefined"
    >
      <slot name="list" :two-pane="twoPane" />
    </div>
    <div
      class="min-h-0 min-w-0 flex-1 overflow-auto"
      :class="twoPane ? '' : ['m3-ld-pane absolute inset-0', detailHidden && 'm3-ld-detail-hidden']"
      :inert="detailHidden || undefined"
      :aria-hidden="detailHidden || undefined"
    >
      <slot name="detail" :two-pane="twoPane" :back="back" />
    </div>
  </div>
</template>

<style scoped>
/* Visibility flips at the end of a hide (and at the start of a show) so the pane fades out first. */
.m3-ld-pane {
  transition:
    transform 0.4s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.2s linear,
    visibility 0s;
}
.m3-ld-list-hidden {
  transform: translateX(-12%);
  opacity: 0;
  visibility: hidden;
  transition:
    transform 0.4s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.2s linear,
    visibility 0s 0.4s;
}
.m3-ld-detail-hidden {
  transform: translateX(100%);
  opacity: 0;
  visibility: hidden;
  transition:
    transform 0.4s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.2s linear 0.2s,
    visibility 0s 0.4s;
}
:global([dir='rtl']) .m3-ld-list-hidden {
  transform: translateX(12%);
}
:global([dir='rtl']) .m3-ld-detail-hidden {
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .m3-ld-pane,
  .m3-ld-list-hidden,
  .m3-ld-detail-hidden {
    transition: visibility 0s;
  }
}
</style>
