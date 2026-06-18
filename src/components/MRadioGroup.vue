<script setup lang="ts">
import MRadio from './MRadio.vue'

interface Option {
  label: string
  value: unknown
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: unknown
  options: Option[]
  label?: string
  direction?: 'column' | 'row'
  disabled?: boolean
  color?: 'primary' | 'secondary' | 'tertiary' | 'error'
}>(), { direction: 'column', disabled: false, color: 'primary' })

const emit = defineEmits<{ 'update:modelValue': [unknown] }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <span v-if="label" class="text-label-large text-on-surface-variant">{{ label }}</span>
    <div
      class="flex gap-4"
      :class="direction === 'row' ? 'flex-row flex-wrap' : 'flex-col'"
    >
      <MRadio
        v-for="opt in options"
        :key="String(opt.value)"
        :model-value="modelValue"
        :value="opt.value"
        :label="opt.label"
        :color="color"
        :disabled="disabled || !!opt.disabled"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>
