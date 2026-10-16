<script setup lang="ts">
/**
 * Wraps MIconButton and swaps to a checkmark for resetDelay ms after a successful copy.
 *
 * @event error Emitted if the browser refuses the clipboard write
 * @event copied Emitted with the copied value after a successful clipboard write
 */
import { onUnmounted, ref } from 'vue'
import MIconButton from './MIconButton.vue'

const props = withDefaults(
  defineProps<{
    /** Text copied to the clipboard on click */
    value: string
    /** Icon shown in the idle state */
    icon?: string
    /** Icon shown right after a successful copy */
    copiedIcon?: string
    /** aria-label in the idle state */
    label?: string
    /** aria-label right after a successful copy */
    copiedLabel?: string
    /** Visual style (same as MIconButton) */
    variant?: 'standard' | 'filled' | 'tonal' | 'outlined'
    /** Button shape */
    shape?: 'rounded' | 'squared'
    /** Button size */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
    /** Disables the button */
    disabled?: boolean
    /** Milliseconds before the icon reverts to idle after copying */
    resetDelay?: number
  }>(),
  {
    icon: 'content_copy',
    copiedIcon: 'check',
    label: 'Copy',
    copiedLabel: 'Copied',
    variant: 'standard',
    shape: 'rounded',
    size: 'sm',
    disabled: false,
    resetDelay: 2000,
  },
)

const emit = defineEmits<{ copied: [string]; error: [unknown] }>()

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function onClick() {
  if (props.disabled) return
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    emit('copied', props.value)
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { copied.value = false }, props.resetDelay)
  } catch (err) {
    emit('error', err)
  }
}

onUnmounted(() => clearTimeout(resetTimer))
</script>

<template>
  <MIconButton
    :icon="copied ? copiedIcon : icon"
    :label="copied ? copiedLabel : label"
    :variant="variant"
    :shape="shape"
    :size="size"
    :disabled="disabled"
    @click="onClick"
  />
</template>
