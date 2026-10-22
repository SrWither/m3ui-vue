<script setup lang="ts">
/**
 * A button that shows only an icon — four visual styles, the same 5-tier expressive sizing as MButton. Give it
 * `checked` (v-model:checked) and it becomes M3's icon toggle button.
 *
 * @event update:checked Emitted on click when `checked` is set — powers v-model:checked
 */
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import { vRipple } from '../directives/vRipple'
import { DEFAULT_EFFECTS, useSpring } from '../composables/_useSpring'

const props = withDefaults(
  defineProps<{
    /** Material Symbol icon name */
    icon: string
    /** Accessible label (its aria-label; no visible tooltip: wrap it in MTooltip for one) */
    label?: string
    /** Visual style */
    variant?: 'standard' | 'filled' | 'tonal' | 'outlined'
    /**
     * An M3 role or any CSS color (`#fff` over a photo, `rgb(0 0 0 / 0.3)` for a scrim-like filled button,
     * `currentColor` to follow the surrounding text). Standard and outlined use it for the icon; filled for the
     * container with white (or the role's on-color) on it; tonal for a 20% container with the color on it.
     * Disabled buttons and toggles keep their own colors
     */
    color?: 'primary' | 'secondary' | 'tertiary' | 'error' | (string & {})
    /**
     * Button shape — rounded (pill, always) or squared (corner radius scales with size: 12px xs/sm, 16px md,
     * 28px lg/xl)
     */
    shape?: 'rounded' | 'squared'
    /** M3's 5-tier icon button sizing (xs:32, sm:40, md:56, lg:96, xl:136), or a custom pixel value */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
    /** Disables interaction */
    disabled?: boolean
    /** Vue Router destination — renders as RouterLink instead of button */
    to?: string | Record<string, any>
    /** Any CSS color for the press ripple; defaults to the button's content color */
    rippleColor?: string
    /**
     * Makes it a toggle button (v-model:checked): selected colors, a filled icon, and a shape that morphs when
     * pressed and when checked. Leave it unset for a plain icon button
     */
    checked?: boolean
    /** Icon shown while checked, when it differs from `icon` (e.g. 'pause' for 'play_arrow') */
    checkedIcon?: string
    /** Draw the icon filled (Material Symbols' FILL axis) without making it a toggle, e.g. media controls */
    iconFilled?: boolean
  }>(),
  {
    variant: 'standard',
    shape: 'rounded',
    size: 'sm',
    disabled: false,
    checked: undefined,
  },
)

const emit = defineEmits<{ 'update:checked': [boolean] }>()

const isToggle = computed(() => props.checked !== undefined)

const ROLES = ['primary', 'secondary', 'tertiary', 'error']
// `color` as inline styles over the variant's classes, so the default look stays class-only
const colorStyle = computed(() => {
  const c = props.color
  if (!c || props.disabled || isToggle.value) return undefined
  const role = ROLES.includes(c)
  const main = role ? `var(--color-${c})` : c
  switch (props.variant) {
    case 'filled':
      return { backgroundColor: main, color: role ? `var(--color-on-${c})` : '#fff' }
    case 'tonal':
      return role
        ? { backgroundColor: `var(--color-${c}-container)`, color: `var(--color-on-${c}-container)` }
        : { backgroundColor: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }
    default:
      return { color: main }
  }
})
const tag = computed(() => props.to && !isToggle.value ? 'RouterLink' : 'button')

