<script setup lang="ts">
/**
 * Compact elements for filters, input, or actions — named semantic tones or any CSS color, with optional icon,
 * click, selection, and removal support. With `type` it's one of M3's four chips instead (assist, filter,
 * input, suggestion), styled by the spec and always interactive; `tone` then doesn't apply.
 *
 * @slot default The chip's label.
 * @slot avatar Input chips only: a 24px round avatar before the label (e.g. an MAvatar or an img)
 * @event click Emitted when a clickable (or typed), non-disabled chip is clicked
 * @event remove Emitted when the remove (X) button is clicked (removable only)
 * @event update:selected Filter and input chips: emitted on click with the new selected state — powers
 *   v-model:selected
 */
import { computed, ref, useSlots } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { FAST_EFFECTS, FAST_SPATIAL, useSpring } from '../composables/_useSpring'

const NAMED_TONES = ['neutral', 'primary', 'success', 'error', 'tertiary', 'secondary'] as const
type NamedTone = (typeof NAMED_TONES)[number]

const props = withDefaults(
  defineProps<{
    /** Color tone or any CSS color string */
    tone?: string       // named tone OR CSS color string
    /** Selected/active state — the chip's shape morphs from a rounded rect to a full pill when selected */
    selected?: boolean
    /** Show a remove (X) button */
    removable?: boolean
    /**
     * Makes the chip an interactive `<button>` with hover/press/focus feedback (otherwise renders as a plain
     * `<span>`)
     */
    clickable?: boolean
    /** Disables interaction */
    disabled?: boolean
    /** Leading Material Symbol icon */
    icon?: string
    /**
     * One of M3's chips: `assist` (an action), `filter` (on/off, v-model:selected; a check slides in while
     * selected), `input` (a piece of user input, with an optional #avatar and `removable`), `suggestion`.
     * Leave unset for the generic tone-colored chip
     */
    type?: 'assist' | 'filter' | 'input' | 'suggestion'
    /** Typed assist, filter and suggestion chips: surface-container-low with elevation 1 instead of an outline */
    elevated?: boolean
    /** Typed chips: a trailing Material Symbol icon (e.g. arrow_drop_down on a filter chip that opens a menu) */
    trailingIcon?: string
  }>(),
  {
    tone: 'neutral',
    selected: false,
    removable: false,
    clickable: false,
    disabled: false,
    elevated: false,
  },
)

const emit = defineEmits<{ click: []; remove: []; 'update:selected': [boolean] }>()
const locale = useLocale()
const slots = useSlots()

const isCustomColor = computed(
  () => !!props.tone && !(NAMED_TONES as readonly string[]).includes(props.tone),
)

// When a CSS color is passed, apply it via CSS variables
const customStyle = computed(() => {
  if (!isCustomColor.value) return undefined
  return {
    '--chip-bg': props.tone + '22',
    '--chip-color': props.tone,
  }
})

// M3 disabled tokens: label/icon always at 38% on-surface. Container: neutral/unselected
// chips are outline-only (no fill), so the outline fades to 10% (UnselectedDisabledOutlineOpacity);
// every other tone/selected chip has a filled container, so the fill fades to 12%
// (SelectedDisabledContainerOpacity) instead, with any border dropped.
const toneClasses = computed(() => {
  if (props.disabled) {
    if (props.tone === 'neutral' && !props.selected && !isCustomColor.value) {
      return 'border border-on-surface/10 bg-transparent text-on-surface/38'
    }
    return 'border border-transparent bg-on-surface/12 text-on-surface/38'
  }
  if (isCustomColor.value) {
    return 'border border-transparent bg-[var(--chip-bg)] text-[var(--chip-color)]'
  }
  if (props.tone === 'neutral' && !props.selected) {
    // ChipsTokens.UnselectedOutlineColor = OutlineVariant, not Outline
    return 'border border-outline-variant bg-transparent text-on-surface-variant'
  }
  const map: Record<string, string> = {
    neutral:   'border border-transparent bg-secondary-container text-on-secondary-container',
    primary:   'border border-transparent bg-primary-container text-on-primary-container',
    secondary: 'border border-transparent bg-secondary-container text-on-secondary-container',
    success:   'border border-transparent bg-success-container text-on-success-container',
    error:     'border border-transparent bg-error-container text-on-error-container',
    tertiary:  'border border-transparent bg-tertiary-container text-on-tertiary-container',
  }
  return map[props.tone ?? 'neutral'] ?? map.neutral
})

