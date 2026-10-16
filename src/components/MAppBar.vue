<script setup lang="ts">
/**
 * A simple, generic slot-based app bar with leading, default, and trailing areas — a lighter-weight alternative
 * to MTopAppBar for when you don't need its variant/title-row layouts.
 *
 * @slot leading Leading area (e.g. back button, menu icon)
 * @slot default Main content (title text)
 * @slot trailing Trailing action buttons
 */
withDefaults(defineProps<{
  /** Background color */
  color?: 'surface' | 'primary' | 'secondary' | 'tertiary'
  /** Add shadow elevation */
  elevated?: boolean
  /** Compact height (48px vs 64px) */
  dense?: boolean
  /** Add a bottom border (border-outline-variant) */
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
    class="w-full transition-shadow"
    :class="[
      colorMap[color],
      elevated ? 'shadow-elevation-2' : '',
      bordered ? 'border-b border-outline-variant' : '',
    ]"
  >
    <div
      class="flex items-center gap-2 px-4"
      :class="dense ? 'h-12' : 'h-16'"
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
  </div>
</template>
