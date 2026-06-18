<script setup lang="ts">
import { computed } from 'vue'
import MIconButton from './MIconButton.vue'

const props = defineProps<{ page: number; perPage: number; total: number }>()
const emit = defineEmits<{ 'update:page': [number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

const rangeLabel = computed(() => {
  if (props.total === 0) return '0 resultados'
  const from = (props.page - 1) * props.perPage + 1
  const to = Math.min(props.page * props.perPage, props.total)
  return `${from}-${to} de ${props.total}`
})
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4 text-body-medium text-on-surface-variant">
    <span>{{ rangeLabel }}</span>
    <div class="flex items-center gap-2">
      <span>Página {{ page }} de {{ totalPages }}</span>
      <MIconButton
        icon="chevron_left"
        label="Página anterior"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      />
      <MIconButton
        icon="chevron_right"
        label="Página siguiente"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      />
    </div>
  </div>
</template>
