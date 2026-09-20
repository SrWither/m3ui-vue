<script setup lang="ts">
import { computed } from 'vue'
import MFab from './MFab.vue'
import MIcon from './MIcon.vue'

export interface FabMenuItem {
  icon: string
  label: string
  to?: string | Record<string, any>
  onClick?: () => void
  disabled?: boolean
  /** Overrides the menu's own `color` for just this row. */
  color?: 'primary' | 'secondary' | 'tertiary' | 'surface'
}

const props = withDefaults(
  defineProps<{
    icon: string
    /** Shows the trigger as an extended FAB (icon + text) instead of icon-only. */
    label?: string
    items: FabMenuItem[]
    color?: 'primary' | 'secondary' | 'tertiary' | 'surface'
    /** Trigger FAB size — independent from `itemSize` below. */
    size?: 'small' | 'regular' | 'large'
    /** Menu item row size — independent from the trigger FAB's own `size`. */
    itemSize?: 'small' | 'regular' | 'large'
    direction?: 'up' | 'down'
    align?: 'start' | 'end'
    scrim?: boolean
    persistent?: boolean
    disabled?: boolean
  }>(),
  {
    color: 'primary',
    size: 'regular',
    itemSize: 'large',
    direction: 'up',
    align: 'end',
    scrim: true,
    persistent: false,
    disabled: false,
  },
)

// Same role/container pairing MFab itself uses for its trigger, applied here
// to each menu item row — matches the real M3 FloatingActionButtonMenuItem,
// whose default container color is the color role's *Container, not a
// neutral surface tone.
const colorMap: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  surface: 'bg-surface-container-high text-primary',
}

// 'large' matches the real FabMenuBaselineTokens: 56dp row height (py-4 +
// 24px icon/line-height ≈ 56px), 24dp icon, 24dp horizontal padding, 8dp
// icon-label gap, titleMedium text — and is the default, matching M3.
const sizeClasses: Record<string, string> = {
  small: 'gap-2 px-3 py-2 text-label-medium',
  regular: 'gap-3 px-4 py-2.5 text-label-large',
  large: 'gap-2 px-6 py-4 text-title-medium',
}
const iconSize: Record<string, number> = { small: 18, regular: 20, large: 24 }

// Ported from androidx.compose.material3.FloatingActionButtonMenuItem: each
// row reveals via its own width growth + fade (no group-level scale, no
// circular mask), staggered starting from the item closest to the FAB.
// Reveal direction (which side the content wipes in from) follows `align`,
// same as which edge the whole menu is anchored to.
const revealClass = computed(() => (props.align === 'start' ? 'm3-fabmenu-item--from-start' : 'm3-fabmenu-item--from-end'))

function handleItemClick(item: FabMenuItem, close: () => void) {
  if (item.disabled) return
  if (!props.persistent) close()
  item.onClick?.()
}
</script>

<template>
  <MFab
    :icon="icon"
    :label="label"
    :color="color"
    :size="size"
    :direction="direction"
    :align="align"
    :scrim="scrim"
    :persistent="persistent"
    :disabled="disabled"
    content-transition="fade"
  >
    <template #content="{ close }">
      <TransitionGroup
        name="m3-fabmenu-item"
        tag="div"
        appear
        class="relative"
        :class="direction === 'up' ? 'flex flex-col-reverse gap-2' : 'flex flex-col gap-2'"
      >
        <component
          :is="item.to ? 'RouterLink' : 'button'"
          v-for="(item, i) in items"
          :key="i"
          :to="item.to || undefined"
          :type="item.to ? undefined : 'button'"
          class="m3-fabmenu-item shrink-0 cursor-pointer rounded-full font-medium shadow-elevation-3 transition-shadow duration-150 hover:shadow-elevation-4 disabled:cursor-not-allowed disabled:opacity-[0.38]"
          :class="[colorMap[item.color ?? color], revealClass]"
          :style="{ '--m3-fabmenu-delay': `${i * 35}ms` }"
          :disabled="item.disabled"
          @click="handleItemClick(item, close)"
        >
          <span class="m3-fabmenu-item-inner flex items-center whitespace-nowrap" :class="sizeClasses[itemSize]">
            <MIcon :name="item.icon" :size="iconSize[itemSize]" class="shrink-0" />
            {{ item.label }}
          </span>
        </component>
      </TransitionGroup>
    </template>
  </MFab>
</template>

<style scoped>
/* Two springs run together, per item, approximating the real component:
   - width (clip-path here, to avoid layout reflow) is roughly FastSpatial
     (dampingRatio 0.6, stiffness 800) — fast with a gentle bouncy overshoot.
   - opacity is roughly FastEffects (dampingRatio 1.0, stiffness 3800) —
     no bounce, a touch faster than the width settles.
   Staggered by --m3-fabmenu-delay on the way in, starting from the item
   closest to the FAB. Closing is a single simultaneous fade for every item
   instead of a reverse stagger — real M3 does stagger the close too, but
   that needs MFab's own panel-close timing to know each item's delay, which
   isn't worth the coupling; this keeps the two independent. */
.m3-fabmenu-item-inner {
  clip-path: inset(0 0 0 0%);
  transition: clip-path 220ms cubic-bezier(0.3, 1.2, 0.4, 1);
}
.m3-fabmenu-item-enter-active .m3-fabmenu-item-inner {
  transition-delay: var(--m3-fabmenu-delay, 0ms);
}
.m3-fabmenu-item-enter-active,
.m3-fabmenu-item-leave-active {
  transition: opacity 140ms ease-out;
}
.m3-fabmenu-item-enter-active {
  transition-delay: var(--m3-fabmenu-delay, 0ms);
}
.m3-fabmenu-item-enter-from,
.m3-fabmenu-item-leave-to {
  opacity: 0;
}
.m3-fabmenu-item--from-end.m3-fabmenu-item-enter-from .m3-fabmenu-item-inner,
.m3-fabmenu-item--from-end.m3-fabmenu-item-leave-to .m3-fabmenu-item-inner {
  clip-path: inset(0 0 0 100%);
}
.m3-fabmenu-item--from-start.m3-fabmenu-item-enter-from .m3-fabmenu-item-inner,
.m3-fabmenu-item--from-start.m3-fabmenu-item-leave-to .m3-fabmenu-item-inner {
  clip-path: inset(0 100% 0 0);
}
@media (prefers-reduced-motion: reduce) {
  .m3-fabmenu-item-inner,
  .m3-fabmenu-item-enter-active,
  .m3-fabmenu-item-leave-active {
    transition: none;
  }
}
</style>
