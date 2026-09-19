<script setup lang="ts">
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'

export interface NavRailItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
  disabled?: boolean
}

withDefaults(defineProps<{
  modelValue: string | number
  items: NavRailItem[]
  alignment?: 'top' | 'center' | 'bottom'
  /** M3 `WideNavigationRail`'s expanded state: items become icon+label side by side in a full-width pill instead of icon-over-label in a narrow centered one. */
  expanded?: boolean
}>(), { alignment: 'top', expanded: false })

defineEmits<{ 'update:modelValue': [string | number] }>()
</script>

<template>
  <nav
    class="flex h-full flex-col border-r border-outline-variant bg-surface transition-[width] duration-200"
    :class="expanded ? 'w-[220px]' : 'w-20'"
  >
    <!--
      Header slot: menu-toggle button and/or FAB. Left-anchored (not `items-center`) inside
      a fixed 56px box, same technique as MNavigationDrawer's `.nd-toggle-inner` — `items-center`
      would re-center against the *header's own* width, which changes a lot between collapsed
      (80px rail) and expanded (220px rail), making the button visibly jump sideways when toggling.
      A fixed-width box pinned to the same left inset as the items below stays put regardless.
    -->
    <div v-if="$slots.fab" class="flex shrink-0 flex-col items-start gap-2 px-3 pt-3 pb-2">
      <div class="flex h-10 w-14 shrink-0 items-center justify-center">
        <slot name="fab" />
      </div>
    </div>

    <!-- Items -->
    <div
      class="flex flex-1 flex-col gap-1 px-3 py-3"
      :class="{
        'justify-start': alignment === 'top',
        'justify-center': alignment === 'center',
        'justify-end': alignment === 'bottom',
      }"
    >
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="group relative block h-16 w-full cursor-pointer focus-visible:outline-none"
        :class="item.disabled ? 'cursor-not-allowed opacity-[0.38]' : ''"
        :disabled="item.disabled"
        @click="!item.disabled && $emit('update:modelValue', item.value)"
      >
        <!--
          Row height is a constant 64dp (NavigationRailBaselineItemTokens.ContainerHeight)
          in BOTH modes so toggling `expanded` never reflows sibling items — only the pill
          and label (below) resize/reposition *within* that fixed-height row.

          Both the pill and the label always use fixed pixel offsets (top/left/padding),
          never percentage-based centering (top-1/2 + -translate-y-1/2, justify-center)
          — those resolve relative to the element's OWN size, which is also mid-transition,
          so mixing them with an animating width/height makes the icon appear to snap to a
          center point and drift as the box resizes, instead of a single clean interpolation.
          The pill is always left-anchored with a constant `pl-4`, so the icon's horizontal
          position never moves at all, only the pill's own width grows/shrinks around it.
        -->
        <span
          class="absolute left-0 inline-flex items-center pl-4 rounded-full transition-all duration-200"
          :class="[
            expanded ? 'top-1 h-14 w-full' : 'top-1.5 h-8 w-14',
            item.value === modelValue
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-transparent text-on-surface-variant group-hover:bg-on-surface/8',
          ]"
        >
          <MBadge v-if="item.badge != null" :count="item.badge">
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MBadge v-else-if="item.badgeDot" dot>
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MIcon v-else :name="item.icon" :size="24" />
        </span>

        <!-- Label, collapsed: stays put below the icon, just fades out when expanding -->
        <span
          class="pointer-events-none absolute left-0 top-[42px] w-14 truncate text-center text-label-medium font-medium transition-opacity duration-150"
          :class="[
            expanded ? 'opacity-0' : 'opacity-100',
            item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
          ]"
        >
          {{ item.label }}
        </span>

        <!--
          Label, expanded: anchored flush against the icon's right edge and revealed through
          an `overflow-hidden` wrapper whose width grows left-to-right, so the text reads as
          emerging out of the icon rather than fading in in place. Text itself never moves —
          only the clipping box's width animates, `whitespace-nowrap` keeps it from reflowing
          as that width changes. Opacity animates alongside width (not just width) so collapsing
          reads as fading out while it shrinks, rather than staying solid until the box clips it.
        -->
        <span
          class="pointer-events-none absolute left-12 top-[22px] overflow-hidden whitespace-nowrap text-left text-label-large font-medium transition-[width,opacity] duration-200"
          :class="[
            expanded ? 'w-[130px] opacity-100' : 'w-0 opacity-0',
            item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
          ]"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>
</template>
