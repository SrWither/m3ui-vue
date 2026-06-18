<script setup lang="ts">
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'

export interface NavRailItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
  disabled?: boolean
}

withDefaults(defineProps<{
  modelValue: string | number
  items: NavRailItem[]
  alignment?: 'top' | 'center' | 'bottom'
}>(), { alignment: 'top' })

defineEmits<{ 'update:modelValue': [string | number] }>()
</script>

<template>
  <nav class="flex h-full w-20 flex-col items-center border-r border-outline-variant bg-surface">
    <!-- FAB slot -->
    <div v-if="$slots.fab" class="flex shrink-0 items-center justify-center pt-3 pb-2">
      <slot name="fab" />
    </div>

    <!-- Items -->
    <div
      class="flex flex-1 flex-col items-center gap-1 py-3"
      :class="{
        'justify-start': alignment === 'top',
        'justify-center': alignment === 'center',
        'justify-end': alignment === 'bottom',
      }"
    >
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="group flex w-full cursor-pointer flex-col items-center justify-center gap-1 px-3 py-2 focus-visible:outline-none"
        :class="item.disabled ? 'cursor-not-allowed opacity-[0.38]' : ''"
        :disabled="item.disabled"
        @click="!item.disabled && $emit('update:modelValue', item.value)"
      >
        <!-- Pill indicator -->
        <span
          class="inline-flex h-8 items-center justify-center rounded-2xl transition-all duration-200"
          :class="
            item.value === modelValue
              ? 'w-14 bg-secondary-container text-on-secondary-container'
              : 'w-14 bg-transparent text-on-surface-variant group-hover:bg-on-surface/8'
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
          class="max-w-[56px] truncate text-center text-label-medium"
          :class="
            item.value === modelValue
              ? 'font-bold text-on-surface'
              : 'font-medium text-on-surface-variant'
          "
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>
</template>
