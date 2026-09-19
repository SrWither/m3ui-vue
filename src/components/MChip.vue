<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const NAMED_TONES = ['neutral', 'primary', 'success', 'error', 'tertiary', 'secondary'] as const
type NamedTone = (typeof NAMED_TONES)[number]

const props = withDefaults(
  defineProps<{
    tone?: string       // named tone OR CSS color string
    selected?: boolean
    removable?: boolean
    clickable?: boolean
    disabled?: boolean
    icon?: string
  }>(),
  {
    tone: 'neutral',
    selected: false,
    removable: false,
    clickable: false,
    disabled: false,
  },
)

const emit = defineEmits<{ click: []; remove: [] }>()

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
const interactiveClasses =
  "relative cursor-pointer before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'hover:before:opacity-[0.08] active:before:opacity-[0.12] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary'
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
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
      aria-label="Quitar"
      :disabled="disabled"
      @click.stop="emit('remove')"
    >
      <MIcon name="close" :size="16" />
    </button>
  </component>
</template>
