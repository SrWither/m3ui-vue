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
}>(), { disabled: false, variant: 'outlined' })

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
    <Transition name="expand">
      <div v-if="isOpen" class="expand-grid">
        <div class="expand-body border-t border-outline-variant/60 px-5 py-4">
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/*
  grid-template-rows: 0fr → 1fr expands to the exact content height,
  so the animation is always proportional — no max-height overshoot.
*/
.expand-grid {
  display: grid;
  grid-template-rows: 1fr;
}
.expand-body {
  min-height: 0; /* required for 0fr to actually collapse */
  overflow: hidden;
}

.expand-enter-active {
  transition: grid-template-rows 280ms cubic-bezier(0.2, 0, 0, 1);
}
.expand-enter-active > .expand-body {
  transition: opacity 220ms ease;
}
.expand-enter-from {
  grid-template-rows: 0fr;
}
.expand-enter-from > .expand-body {
  opacity: 0;
}

.expand-leave-active {
  transition: grid-template-rows 220ms cubic-bezier(0.4, 0, 1, 1);
}
.expand-leave-active > .expand-body {
  transition: opacity 150ms ease;
}
.expand-leave-to {
  grid-template-rows: 0fr;
}
.expand-leave-to > .expand-body {
  opacity: 0;
}
</style>
