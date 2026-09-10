<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import MIconButton from './MIconButton.vue'

const props = withDefaults(
  defineProps<{
    value: string
    icon?: string
    copiedIcon?: string
    label?: string
    copiedLabel?: string
    variant?: 'standard' | 'filled' | 'tonal' | 'outlined'
    shape?: 'rounded' | 'squared'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
    disabled?: boolean
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
