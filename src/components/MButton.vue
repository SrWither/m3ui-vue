<script setup lang="ts">
import { computed } from 'vue'
import MSpinner from './MSpinner.vue'
import MIcon from './MIcon.vue'

const NAMED_COLORS = ['primary', 'error'] as const
type NamedColor = (typeof NAMED_COLORS)[number]

const props = withDefaults(
  defineProps<{
    variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated'
    /**
     * Named semantic color ('primary' | 'error') OR any CSS color string
     * ('red', '#e91e63', 'oklch(0.6 0.2 0)', …).
     * When a CSS color is passed, --color-primary is overridden for this button.
     */
    color?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    icon?: string
    to?: string | Record<string, any>
  }>(),
  {
    variant: 'filled',
    color: 'primary',
    type: 'button',
    disabled: false,
    loading: false,
  },
)

const tag = computed(() => props.to ? 'RouterLink' : 'button')

const isCustomColor = computed(
  () => !!props.color && !(NAMED_COLORS as readonly string[]).includes(props.color),
)

const customStyle = computed(() => {
  if (!isCustomColor.value) return undefined
  return {
    '--color-primary': props.color,
    '--color-on-primary': '#ffffff',
    '--color-primary-container': props.color + '33',
    '--color-on-primary-container': props.color,
  }
})

const isError = computed(() => props.color === 'error')

// State-layer overlay: before: pseudo-element uses currentColor (the button's text color)
// so it's always the correct M3 state-layer color for every variant automatically.
const base =
  'relative inline-flex items-center justify-center gap-2 h-10 rounded-full text-label-large font-medium ' +
  'whitespace-nowrap overflow-hidden transition-[box-shadow,background-color,color] duration-150 select-none cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-[0.38] disabled:shadow-none ' +
  "before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]'

const variantClasses = computed(() => {
  const err = isError.value
  switch (props.variant) {
    case 'filled':
      return err
        ? 'px-6 bg-error text-on-error enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
        : 'px-6 bg-primary text-on-primary enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
    case 'tonal':
      return err
        ? 'px-6 bg-error-container text-on-error-container enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
        : 'px-6 bg-secondary-container text-on-secondary-container enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
    case 'elevated':
      return err
        ? 'px-6 bg-surface-container-low text-error shadow-elevation-1 enabled:hover:shadow-elevation-2'
        : 'px-6 bg-surface-container-low text-primary shadow-elevation-1 enabled:hover:shadow-elevation-2'
    case 'outlined':
      return err
        ? 'px-6 border border-error text-error'
        : 'px-6 border border-outline text-primary'
    case 'text':
      return err
        ? 'px-3 text-error'
        : 'px-3 text-primary'
    default:
      return ''
  }
})

function createRipple(event: PointerEvent) {
  if (props.disabled || props.loading) return
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const el = document.createElement('span')
  el.className = 'm3-ripple'
  el.style.cssText = `width:${d}px;height:${d}px;top:${event.clientY - rect.top - d / 2}px;left:${event.clientX - rect.left - d / 2}px`
  button.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}
</script>

<template>
  <component
    :is="tag"
    :to="to || undefined"
    :type="to ? undefined : type"
    :disabled="disabled || loading"
    :class="[base, variantClasses]"
    :style="customStyle"
    @pointerdown="createRipple"
  >
    <MSpinner v-if="loading" :size="18" />
    <MIcon v-else-if="icon" :name="icon" :size="20" />
    <slot />
  </component>
</template>
