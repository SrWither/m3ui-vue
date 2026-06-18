<script setup lang="ts">
import MIcon from './MIcon.vue'

export interface SegmentedOption {
  value: string | number
  label: string
  icon?: string
  disabled?: boolean
}

withDefaults(defineProps<{
  modelValue: string | number | (string | number)[]
  options: SegmentedOption[]
  multiSelect?: boolean
  density?: 'default' | 'comfortable' | 'compact'
  color?: 'primary' | 'secondary' | 'tertiary'
}>(), { multiSelect: false, density: 'default', color: 'primary' })

const emit = defineEmits<{ 'update:modelValue': [string | number | (string | number)[]] }>()

function isSelected(value: string | number, modelValue: string | number | (string | number)[]) {
  return Array.isArray(modelValue) ? modelValue.includes(value) : modelValue === value
}

function toggle(opt: SegmentedOption, modelValue: string | number | (string | number)[], multi: boolean) {
  if (opt.disabled) return
  if (multi) {
    const arr = Array.isArray(modelValue) ? [...modelValue] : [modelValue]
    const idx = arr.indexOf(opt.value)
    if (idx >= 0) arr.splice(idx, 1)
    else arr.push(opt.value)
    emit('update:modelValue', arr)
  } else {
    emit('update:modelValue', opt.value)
  }
}
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-full border border-outline"
    role="group"
  >
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      type="button"
      class="relative inline-flex items-center justify-center gap-2 text-label-large font-medium transition-[background-color,color] duration-150 outline-none before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]"
      :class="[
        density === 'compact' ? 'h-8 px-3' : density === 'comfortable' ? 'h-10 px-4' : 'h-10 px-6',
        i > 0 ? 'border-l border-outline' : '',
        opt.disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer',
        isSelected(opt.value, modelValue)
          ? color === 'secondary'
            ? 'bg-secondary-container text-on-secondary-container'
            : color === 'tertiary'
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-secondary-container text-on-secondary-container'
          : 'text-on-surface',
      ]"
      :disabled="opt.disabled"
      :aria-pressed="isSelected(opt.value, modelValue)"
      @click="toggle(opt, modelValue, multiSelect)"
    >
      <MIcon
        v-if="isSelected(opt.value, modelValue)"
        name="check"
        :size="18"
        class="transition-transform duration-150"
      />
      <MIcon v-else-if="opt.icon" :name="opt.icon" :size="18" />
      <span>{{ opt.label }}</span>
    </button>
  </div>
</template>
