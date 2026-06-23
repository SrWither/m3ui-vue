<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon?: string
  modelValue?: boolean
  disabled?: boolean
  variant?: 'outlined' | 'filled' | 'elevated'
}>(), { modelValue: undefined, disabled: false, variant: 'outlined' })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const internal = ref(false)
const isOpen = computed(() =>
  props.modelValue !== undefined ? props.modelValue : internal.value,
)

function toggle() {
  if (props.disabled) return
  const next = !isOpen.value
  if (props.modelValue !== undefined) emit('update:modelValue', next)
  else internal.value = next
}

const wrapperClass = computed(() => {
  if (props.variant === 'filled')   return 'bg-surface-container-low rounded-md'
  if (props.variant === 'elevated') return 'bg-surface-container-low rounded-md shadow-elevation-1'
  return 'rounded-md border border-outline-variant'
})
</script>

<template>
  <div :class="wrapperClass" class="overflow-hidden">
    <!-- Header / trigger -->
    <button
      type="button"
      class="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-150 focus-visible:outline-none"
      :class="[
        disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer hover:bg-on-surface/4',
        isOpen ? 'bg-on-surface/4' : '',
      ]"
      :aria-expanded="isOpen"
      :disabled="disabled"
      @click="toggle"
    >
      <MIcon v-if="icon" :name="icon" :size="22" class="shrink-0 text-on-surface-variant" />
      <div class="flex-1 min-w-0">
        <p class="text-body-large font-medium text-on-surface">{{ title }}</p>
        <p v-if="subtitle" class="text-body-small text-on-surface-variant">{{ subtitle }}</p>
      </div>
      <MIcon
        name="expand_more"
        :size="22"
        class="shrink-0 text-on-surface-variant transition-transform duration-200"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>

    <!-- Content with height animation -->
    <div class="expand-grid" :class="isOpen ? 'expand-open' : ''">
      <div class="expand-body">
        <div class="border-t border-outline-variant/60 px-5 py-4">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  grid-template-rows: 0fr → 1fr expands to the exact content height,
  so the animation is always proportional — no max-height overshoot.
*/
.expand-grid {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease-in-out;
}
.expand-grid.expand-open {
  grid-template-rows: 1fr;
}
.expand-body {
  min-height: 0;
  overflow: hidden;
}
</style>
