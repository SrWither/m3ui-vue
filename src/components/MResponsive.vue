<script setup lang="ts">
/**
 * Shows or hides content at specific breakpoints using pure CSS (Tailwind's `hidden`/`block` utilities) — no JS
 * resize listener.
 *
 * @slot default Content.
 */
import { computed } from 'vue'

type Breakpoint = 'sm-up' | 'md-up' | 'lg-up' | 'xl-up' | 'sm-down' | 'md-down' | 'lg-down' | 'xl-down'

const props = withDefaults(
  defineProps<{
    /** Show content only at this breakpoint range */
    show?: Breakpoint
    /** Hide content at this breakpoint range */
    hide?: Breakpoint
    /** HTML tag to render */
    tag?: string
  }>(),
  { tag: 'div' },
)

const showClasses: Record<string, string> = {
  'sm-up': 'hidden sm:block',
  'md-up': 'hidden md:block',
  'lg-up': 'hidden lg:block',
  'xl-up': 'hidden xl:block',
  'sm-down': 'block sm:hidden',
  'md-down': 'block md:hidden',
  'lg-down': 'block lg:hidden',
  'xl-down': 'block xl:hidden',
}

const hideClasses: Record<string, string> = {
  'sm-up': 'block sm:hidden',
  'md-up': 'block md:hidden',
  'lg-up': 'block lg:hidden',
  'xl-up': 'block xl:hidden',
  'sm-down': 'hidden sm:block',
  'md-down': 'hidden md:block',
  'lg-down': 'hidden lg:block',
  'xl-down': 'hidden xl:block',
}

const classes = computed(() => {
  if (props.show) return showClasses[props.show]
  if (props.hide) return hideClasses[props.hide]
  return ''
})
</script>

<template>
  <component :is="tag" :class="classes">
    <slot />
  </component>
</template>
