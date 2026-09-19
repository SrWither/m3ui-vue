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
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    shape?: 'rounded' | 'squared'
    to?: string | Record<string, any>
  }>(),
  {
    variant: 'filled',
    color: 'primary',
    type: 'button',
    disabled: false,
    loading: false,
    size: 'sm',
    shape: 'rounded',
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
  'relative inline-flex items-center justify-center font-medium ' +
  'whitespace-nowrap overflow-hidden transition-[box-shadow,background-color,color] duration-150 select-none cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:shadow-none disabled:text-on-surface/38 ' +
  "before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]'

// M3 disabled tokens: container at 10% on-surface opacity (DisabledContainerOpacity, same
// across Filled/Tonal/Elevated), content/label always at 38% on-surface (handled in `base`
// above, applies to every variant including text/elevated which have no container). The
// outlined border uses the SAME color role as its enabled border (OutlineVariant, not
// on-surface) just dimmed to that 10% too — see `variantClasses`' outlined case below for
// why the enabled color is also outline-variant, not outline.
const disabledContainerClasses = computed(() => {
  switch (props.variant) {
    case 'filled':
    case 'tonal':
    case 'elevated':
      return 'disabled:bg-on-surface/10'
    case 'outlined':
      return isError.value ? 'disabled:border-error/10' : 'disabled:border-outline-variant/10'
    default:
      return ''
  }
})

/*
 * M3's newer 5-tier "expressive" button sizing (Button{XSmall,Small,Medium,Large,
 * XLarge}Tokens.kt + Button.kt's size-variant overloads — @ExperimentalMaterial3ExpressiveApi
 * in Compose, but this `size` prop is deliberately implementing exactly that system, same
 * as MFabMenu/MLoadingIndicator already do for other Expressive-only components). Content
 * padding is IDENTICAL whether or not an icon is present at every tier in the default
 * (non "precision pointer") mode — e.g. `IconMediumLeadingPadding = MediumLeadingPadding`
 * verbatim in the real source — so there's deliberately no separate icon-vs-no-icon padding
 * split here, unlike the old version of this file which had one (and got the values wrong
 * in both directions). `gap` between icon and label also varies by tier (IconLabelSpace),
 * not a flat value for every size.
 */
const sizeMap = {
  xs: { h: 'h-8', text: 'text-label-large', icon: 20, spinner: 16, gap: 'gap-1', px: 'px-3', pxText: 'px-2', squareRadius: 'rounded-md' },
  sm: { h: 'h-10', text: 'text-label-large', icon: 20, spinner: 16, gap: 'gap-2', px: 'px-4', pxText: 'px-3', squareRadius: 'rounded-md' },
  md: { h: 'h-14', text: 'text-title-medium', icon: 24, spinner: 18, gap: 'gap-2', px: 'px-6', pxText: 'px-3', squareRadius: 'rounded-lg' },
  lg: { h: 'h-24', text: 'text-headline-small', icon: 32, spinner: 26, gap: 'gap-3', px: 'px-12', pxText: 'px-4', squareRadius: 'rounded-xl' },
  xl: { h: 'h-[136px]', text: 'text-headline-large', icon: 40, spinner: 34, gap: 'gap-4', px: 'px-16', pxText: 'px-4', squareRadius: 'rounded-xl' },
}

const s = computed(() => sizeMap[props.size] ?? sizeMap.sm)
const sizeClasses = computed(() => `${s.value.h} ${s.value.text} ${s.value.gap}`)
const iconSize = computed(() => s.value.icon)
const spinnerSize = computed(() => s.value.spinner)

const px = computed(() => props.variant === 'text' ? s.value.pxText : s.value.px)

// Squared shape radius scales with size, matching each tier's own ContainerShapeSquare
// token (ButtonXSmallTokens/ButtonSmallTokens use CornerMedium=12px, ButtonMediumTokens
// CornerLarge=16px, ButtonLargeTokens/ButtonXLargeTokens CornerExtraLarge=28px) — the
// pill (ContainerShapeRound) is CornerFull at every tier, so that half doesn't vary.
const shapeClass = computed(() => props.shape === 'squared' ? s.value.squareRadius : 'rounded-full')

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
      // OutlinedButtonTokens.OutlineColor = ColorSchemeKeyTokens.OutlineVariant, not Outline
      return err
        ? 'border border-error text-error'
        : 'border border-outline-variant text-primary'
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
    :class="[base, shapeClass, sizeClasses, px, variantClasses, disabledContainerClasses]"
    :style="customStyle"
    @pointerdown="createRipple"
  >
    <MSpinner v-if="loading" :size="spinnerSize" />
    <MIcon v-else-if="icon" :name="icon" :size="iconSize" />
    <slot />
  </component>
</template>