// Container height/width (icon buttons are always square by default — real
// `IconButtonDefaults.<tier>ContainerSize()` also has Narrow/Wide width options not
// implemented here, matching the existing scope of MButton's size tiers) and icon size
// per M3's 5-tier `{XSmall,Small,Medium,Large,XLarge}IconButtonTokens.kt`. `squareRadius`
// matches each tier's own `ContainerShapeSquare` (12px xs/sm, 16px md, 28px lg/xl) — same
// pattern as MButton's size tiers.
// Toggle radii (px) from the same token files: `square` is ContainerShapeSquare, `pressed`
// PressedContainerShape, `checkedRound` SelectedContainerShapeRound (a round button squares off when
// checked); SelectedContainerShapeSquare is CornerFull (a square one turns round), i.e. px / 2.
const sizeMap = {
  xs: { px: 32, icon: 20, squareRadius: 'rounded-md', square: 12, pressed: 8, checkedRound: 12 },
  sm: { px: 40, icon: 24, squareRadius: 'rounded-md', square: 12, pressed: 8, checkedRound: 12 },
  md: { px: 56, icon: 24, squareRadius: 'rounded-lg', square: 16, pressed: 12, checkedRound: 16 },
  lg: { px: 96, icon: 32, squareRadius: 'rounded-xl', square: 28, pressed: 16, checkedRound: 28 },
  xl: { px: 136, icon: 40, squareRadius: 'rounded-xl', square: 28, pressed: 16, checkedRound: 28 },
}

const resolved = computed(() => {
  if (typeof props.size === 'number') {
    return { px: props.size, icon: Math.round(props.size * 0.55), squareRadius: 'rounded-md', square: 12, pressed: 8, checkedRound: 12 }
  }
  return sizeMap[props.size] ?? sizeMap.sm
})

// Icon toggle shape morph (IconButton.kt's shapeByInteraction: pressed, else checked, else the resting
// shape), on the DefaultEffects spring the source picks so it doesn't bounce. Plain icon buttons keep
// a static shape, like Compose's non-`shapes` overloads.
const rootEl = ref<unknown>(null)
const pressed = ref(false)

function targetRadius() {
  const r = resolved.value
  const full = r.px / 2
  if (pressed.value) return r.pressed
  if (props.checked) return props.shape === 'squared' ? full : r.checkedRound
  return props.shape === 'squared' ? r.square : full
}

useSpring(
  () => (isToggle.value ? [targetRadius()] : []),
  (v) => {
    // A RouterLink root (plain button with `to`) is a component instance, not an element
    if (rootEl.value instanceof HTMLElement) rootEl.value.style.borderRadius = v.length ? `${v[0]}px` : ''
  },
  DEFAULT_EFFECTS,
)

function onPointerDown() {
  if (isToggle.value && !props.disabled) pressed.value = true
}
function onPointerUp() {
  pressed.value = false
}

function onClick() {
  if (isToggle.value && !props.disabled) emit('update:checked', !props.checked)
}

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
  if (props.variant === 'outlined' && props.checked) return 'disabled:bg-on-surface/10'
  switch (props.variant) {
    case 'filled':
    case 'tonal':
      return 'disabled:bg-on-surface/10'
    default:
      return ''
  }
})

const shapeClass = computed(() => props.shape === 'squared' ? resolved.value.squareRadius : 'rounded-full')


// Toggle colors: the Selected*/Unselected* tokens of each variant's *IconButtonTokens. Unchecked
// filled/tonal differ from the plain button's colors, so the checked state stands out.
const toggleClasses = computed(() => {
  const on = props.checked
  switch (props.variant) {
    case 'filled':
      return on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
    case 'tonal':
      return on ? 'bg-secondary text-on-secondary' : 'bg-secondary-container text-on-secondary-container'
    case 'outlined':
      // outlinedIconToggleButtonBorder: no border once checked
      return on ? 'bg-inverse-surface text-inverse-on-surface' : 'border border-current text-on-surface-variant'
    default:
      return on ? 'text-primary' : 'text-on-surface-variant'
  }
})

const variantClasses = computed(() => {
  if (isToggle.value) return toggleClasses.value
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
    ref="rootEl"
    :to="tag === 'RouterLink' ? to : undefined"
    :type="tag === 'RouterLink' ? undefined : 'button'"
    :aria-label="label || undefined"
    :aria-pressed="isToggle ? checked : undefined"
    :disabled="disabled"
    :class="[base, shapeClass, variantClasses, disabledContainerClasses]"
    :style="[{ width: `${resolved.px}px`, height: `${resolved.px}px` }, colorStyle]"
    v-ripple="{ disabled, color: rippleColor }"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onClick"
  >
    <MIcon :name="checked && checkedIcon ? checkedIcon : icon" :size="resolved.icon" :filled="!!checked || iconFilled" />
  </component>
</template>
