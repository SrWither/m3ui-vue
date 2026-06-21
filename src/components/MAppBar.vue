<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'surface' | 'primary' | 'secondary' | 'tertiary'
  elevated?: boolean
  dense?: boolean
  bordered?: boolean
}>(), { color: 'surface' })

const colorMap: Record<string, string> = {
  surface:   'bg-surface text-on-surface',
  primary:   'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  tertiary:  'bg-tertiary text-on-tertiary',
}
</script>

<template>
  <div
    class="flex w-full items-center gap-2 px-4 transition-shadow"
    :class="[
      colorMap[color],
      elevated ? 'shadow-elevation-2' : '',
      bordered ? 'border-b border-outline-variant' : '',
      dense ? 'h-12' : 'h-16',
    ]"
  >
    <!-- Leading -->
    <div v-if="$slots.leading" class="flex shrink-0 items-center">
      <slot name="leading" />
    </div>

    <!-- Content -->
    <div class="flex flex-1 items-center overflow-hidden">
      <slot />
    </div>

    <!-- Trailing -->
    <div v-if="$slots.trailing" class="flex shrink-0 items-center gap-1">
      <slot name="trailing" />
    </div>
  </div>
</template>