// ChipsTokens: UnselectedShape = CornerMedium (12dp), SelectedShape = CornerFull — a chip
// becomes a full pill once selected, it doesn't keep the same small corner radius.
const shapeClass = computed(() => props.selected ? 'rounded-full' : 'rounded-md')

// Hover/press state layer (8%/12%, ChipsTokens has no dedicated token but this matches the
// universal M3 state-layer convention used everywhere else in this library) via the same
// `before:`-overlay technique as MButton/MCard/MIconButton — a plain `hover:bg-*` would just
// replace a filled/selected chip's own background outright instead of overlaying on top of
// it. `ring-inset` on the focus ring (FocusedIndicatorColor = secondary) because `overflow-
// hidden` on this same element (needed to clip the state-layer to the chip's shape) would
// otherwise clip an outset ring's box-shadow too.
// ── Typed chips (Compose's AssistChip / FilterChip / InputChip / SuggestionChip) ─────────────────────
// 32dp, label-large, 18dp icons. Assist and suggestion keep CornerSmall (8dp); filter and input use the
// Expressive ChipShapes (CornerMedium 12dp, CornerFull while selected, CornerSmall while pressed) and the
// unified ChipsTokens colors.
const selectable = computed(() => props.type === 'filter' || props.type === 'input')
const hasAvatar = computed(() => props.type === 'input' && !!slots.avatar)
const hasTrailing = computed(() => !!props.trailingIcon || (props.type === 'input' && props.removable))

const typedContainer = computed(() => {
  const on = selectable.value && props.selected
  if (props.disabled) {
    if (on) return 'bg-on-surface/12 text-on-surface/38'
    return props.elevated && props.type !== 'input'
      ? 'bg-on-surface/12 text-on-surface/38'
      : 'border border-on-surface/12 text-on-surface/38'
  }
  if (on) return ['bg-secondary-container text-on-secondary-container', props.elevated ? 'shadow-elevation-1 hover:shadow-elevation-2' : '']
  const label = props.type === 'assist' ? 'text-on-surface' : 'text-on-surface-variant'
  return props.elevated && props.type !== 'input'
    ? ['bg-surface-container-low shadow-elevation-1 hover:shadow-elevation-2', label]
    : ['border border-outline-variant', label]
})

const leadingIconClass = computed(() => {
  if (props.disabled) return ''
  if (props.type === 'assist' || props.type === 'suggestion') return 'text-primary'
  return props.selected ? 'text-on-secondary-container' : 'text-on-surface-variant'
})

// Compose's chip paddings: 8dp next to a leading/trailing icon, 16dp otherwise; an input chip 4dp next to an
// avatar, 8dp next to an icon, 12dp (4 + the label's 8) otherwise
const typedPadding = computed(() => {
  if (props.type === 'input') {
    return [hasAvatar.value ? 'pl-1' : props.icon ? 'pl-2' : 'pl-3', hasTrailing.value ? 'pr-2' : 'pr-3']
  }
  // A filter chip's sliding check carries its own spacing (see checkEl), so its padding stays put
  return [props.icon || slidingCheck.value ? 'pl-2' : 'pl-4', hasTrailing.value ? 'pr-2' : 'pr-4']
})

const pressed = ref(false)
const typedEl = ref<HTMLElement>()
const checkEl = ref<HTMLElement>()
// Filter chip without its own icon: the check expands in (FastSpatial) and fades in (FastEffects) as it gets
// selected, like Compose's animated chip content. Its slot runs from 8px (with the 8px padding: the label at
// 16px, an iconless chip's padding) to 26px (the check at 8px, the label 8px after it).
const slidingCheck = computed(() => props.type === 'filter' && !props.icon)
useSpring(
  () => (props.type === 'filter' || props.type === 'input'
    ? [pressed.value ? 8 : props.selected ? 16 : 12, slidingCheck.value ? (props.selected ? 26 : 8) : 0]
    : []),
  ([radius, width]) => {
    if (typedEl.value && radius !== undefined) typedEl.value.style.borderRadius = `${radius}px`
    if (checkEl.value && width !== undefined) checkEl.value.style.width = `${width}px`
  },
  FAST_SPATIAL,
)
useSpring(
  () => (slidingCheck.value ? [props.selected ? 1 : 0] : []),
  ([opacity]) => { if (checkEl.value && opacity !== undefined) checkEl.value.style.opacity = String(opacity) },
  FAST_EFFECTS,
)

