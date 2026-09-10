<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** A '+'-delimited string ("Ctrl+Shift+K") or an array of keys (['Ctrl', 'Shift', 'K']). */
    keys: string | string[]
    size?: 'sm' | 'md' | 'lg'
    separator?: string
  }>(),
  {
    size: 'md',
    separator: '+',
  },
)

const keyList = computed(() => (Array.isArray(props.keys) ? props.keys : props.keys.split('+')))

const sizeClasses = {
  sm: 'h-5 min-w-5 px-1 text-[10px]',
  md: 'h-6 min-w-6 px-1.5 text-label-small',
  lg: 'h-7 min-w-7 px-2 text-label-medium',
}
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <template v-for="(key, i) in keyList" :key="i">
      <kbd
        class="inline-flex items-center justify-center rounded-sm border border-b-2 border-outline-variant bg-surface-container-high font-sans font-medium text-on-surface-variant"
        :class="sizeClasses[size]"
      >{{ key }}</kbd>
      <span v-if="i < keyList.length - 1" class="text-on-surface-variant" aria-hidden="true">{{ separator }}</span>
    </template>
  </span>
</template>
