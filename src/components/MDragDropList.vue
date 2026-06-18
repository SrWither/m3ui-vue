<script setup lang="ts">
import { ref, computed } from 'vue'
import MIcon from './MIcon.vue'

export interface DragDropItem {
  id: string | number
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue: DragDropItem[]
    handle?: boolean
  }>(),
  { handle: false },
)

const emit = defineEmits<{
  'update:modelValue': [DragDropItem[]]
  reorder: [{ from: number; to: number; items: DragDropItem[] }]
}>()

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overIndex.value = index
}

function onDragLeave() {
  overIndex.value = null
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault()
  const fromIndex = dragIndex.value
  if (fromIndex === null || fromIndex === toIndex) {
    reset()
    return
  }

  const items = [...props.modelValue]
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)

  emit('update:modelValue', items)
  emit('reorder', { from: fromIndex, to: toIndex, items })
  reset()
}

function onDragEnd() {
  reset()
}

function reset() {
  dragIndex.value = null
  overIndex.value = null
}

function getItemClass(index: number) {
  if (dragIndex.value === index) return 'opacity-30'
  if (overIndex.value === index && dragIndex.value !== null) return 'ring-2 ring-primary ring-inset'
  return ''
}
</script>

<template>
  <div class="flex flex-col" role="listbox">
    <div
      v-for="(item, index) in modelValue"
      :key="item.id"
      :draggable="!handle"
      class="group flex items-center gap-2 rounded-lg px-3 py-2 transition-all"
      :class="[
        getItemClass(index),
        !handle && 'cursor-grab active:cursor-grabbing',
      ]"
      @dragstart="!handle && onDragStart($event, index)"
      @dragover="onDragOver($event, index)"
      @dragleave="onDragLeave"
      @drop="onDrop($event, index)"
      @dragend="onDragEnd"
      role="option"
    >
      <div
        v-if="handle"
        class="flex shrink-0 cursor-grab items-center justify-center rounded p-0.5 text-on-surface-variant/50 transition-colors hover:text-on-surface-variant active:cursor-grabbing"
        draggable="true"
        @dragstart="onDragStart($event, index)"
      >
        <MIcon name="drag_indicator" :size="20" />
      </div>

      <div class="min-w-0 flex-1">
        <slot :item="item" :index="index">
          <span class="text-body-medium text-on-surface">{{ item.id }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>
