<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    icon: string
    label?: string
    variant?: 'standard' | 'filled' | 'tonal' | 'outlined'
    shape?: 'rounded' | 'squared'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
    disabled?: boolean
    to?: string | Record<string, any>
  }>(),
  {
    variant: 'standard',
    shape: 'rounded',
    size: 'sm',
    disabled: false,
  },
)

const tag = computed(() => props.to ? 'RouterLink' : 'button')

const sizeMap = {
  xs: { px: 32, icon: 16 },
  sm: { px: 40, icon: 20 },
  md: { px: 48, icon: 24 },
  lg: { px: 56, icon: 28 },
  xl: { px: 64, icon: 32 },
}

const resolved = computed(() => {
  if (typeof props.size === 'number') return { px: props.size, icon: Math.round(props.size * 0.55) }
  return sizeMap[props.size] ?? sizeMap.sm
})

const base =
  'inline-flex shrink-0 items-center justify-center transition-colors duration-150 cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:opacity-[0.38]'

const shapeClass = computed(() => props.shape === 'squared' ? 'rounded-md' : 'rounded-full')

function createRipple(event: PointerEvent) {
  if (props.disabled) return
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const el = document.createElement('span')
  el.className = 'm3-ripple'
  el.style.cssText = `width:${d}px;height:${d}px;top:${event.clientY - rect.top - d / 2}px;left:${event.clientX - rect.left - d / 2}px`
  button.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'filled':
      return 'bg-primary text-on-primary hover:shadow-elevation-1'
    case 'tonal':
      return 'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1'
    case 'outlined':
      return 'border border-outline text-on-surface-variant hover:bg-on-surface/8'
    default:
      return 'text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/12'
  }
})
</script>

<template>
  <component
    :is="tag"
    :to="to || undefined"
    :type="to ? undefined : 'button'"
    :aria-label="label || undefined"
    :disabled="disabled"
    :class="[base, shapeClass, variantClasses, 'relative overflow-hidden']"
    :style="{ width: `${resolved.px}px`, height: `${resolved.px}px` }"
    @pointerdown="createRipple"
  >
    <MIcon :name="icon" :size="resolved.icon" />
  </component>
</template>
