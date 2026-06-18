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
  <nav class="flex h-20 w-full items-center justify-around border-t border-outline-variant bg-surface-container">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 self-stretch transition-colors focus-visible:outline-none"
      :class="
        item.value === modelValue
          ? 'text-on-secondary-container'
          : 'text-on-surface-variant'
      "
      @click="$emit('update:modelValue', item.value)"
    >
      <!-- Pill indicator with icon -->
      <span
        class="inline-flex h-8 items-center justify-center rounded-2xl transition-all duration-200"
        :class="
          item.value === modelValue
            ? 'w-16 bg-secondary-container'
            : 'w-0 bg-secondary-container/0 group-hover:w-16 group-hover:bg-on-surface/8'
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
        class="text-label-medium transition-[font-weight] duration-150"
        :class="item.value === modelValue ? 'font-bold' : 'font-medium'"
      >
        {{ item.label }}
      </span>
    </button>
  </nav>
</template>
