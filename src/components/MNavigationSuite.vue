<script setup lang="ts">
import { computed, ref } from 'vue'
import MNavigationRail from './MNavigationRail.vue'
import MShortNavigationBar from './MShortNavigationBar.vue'
import { useWindowSizeClass } from '../composables/useWindowSizeClass'

export interface NavigationSuiteItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
  disabled?: boolean
}

/** The navigation component in use: a short bar (icons over labels, or beside them), or a rail. */
export type NavigationSuiteLayout = 'bar' | 'bar-medium' | 'rail' | 'rail-expanded' | 'none'

const props = withDefaults(defineProps<{
  modelValue: string | number
  items: NavigationSuiteItem[]
  /**
   * 'auto' picks by the component's own size, as M3's NavigationSuiteScaffold does
   * (`navigationSuiteType`): compact width → short bar; compact height (a phone in landscape)
   * → short bar with icons beside labels; anything else → collapsed rail. Set it to force one.
   */
  layout?: 'auto' | NavigationSuiteLayout
}>(), { layout: 'auto' })

defineEmits<{ 'update:modelValue': [string | number] }>()

defineSlots<{
  /** The app's content. Scrolls on its own, next to or above the navigation. */
  default?: (props: { layout: NavigationSuiteLayout }) => unknown
  /** Primary action (e.g. a FAB): the rail's header, or floating above the bar at the bottom end. */
  fab?: () => unknown
}>()

const root = ref<HTMLElement>()
const { widthClass, heightClass } = useWindowSizeClass(root)

const resolved = computed<NavigationSuiteLayout>(() => {
  if (props.layout !== 'auto') return props.layout
  if (widthClass.value === 'compact') return 'bar'
  if (heightClass.value === 'compact') return 'bar-medium'
  return 'rail'
})
const isRail = computed(() => resolved.value === 'rail' || resolved.value === 'rail-expanded')
const isBar = computed(() => resolved.value === 'bar' || resolved.value === 'bar-medium')
</script>

<template>
  <div ref="root" class="flex overflow-hidden bg-surface" :class="isBar ? 'flex-col' : 'flex-row'">
    <!-- No default size: give it the app's height (e.g. h-dvh) so the bar sits at the bottom. -->
    <MNavigationRail
      v-if="isRail"
      :model-value="modelValue"
      :items="items"
      :expanded="resolved === 'rail-expanded'"
      class="shrink-0"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <template v-if="$slots.fab" #fab><slot name="fab" /></template>
    </MNavigationRail>

    <!-- Same element in every layout, so the content keeps its state when the navigation swaps. -->
    <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div class="min-h-0 flex-1 overflow-auto">
        <slot :layout="resolved" />
      </div>
      <div v-if="!isRail && $slots.fab" class="absolute right-4 bottom-4">
        <slot name="fab" />
      </div>
    </div>

    <MShortNavigationBar
      v-if="isBar"
      :model-value="modelValue"
      :items="items"
      :arrangement="resolved === 'bar-medium' ? 'centered' : 'equal'"
      :icon-position="resolved === 'bar-medium' ? 'start' : 'top'"
      class="shrink-0"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>