function onTypedClick() {
  if (props.disabled) return
  if (selectable.value) emit('update:selected', !props.selected)
  emit('click')
}

const interactiveClasses =
  "relative cursor-pointer before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'hover:before:opacity-[0.08] active:before:opacity-[0.12] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary'
</script>

<template>
  <span
    v-if="type"
    ref="typedEl"
    class="relative inline-flex h-8 items-center overflow-hidden align-middle text-label-large transition-[background-color,box-shadow,color] has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-inset has-[button:focus-visible]:ring-secondary"
    :class="[typedContainer, type === 'assist' || type === 'suggestion' ? 'rounded-sm' : 'rounded-md']"
  >
    <!-- Typed chip: the container is a span so an input chip's remove button can sit beside (not inside) the
         main button; the main button's state layer (before:) covers the whole chip -->
    <button
      type="button"
      class="flex h-full items-center gap-2 outline-none before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity"
      :class="[typedPadding, disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:before:opacity-[0.08] active:before:opacity-[0.12]']"
      :disabled="disabled"
      :aria-pressed="selectable ? selected : undefined"
      @pointerdown="pressed = true"
      @pointerup="pressed = false"
      @pointerleave="pressed = false"
      @pointercancel="pressed = false"
      @click="onTypedClick"
    >
      <span v-if="hasAvatar" class="-my-1 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="disabled ? 'opacity-38' : ''">
        <slot name="avatar" />
      </span>
      <MIcon v-else-if="icon" :name="icon" :size="18" :filled="type === 'filter' && selected" class="shrink-0" :class="leadingIconClass" />
      <!-- -mr-2 cancels the gap while the check is closed -->
      <span v-else-if="slidingCheck" ref="checkEl" class="-mr-2 flex shrink-0 overflow-hidden" style="width: 8px; opacity: 0" aria-hidden="true">
        <MIcon name="check" :size="18" class="shrink-0" :class="leadingIconClass" />
      </span>
      <span class="whitespace-nowrap"><slot /></span>
      <MIcon v-if="trailingIcon" :name="trailingIcon" :size="18" class="shrink-0" :class="disabled ? '' : selected && selectable ? 'text-on-secondary-container' : 'text-on-surface-variant'" />
    </button>
    <button
      v-if="type === 'input' && removable"
      type="button"
      class="relative -ml-1 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full outline-none hover:bg-on-surface/8 focus-visible:ring-2 focus-visible:ring-secondary"
      :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
      :aria-label="locale.remove"
      :disabled="disabled"
      @click.stop="emit('remove')"
    >
      <MIcon name="close" :size="18" />
    </button>
  </span>

  <component
    :is="clickable ? 'button' : 'span'"
    v-else
    :type="clickable ? 'button' : undefined"
    :disabled="clickable && disabled ? true : undefined"
    class="inline-flex h-8 items-center gap-1.5 overflow-hidden px-3 text-label-large transition-colors"
    :class="[
      shapeClass,
      toneClasses,
      clickable && !disabled ? interactiveClasses : '',
      disabled ? 'cursor-not-allowed' : '',
    ]"
    :style="customStyle"
    @click="clickable && !disabled && emit('click')"
  >
    <MIcon v-if="icon" :name="icon" :size="18" />
    <slot />
    <button
      v-if="removable"
      type="button"
      class="-mr-1 ml-0.5 inline-flex items-center justify-center rounded-full hover:bg-on-surface/12"
      :aria-label="locale.remove"
      :disabled="disabled"
      @click.stop="emit('remove')"
    >
      <MIcon name="close" :size="16" />
    </button>
  </component>
</template>
