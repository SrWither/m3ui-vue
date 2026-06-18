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

const toneClasses = computed(() => {
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
      disabled ? 'cursor-not-allowed opacity-[0.38]' : '',
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
