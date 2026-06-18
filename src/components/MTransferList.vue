<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MCheckbox from './MCheckbox.vue'

export interface TransferItem {
  value: string | number
  label: string
  icon?: string
}

const props = withDefaults(defineProps<{
  modelValue: (string | number)[]
  items: TransferItem[]
  sourceTitle?: string
  targetTitle?: string
  filterable?: boolean
}>(), { sourceTitle: 'Disponibles', targetTitle: 'Seleccionados', filterable: false })

const emit = defineEmits<{ 'update:modelValue': [(string | number)[]] }>()

const checkedSource = ref<Set<string | number>>(new Set())
const checkedTarget = ref<Set<string | number>>(new Set())
const sourceSearch = ref('')
const targetSearch = ref('')

const sourceItems = computed(() => {
  const selected = new Set(props.modelValue)
  let list = props.items.filter(i => !selected.has(i.value))
  if (sourceSearch.value) {
    const q = sourceSearch.value.toLowerCase()
    list = list.filter(i => i.label.toLowerCase().includes(q))
  }
  return list
})

const targetItems = computed(() => {
  const selected = new Set(props.modelValue)
  let list = props.items.filter(i => selected.has(i.value))
  if (targetSearch.value) {
    const q = targetSearch.value.toLowerCase()
    list = list.filter(i => i.label.toLowerCase().includes(q))
  }
  return list
})

function toggleSource(value: string | number) {
  const s = new Set(checkedSource.value)
  s.has(value) ? s.delete(value) : s.add(value)
  checkedSource.value = s
}
function toggleTarget(value: string | number) {
  const s = new Set(checkedTarget.value)
  s.has(value) ? s.delete(value) : s.add(value)
  checkedTarget.value = s
}

function moveRight() {
  const next = [...props.modelValue, ...checkedSource.value]
  emit('update:modelValue', next)
  checkedSource.value = new Set()
}
function moveLeft() {
  const remove = checkedTarget.value
  emit('update:modelValue', props.modelValue.filter(v => !remove.has(v)))
  checkedTarget.value = new Set()
}
function moveAllRight() {
  const all = sourceItems.value.map(i => i.value)
  emit('update:modelValue', [...props.modelValue, ...all])
  checkedSource.value = new Set()
}
function moveAllLeft() {
  const keep = targetItems.value.map(i => i.value)
  emit('update:modelValue', props.modelValue.filter(v => !new Set(keep).has(v)))
  checkedTarget.value = new Set()
}
</script>

<template>
  <div class="flex items-stretch gap-2">
    <!-- Source list -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-variant">
      <div class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-3 py-2">
        <span class="text-label-large font-medium text-on-surface">{{ sourceTitle }}</span>
        <span class="text-label-small text-on-surface-variant">{{ sourceItems.length }}</span>
      </div>
      <div v-if="filterable" class="border-b border-outline-variant px-3 py-2">
        <input
          v-model="sourceSearch"
          type="text"
          placeholder="Buscar..."
          class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 240px">
        <button
          v-for="item in sourceItems"
          :key="item.value"
          type="button"
          class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-on-surface/4"
          @click="toggleSource(item.value)"
        >
          <MCheckbox :model-value="checkedSource.has(item.value)" @update:model-value="toggleSource(item.value)" />
          <MIcon v-if="item.icon" :name="item.icon" :size="18" class="shrink-0 text-on-surface-variant" />
          <span class="flex-1 truncate text-body-medium text-on-surface">{{ item.label }}</span>
        </button>
        <p v-if="!sourceItems.length" class="px-3 py-4 text-center text-body-small text-on-surface-variant">
          Sin elementos
        </p>
      </div>
    </div>

    <!-- Transfer buttons -->
    <div class="flex flex-col items-center justify-center gap-1">
      <MIconButton
        icon="keyboard_double_arrow_right"
        label="Mover todos a la derecha"
        :size="36"
        :disabled="!sourceItems.length"
        @click="moveAllRight"
      />
      <MIconButton
        icon="chevron_right"
        label="Mover seleccionados a la derecha"
        variant="tonal"
        :size="36"
        :disabled="!checkedSource.size"
        @click="moveRight"
      />
      <MIconButton
        icon="chevron_left"
        label="Mover seleccionados a la izquierda"
        variant="tonal"
        :size="36"
        :disabled="!checkedTarget.size"
        @click="moveLeft"
      />
      <MIconButton
        icon="keyboard_double_arrow_left"
        label="Mover todos a la izquierda"
        :size="36"
        :disabled="!targetItems.length"
        @click="moveAllLeft"
      />
    </div>

    <!-- Target list -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-variant">
      <div class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-3 py-2">
        <span class="text-label-large font-medium text-on-surface">{{ targetTitle }}</span>
        <span class="text-label-small text-on-surface-variant">{{ targetItems.length }}</span>
      </div>
      <div v-if="filterable" class="border-b border-outline-variant px-3 py-2">
        <input
          v-model="targetSearch"
          type="text"
          placeholder="Buscar..."
          class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 240px">
        <button
          v-for="item in targetItems"
          :key="item.value"
          type="button"
          class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-on-surface/4"
          @click="toggleTarget(item.value)"
        >
          <MCheckbox :model-value="checkedTarget.has(item.value)" @update:model-value="toggleTarget(item.value)" />
          <MIcon v-if="item.icon" :name="item.icon" :size="18" class="shrink-0 text-on-surface-variant" />
          <span class="flex-1 truncate text-body-medium text-on-surface">{{ item.label }}</span>
        </button>
        <p v-if="!targetItems.length" class="px-3 py-4 text-center text-body-small text-on-surface-variant">
          Sin elementos
        </p>
      </div>
    </div>
  </div>
</template>
