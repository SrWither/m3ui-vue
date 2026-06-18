<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  modelValue: number
  max?: number
  size?: number
  readonly?: boolean
  disabled?: boolean
  color?: string
  icon?: string
  halfIncrements?: boolean
}>(), { max: 5, size: 28, color: 'primary', icon: 'star', halfIncrements: false })

const emit = defineEmits<{ 'update:modelValue': [number] }>()

const hovered = ref(-1)

const colorClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    error: 'text-error',
  }
  return map[props.color] || ''
})

const customStyle = computed(() => {
  if (['primary', 'secondary', 'tertiary', 'error'].includes(props.color)) return undefined
  return { color: props.color }
})

function valueAt(index: number, e?: MouseEvent) {
  if (!props.halfIncrements) return index + 1
  if (!e) return index + 1
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const half = (e.clientX - rect.left) < rect.width / 2
  return half ? index + 0.5 : index + 1
}

function onClick(index: number, e: MouseEvent) {
  if (props.readonly || props.disabled) return
  const v = valueAt(index, e)
  emit('update:modelValue', v === props.modelValue ? 0 : v)
}

function onMove(index: number, e: MouseEvent) {
  if (props.readonly || props.disabled) return
  hovered.value = valueAt(index, e)
}

function onLeave() {
  hovered.value = -1
}

function iconName(index: number) {
  const active = hovered.value >= 0 ? hovered.value : props.modelValue
  if (index + 1 <= active) return props.icon
  if (props.halfIncrements && index + 0.5 <= active) return props.icon + '_half'
  return props.icon + '_border'  // outlined variant not available for all icons
}

function isFilled(index: number) {
  const active = hovered.value >= 0 ? hovered.value : props.modelValue
  return index + 1 <= active || (props.halfIncrements && index + 0.5 <= active)
}
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5"
    :class="disabled ? 'opacity-[0.38]' : ''"
    @mouseleave="onLeave"
  >
    <button
      v-for="i in max"
      :key="i"
      type="button"
      class="relative inline-flex items-center justify-center rounded-full p-0.5 transition-transform duration-100"
      :class="[
        readonly || disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110',
      ]"
      :style="customStyle"
      :disabled="disabled"
      @click="onClick(i - 1, $event)"
      @mousemove="onMove(i - 1, $event)"
    >
      <!-- Filled star -->
      <MIcon
        v-if="isFilled(i - 1)"
        :name="icon"
        :size="size"
        :class="colorClass"
        :style="customStyle"
        style="font-variation-settings: 'FILL' 1"
      />
      <!-- Empty star -->
      <MIcon
        v-else
        :name="icon"
        :size="size"
        class="text-on-surface-variant/40"
      />
    </button>
  </div>
</template>
