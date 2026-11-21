<script setup lang="ts">
/*
 * Internal (not exported from index.ts): the date pickers' month/year menu button, Compose's YearPickerMenuButton.
 * A pill text button with the month's title and a drop-down arrow that turns over while the year grid is open.
 */
import { ref } from 'vue'
import MIcon from './MIcon.vue'

defineProps<{
  /** The month's title ("May 1990") */
  label: string
  expanded: boolean
  /** What the button does: switch to the years, or back to the days */
  action: string
}>()

defineEmits<{ toggle: [] }>()

const el = ref<HTMLButtonElement>()
defineExpose({ focus: () => el.value?.focus() })
</script>

<template>
  <button
    ref="el"
    type="button"
    class="flex h-10 cursor-pointer items-center gap-1 rounded-full pr-2 pl-3 text-title-small font-medium capitalize text-on-surface-variant outline-none transition-colors hover:bg-on-surface-variant/8 focus-visible:ring-2 focus-visible:ring-secondary active:bg-on-surface-variant/10"
    :aria-label="`${label}, ${action}`"
    :aria-expanded="expanded"
    aria-live="polite"
    @click="$emit('toggle')"
  >
    {{ label }}
    <MIcon name="arrow_drop_down" :size="18" class="transition-transform duration-200" :class="expanded && 'rotate-180'" />
  </button>
</template>
