<script setup lang="ts">
import MIcon from './MIcon.vue'

export interface BreadcrumbItem {
  label: string
  icon?: string
  to?: string
  disabled?: boolean
}

withDefaults(defineProps<{
  items: BreadcrumbItem[]
  separator?: string
}>(), { separator: 'chevron_right' })

defineEmits<{ select: [BreadcrumbItem, number] }>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="flex items-center gap-1 overflow-x-auto text-label-large">
    <template v-for="(item, i) in items" :key="i">
      <!-- Separator -->
      <MIcon
        v-if="i > 0"
        :name="separator"
        :size="18"
        class="shrink-0 text-on-surface-variant"
      />

      <!-- Item -->
      <button
        v-if="i < items.length - 1 && !item.disabled"
        type="button"
        class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-1 text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none"
        @click="$emit('select', item, i)"
      >
        <MIcon v-if="item.icon" :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>

      <!-- Last item (current page) or disabled -->
      <span
        v-else
        class="flex shrink-0 items-center gap-1.5 px-1.5 py-1"
        :class="item.disabled ? 'text-on-surface/38' : 'font-medium text-on-surface'"
      >
        <MIcon v-if="item.icon" :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </span>
    </template>
  </nav>
</template>
