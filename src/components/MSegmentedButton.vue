<script lang="ts">
export interface SegmentedOption<V extends string | number = string | number> {
  value: V
  label: string
  icon?: string
  disabled?: boolean
}
</script>

<script setup lang="ts" generic="V extends string | number, M extends V | V[] = V">
/**
 * A row of joined segments for choosing between a small set of related options — single or multi select.
 *
 * @event update:modelValue Emitted on selection change — powers v-model
 */
import MIcon from './MIcon.vue'

withDefaults(defineProps<{
  /** Selected value, or values with `multiSelect` (v-model); typed after the options' values */
  modelValue: M
  /** The options to choose from; see `SegmentedOption`. */
  options: SegmentedOption<V>[]
  /** Allow multiple selections */
  multiSelect?: boolean
  /** Button density */
  density?: 'default' | 'comfortable' | 'compact'
  /** Selected segment color */
  color?: 'primary' | 'secondary' | 'tertiary'
}>(), { multiSelect: false, density: 'default', color: 'primary' })

const emit = defineEmits<{ 'update:modelValue': [M] }>()

function isSelected(value: V, modelValue: M) {
  return Array.isArray(modelValue) ? modelValue.includes(value) : modelValue === value
}

function toggle(opt: SegmentedOption<V>, modelValue: M, multi: boolean) {
  if (opt.disabled) return
  if (multi) {
    const arr: V[] = Array.isArray(modelValue) ? [...modelValue] : [modelValue as V]
    const idx = arr.indexOf(opt.value)
    if (idx >= 0) arr.splice(idx, 1)
    else arr.push(opt.value)
    emit('update:modelValue', arr as M)
  } else {
    emit('update:modelValue', opt.value as M)
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
      class="relative inline-flex grow items-center justify-center gap-2 text-label-large font-medium transition-[background-color,color] duration-150 outline-none before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]"
      :class="[
        density === 'compact' ? 'h-8 px-3' : density === 'comfortable' ? 'h-10 px-4' : 'h-10 px-6',
        i > 0 ? (opt.disabled ? 'border-l border-outline/12' : 'border-l border-outline') : '',
        opt.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        isSelected(opt.value, modelValue) && (
          color === 'secondary' ? 'bg-secondary-container'
          : color === 'tertiary' ? 'bg-tertiary-container'
          : 'bg-primary-container'
        ),
        opt.disabled
          ? 'text-on-surface/38'
          : isSelected(opt.value, modelValue)
            ? color === 'secondary' ? 'text-on-secondary-container'
              : color === 'tertiary' ? 'text-on-tertiary-container'
              : 'text-on-primary-container'
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
