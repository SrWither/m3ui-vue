<script setup lang="ts">
import { ref } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'

export interface KanbanCard {
  id: string | number
  [key: string]: any
}

export interface KanbanColumn {
  id: string | number
  title: string
  cards: KanbanCard[]
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
}

const props = defineProps<{
  modelValue: KanbanColumn[]
}>()

const emit = defineEmits<{
  'update:modelValue': [KanbanColumn[]]
  cardMove: [{ cardId: string | number; fromColumn: string | number; toColumn: string | number; toIndex: number }]
  cardClick: [{ card: KanbanCard; columnId: string | number }]
}>()

const dragCard = ref<{ cardId: string | number; columnId: string | number } | null>(null)
const overColumn = ref<string | number | null>(null)
const overCardIndex = ref<number | null>(null)

const colorMap: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
  success: 'bg-success',
}

function onCardDragStart(e: DragEvent, card: KanbanCard, columnId: string | number) {
  dragCard.value = { cardId: card.id, columnId }
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(card.id))
  }
}

function onColumnDragOver(e: DragEvent, columnId: string | number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overColumn.value = columnId
}

function onCardDragOver(e: DragEvent, _card: KanbanCard, index: number, columnId: string | number) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overColumn.value = columnId
  overCardIndex.value = index
}

function onDrop(e: DragEvent, toColumnId: string | number) {
  e.preventDefault()
  if (!dragCard.value) return

  const { cardId, columnId: fromColumnId } = dragCard.value
  if (fromColumnId === toColumnId && overCardIndex.value === null) {
    reset()
    return
  }

  const columns = props.modelValue.map((col) => ({ ...col, cards: [...col.cards] }))
  const fromCol = columns.find((c) => c.id === fromColumnId)
  const toCol = columns.find((c) => c.id === toColumnId)
  if (!fromCol || !toCol) { reset(); return }

  const cardIndex = fromCol.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) { reset(); return }

  const removed = fromCol.cards.splice(cardIndex, 1)
  const toIndex = overCardIndex.value ?? toCol.cards.length
  toCol.cards.splice(toIndex, 0, removed[0]!)

  emit('update:modelValue', columns)
  emit('cardMove', { cardId, fromColumn: fromColumnId, toColumn: toColumnId, toIndex })
  reset()
}

function reset() {
  dragCard.value = null
  overColumn.value = null
  overCardIndex.value = null
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-2">
    <div
      v-for="column in modelValue"
      :key="column.id"
      class="flex w-72 shrink-0 flex-col rounded-xl bg-surface-container-low"
      :class="overColumn === column.id && dragCard ? 'ring-2 ring-primary ring-inset' : ''"
      @dragover="onColumnDragOver($event, column.id)"
      @dragleave="overColumn = null"
      @drop="onDrop($event, column.id)"
    >
      <!-- Column header -->
      <div class="flex items-center gap-2 px-4 py-3">
        <div v-if="column.color" class="h-2.5 w-2.5 rounded-full" :class="colorMap[column.color] ?? 'bg-primary'" />
        <h3 class="flex-1 text-title-small font-medium text-on-surface">{{ column.title }}</h3>
        <span class="rounded-full bg-surface-container-high px-2 py-0.5 text-label-small text-on-surface-variant">
          {{ column.cards.length }}
        </span>
      </div>

      <!-- Cards area -->
      <div class="flex min-h-[60px] flex-1 flex-col gap-2 px-3 pb-3">
        <div
          v-for="(card, index) in column.cards"
          :key="card.id"
          draggable="true"
          class="cursor-grab rounded-lg bg-surface p-3 shadow-elevation-1 transition-all duration-150 active:cursor-grabbing"
          :class="[
            dragCard?.cardId === card.id ? 'opacity-30' : 'hover:shadow-elevation-2',
            overCardIndex === index && overColumn === column.id && dragCard ? 'border-t-2 border-primary' : '',
          ]"
          @dragstart="onCardDragStart($event, card, column.id)"
          @dragover="onCardDragOver($event, card, index, column.id)"
          @dragend="reset"
          @click="emit('cardClick', { card, columnId: column.id })"
        >
          <slot name="card" :card="card" :column="column">
            <p class="text-body-medium text-on-surface">{{ card.id }}</p>
          </slot>
        </div>

        <!-- Empty state -->
        <div
          v-if="column.cards.length === 0"
          class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-outline-variant/50 p-4"
        >
          <p class="text-body-small text-on-surface-variant/60">Sin tarjetas</p>
        </div>
      </div>
    </div>
  </div>
</template>
