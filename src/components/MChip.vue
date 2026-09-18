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
// chips are outline-only (no fill), so the outline fades to 12%; every other tone has a
// filled container, so the fill fades to 12% instead (and any border is dropped).
const toneClasses = computed(() => {
  if (props.disabled) {
    if (props.tone === 'neutral' && !props.selected && !isCustomColor.value) {
      return 'border border-on-surface/12 bg-transparent text-on-surface/38'
    }
    return 'border border-transparent bg-on-surface/12 text-on-surface/38'
  }
  if (isCustomColor.value) {
    return 'border border-transparent bg-[var(--chip-bg)] text-[var(--chip-color)]'
  }
  if (props.tone === 'neutral' && !props.selected) {
    return 'border border-outline bg-transparent text-on-surface-variant'
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
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    :disabled="clickable && disabled ? true : undefined"
    class="inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-label-large transition-colors"
    :class="[
      toneClasses,
      clickable && !disabled ? 'cursor-pointer hover:bg-on-surface/8' : '',
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
