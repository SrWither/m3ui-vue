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
    size?: 'small' | 'medium' | 'large'
    to?: string | Record<string, any>
  }>(),
  {
    variant: 'filled',
    color: 'primary',
    type: 'button',
    disabled: false,
    loading: false,
    size: 'medium',
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

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-full font-medium ' +
  'whitespace-nowrap overflow-hidden transition-[box-shadow,background-color,color] duration-150 select-none cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-[0.38] disabled:shadow-none ' +
  "before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]'

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'small': return 'h-8 text-label-medium'
    case 'large': return 'h-12 text-label-large'
    default: return 'h-10 text-label-large'
  }
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'small': return 16
    case 'large': return 22
    default: return 20
  }
})

const spinnerSize = computed(() => {
  switch (props.size) {
    case 'small': return 14
    case 'large': return 20
    default: return 18
  }
})

const px = computed(() => {
  if (props.variant === 'text') return props.size === 'small' ? 'px-2' : 'px-3'
  switch (props.size) {
    case 'small': return 'px-4'
    case 'large': return 'px-8'
    default: return 'px-6'
  }
})

const variantClasses = computed(() => {
  const err = isError.value
  switch (props.variant) {
    case 'filled':
      return err
        ? 'bg-error text-on-error enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
        : 'bg-primary text-on-primary enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
    case 'tonal':
      return err
        ? 'bg-error-container text-on-error-container enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
        : 'bg-secondary-container text-on-secondary-container enabled:hover:shadow-elevation-1 enabled:active:shadow-none'
    case 'elevated':
      return err
        ? 'bg-surface-container-low text-error shadow-elevation-1 enabled:hover:shadow-elevation-2'
        : 'bg-surface-container-low text-primary shadow-elevation-1 enabled:hover:shadow-elevation-2'
    case 'outlined':
      return err
        ? 'border border-error text-error'
        : 'border border-outline text-primary'
    case 'text':
      return err
        ? 'text-error'
        : 'text-primary'
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
    :class="[base, sizeClasses, px, variantClasses]"
    :style="customStyle"
    @pointerdown="createRipple"
  >
    <MSpinner v-if="loading" :size="spinnerSize" />
    <MIcon v-else-if="icon" :name="icon" :size="iconSize" />
    <slot />
  </component>
</template>
