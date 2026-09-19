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

// Container height/width (icon buttons are always square by default — real
// `IconButtonDefaults.<tier>ContainerSize()` also has Narrow/Wide width options not
// implemented here, matching the existing scope of MButton's size tiers) and icon size
// per M3's 5-tier `{XSmall,Small,Medium,Large,XLarge}IconButtonTokens.kt`. `squareRadius`
// matches each tier's own `ContainerShapeSquare` (12px xs/sm, 16px md, 28px lg/xl) — same
// pattern as MButton's size tiers.
const sizeMap = {
  xs: { px: 32, icon: 20, squareRadius: 'rounded-md' },
  sm: { px: 40, icon: 24, squareRadius: 'rounded-md' },
  md: { px: 56, icon: 24, squareRadius: 'rounded-lg' },
  lg: { px: 96, icon: 32, squareRadius: 'rounded-xl' },
  xl: { px: 136, icon: 40, squareRadius: 'rounded-xl' },
}

const resolved = computed(() => {
  if (typeof props.size === 'number') return { px: props.size, icon: Math.round(props.size * 0.55), squareRadius: 'rounded-md' }
  return sizeMap[props.size] ?? sizeMap.sm
})

/*
 * State layer via a `before:` overlay (same technique MButton uses) rather than a direct
 * `hover:bg-*`/`active:bg-*` utility: a solid `bg-primary`/`bg-secondary-container`
 * container can't also swap to a translucent hover background without just replacing the
 * color outright, so hover/press need a separate semi-transparent layer painted on top,
 * tinted with the button's own content color (`before:bg-current`) — matches real M3's
 * per-variant Hovered/PressedColor tokens, which are all just the content color at a fixed
 * opacity (8%/12%), the same universal state-layer pattern across every variant.
 */
const base =
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden transition-colors duration-150 cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:text-on-surface/38 ' +
  "before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]'

// M3 disabled container opacity is 10% on-surface (DisabledContainerOpacity, Filled/Tonal
// only — Outlined has no container). Outlined's border needs no separate disabled class:
// it's `border-current` (see `variantClasses`), so it dims automatically along with the
// `disabled:text-on-surface/38` in `base` above, exactly like the real `outlinedIconButtonBorder`
// (which literally reuses `LocalContentColor` at the same disabled opacity as the icon).
const disabledContainerClasses = computed(() => {
  switch (props.variant) {
    case 'filled':
    case 'tonal':
      return 'disabled:bg-on-surface/10'
    default:
      return ''
  }
})

const shapeClass = computed(() => props.shape === 'squared' ? resolved.value.squareRadius : 'rounded-full')

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
      // Real IconButton.kt has no elevation tokens at all for any variant — flat, unlike Button
      return 'bg-primary text-on-primary'
    case 'tonal':
      return 'bg-secondary-container text-on-secondary-container'
    case 'outlined':
      // OutlinedIconButtonTokens' default (non-"vibrant") border tracks LocalContentColor,
      // i.e. the same on-surface-variant used for the icon itself — not a fixed outline token
      return 'border border-current text-on-surface-variant'
    default:
      return 'text-on-surface-variant'
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
    :class="[base, shapeClass, variantClasses, disabledContainerClasses]"
    :style="{ width: `${resolved.px}px`, height: `${resolved.px}px` }"
    @pointerdown="createRipple"
  >
    <MIcon :name="icon" :size="resolved.icon" />
  </component>
</template>
