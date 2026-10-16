<script setup lang="ts">
/**
 * Page footer with slots for brand, content, social links, and a bottom bar. Responsive padding adapts to
 * screen size.
 *
 * @slot brand Logo and tagline area (top)
 * @slot default Main content area (navigation columns, etc.)
 * @slot social Social media icon buttons (flex row with gap)
 * @slot bottom Bottom bar with copyright / legal links (separated by a top border)
 */
withDefaults(defineProps<{
  /** Add a top border (border-outline-variant) */
  bordered?: boolean
  /** Background surface color */
  surface?: 'default' | 'container' | 'container-low' | 'container-high' | 'inverse'
}>(), {
  surface: 'default',
})

const surfaceClasses: Record<string, string> = {
  default: 'bg-surface text-on-surface',
  container: 'bg-surface-container text-on-surface',
  'container-low': 'bg-surface-container-low text-on-surface',
  'container-high': 'bg-surface-container-high text-on-surface',
  inverse: 'bg-inverse-surface text-inverse-on-surface',
}
</script>

<template>
  <footer
    class="w-full"
    :class="[
      surfaceClasses[surface],
      bordered ? 'border-t border-outline-variant' : '',
    ]"
  >
    <!-- Brand -->
    <div v-if="$slots.brand" class="px-6 pt-6 pb-2 sm:px-8 lg:px-12">
      <slot name="brand" />
    </div>

    <!-- Main content -->
    <div v-if="$slots.default" class="px-6 py-6 sm:px-8 lg:px-12">
      <slot />
    </div>

    <!-- Social -->
    <div v-if="$slots.social" class="flex flex-wrap items-center gap-1 px-6 pb-4 sm:px-8 lg:px-12">
      <slot name="social" />
    </div>

    <!-- Bottom bar -->
    <div
      v-if="$slots.bottom"
      class="border-t border-outline-variant px-6 py-4 sm:px-8 lg:px-12"
    >
      <slot name="bottom" />
    </div>
  </footer>
</template>
