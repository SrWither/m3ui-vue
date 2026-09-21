<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'

export interface ShortNavBarItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    items: ShortNavBarItem[]
    /**
     * 'equal' (ShortNavigationBarArrangement.EqualWeight): items evenly fill the bar — recommended
     * for small-width screens. 'centered' (.Centered): items are grouped toward the center instead
     * of stretching edge to edge — recommended for medium-width screens, paired with iconPosition
     * 'start'. Real Compose computes this via a custom MeasurePolicy at layout time; ported here as
     * the same closed-form percentage formula (calculateCenteredContentHorizontalPadding), since it
     * only ever depends on the item count, not on measured content size.
     */
    arrangement?: 'equal' | 'centered'
    /** NavigationItemIconPosition — 'top' stacks icon above label (ShortNavigationBarItem's
     *  default); 'start' places the icon beside the label inside a single wider pill, meant for
     *  the 'centered' arrangement on wider/landscape layouts. */
    iconPosition?: 'top' | 'start'
  }>(),
  {
    arrangement: 'equal',
    iconPosition: 'top',
  },
)

defineEmits<{ 'update:modelValue': [string | number] }>()

// calculateCenteredContentHorizontalPadding: 3 items -> 20% each side, 4 -> 15%, 5 -> 10%,
// 6 -> 5%, 7+ -> 0. Matches the real formula verbatim: ((100 - 10*(n+3)) / 2) / 100.
const centeredPadding = computed(() => {
  const n = props.items.length
  if (props.arrangement !== 'centered' || n > 6) return 0
  return ((100 - 10 * (n + 3)) / 2)
})
</script>

<template>
  <nav
    class="flex h-16 w-full items-center border-t border-outline-variant bg-surface-container shadow-elevation-2"
    :style="arrangement === 'centered' ? { paddingLeft: `${centeredPadding}%`, paddingRight: `${centeredPadding}%` } : undefined"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="group flex flex-1 cursor-pointer items-center justify-center self-stretch transition-colors focus-visible:outline-none"
      :class="iconPosition === 'top' ? 'flex-col gap-1' : 'flex-row gap-1 py-1.5'"
      @click="$emit('update:modelValue', item.value)"
    >
      <template v-if="iconPosition === 'top'">
        <!-- Top icon position: 56x32dp pill above a separate label, matching MNavigationBar -->
        <span
          class="inline-flex h-8 items-center justify-center rounded-2xl transition-all duration-200"
          :class="
            item.value === modelValue
              ? 'w-14 bg-secondary-container text-on-secondary-container'
              : 'w-0 bg-secondary-container/0 text-on-surface-variant group-hover:w-14 group-hover:bg-on-surface/8'
          "
        >
          <MBadge v-if="item.badge != null" :count="item.badge">
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MBadge v-else-if="item.badgeDot" dot>
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MIcon v-else :name="item.icon" :size="24" />
        </span>
        <span
          class="text-label-medium font-medium"
          :class="item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant'"
        >
          {{ item.label }}
        </span>
      </template>

      <template v-else>
        <!-- Start icon position: one 40dp-tall pill wrapping icon+label together, 16dp
             leading/trailing padding (ActiveIndicatorLeadingSpace/TrailingSpace) — selected label
             uses the icon's own color here (OnSecondaryContainer), not the Top position's
             separate Secondary label color (ShortNavigationBarItemDefaults.colors() doc comment). -->
        <span
          class="inline-flex h-10 items-center justify-center gap-1 rounded-2xl px-4 transition-colors duration-200"
          :class="
            item.value === modelValue
              ? 'bg-secondary-container text-on-secondary-container'
              : 'text-on-surface-variant group-hover:bg-on-surface/8'
          "
        >
          <MBadge v-if="item.badge != null" :count="item.badge">
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MBadge v-else-if="item.badgeDot" dot>
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MIcon v-else :name="item.icon" :size="24" />
          <span class="text-label-medium font-medium">{{ item.label }}</span>
        </span>
      </template>
    </button>
  </nav>
</template>
