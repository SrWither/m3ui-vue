<script setup lang="ts">
/**
 * Simple previous/next page navigation with an automatically computed page range label. Its texts (“1–10 of
 * 25”, “Page 1 of 3” and the buttons’ labels) come from the app’s locale.
 *
 * @event update:page Emitted when the previous/next button is clicked — drive page with it for v-model-style
 *   two-way binding
 */
import { computed } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  /** Current page (1-based) */
  page: number
  /** Items per page */
  perPage: number
  /** Total number of items */
  total: number
}>()
const emit = defineEmits<{ 'update:page': [number] }>()
const t = useLocale()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

const rangeLabel = computed(() => {
  if (props.total === 0) return t.noResults
  const from = (props.page - 1) * props.perPage + 1
  const to = Math.min(props.page * props.perPage, props.total)
  return t.paginationRange.replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(props.total))
})
const pageLabel = computed(() => t.paginationPage.replace('{page}', String(props.page)).replace('{pages}', String(totalPages.value)))
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4 text-body-medium text-on-surface-variant">
    <span>{{ rangeLabel }}</span>
    <div class="flex items-center gap-2">
      <span>{{ pageLabel }}</span>
      <MIconButton
        icon="chevron_left"
        :label="t.previousPage"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      />
      <MIconButton
        icon="chevron_right"
        :label="t.nextPage"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      />
    </div>
  </div>
</template>
