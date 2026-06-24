<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'docked' | 'floating'
  orientation?: 'horizontal' | 'vertical'
  color?: 'surface' | 'primary' | 'secondary' | 'tertiary'
  fabPosition?: 'start' | 'end' | 'none'
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
        isVertical ? 'flex-col py-3 px-2' : 'flex-row px-3 py-2',
        alignClass,
        colorClasses,
        variant === 'floating' ? 'rounded-2xl shadow-elevation-2' : '',
        variant === 'docked' ? 'w-full border-t border-outline-variant' : '',
        variant === 'docked' && isVertical ? 'h-full w-auto border-t-0 border-r border-outline-variant' : '',
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
