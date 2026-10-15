<script setup lang="ts">
import { computed } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{ page: number; perPage: number; total: number }>()
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
