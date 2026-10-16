<script setup lang="ts">
/**
 * A container for grouping icon buttons and actions — docked to an edge or floating as a rounded pill,
 * horizontal or vertical, with an optional paired FAB.
 *
 * @slot fab A FAB rendered alongside the toolbar body, positioned by fabPosition
 * @slot default Toolbar items — typically MIconButton/MButton, separated with MDivider
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Docked (edge-attached, full width/height, bordered) or floating (rounded pill with shadow) */
  variant?: 'docked' | 'floating'
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical'
  /** Background color scheme */
  color?: 'surface' | 'primary' | 'secondary' | 'tertiary'
  /** Where the #fab slot renders relative to the toolbar body */
  fabPosition?: 'start' | 'end' | 'none'
  /** Item alignment along the main axis */
  align?: 'start' | 'center' | 'end' | 'between'
}>(), {
  variant: 'docked',
  orientation: 'horizontal',
  color: 'surface',
  fabPosition: 'none',
  align: 'center',
})

const colorClasses = computed(() => {
  const map: Record<string, string> = {
    surface: 'bg-surface-container text-on-surface',
    primary: 'bg-primary-container text-on-primary-container',
    secondary: 'bg-secondary-container text-on-secondary-container',
    tertiary: 'bg-tertiary-container text-on-tertiary-container',
  }
  return map[props.color] ?? map.surface
})

const alignClass = computed(() => {
  const map: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  }
  return map[props.align] ?? 'justify-center'
})

const isVertical = computed(() => props.orientation === 'vertical')
</script>

<template>
  <div
    class="flex items-center gap-2"
    :class="[
      isVertical ? 'flex-col' : 'flex-row',
      fabPosition === 'start' && !isVertical ? 'flex-row' : '',
      fabPosition === 'start' && isVertical ? 'flex-col' : '',
    ]"
  >
    <!-- FAB start -->
    <div v-if="$slots.fab && fabPosition === 'start'" class="shrink-0">
      <slot name="fab" />
    </div>

    <!-- Toolbar body -->
    <div
      class="flex items-center gap-1"
      :class="[
        isVertical ? 'flex-col w-16' : 'flex-row h-16',
        isVertical ? (variant === 'floating' ? 'py-2' : 'py-4') : (variant === 'floating' ? 'px-2' : 'px-4'),
        alignClass,
        colorClasses,
        variant === 'floating' ? 'rounded-full' : '',
        variant === 'floating' && fabPosition !== 'none' ? 'shadow-elevation-1' : '',
        variant === 'docked' ? 'w-full border-t border-outline-variant' : '',
        variant === 'docked' && isVertical ? 'h-full w-16 border-t-0 border-r border-outline-variant' : '',
      ]"
    >
      <slot />
    </div>

    <!-- FAB end -->
    <div v-if="$slots.fab && fabPosition === 'end'" class="shrink-0">
      <slot name="fab" />
    </div>
  </div>
</template>
