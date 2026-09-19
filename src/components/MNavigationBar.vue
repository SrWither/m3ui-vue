<script setup lang="ts">
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'

export interface NavBarItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
}

withDefaults(defineProps<{
  modelValue: string | number
  items: NavBarItem[]
}>(), {})

defineEmits<{ 'update:modelValue': [string | number] }>()
</script>

<template>
  <nav class="flex h-20 w-full items-center justify-around border-t border-outline-variant bg-surface-container shadow-elevation-2">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 self-stretch transition-colors focus-visible:outline-none"
      @click="$emit('update:modelValue', item.value)"
    >
      <!-- Pill indicator with icon -->
      <span
        class="inline-flex h-8 items-center justify-center rounded-2xl transition-all duration-200"
        :class="
          item.value === modelValue
            ? 'w-16 bg-secondary-container text-on-secondary-container'
            : 'w-0 bg-secondary-container/0 text-on-surface-variant group-hover:w-16 group-hover:bg-on-surface/8'
        "
      >
        <MBadge v-if="item.badge != null" :count="item.badge">
          <MIcon :name="item.icon" :size="24" />
        </MBadge>
        <MBadge v-else-if="item.badgeDot" dot>
          <MIcon :name="item.icon" :size="24" />
        </MBadge>
        <MIcon v-else :name="item.icon" :size="24" />
      </span>

      <!-- Label -->
      <span
        class="text-label-medium font-medium"
        :class="item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant'"
      >
        {{ item.label }}
      </span>
    </button>
  </nav>
</template>
