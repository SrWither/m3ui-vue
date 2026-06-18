<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MIcon from './MIcon.vue'

export interface CommandItem {
  id: string
  label: string
  icon?: string
  shortcut?: string
  group?: string
  disabled?: boolean
  onSelect?: () => void
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    items: CommandItem[]
    placeholder?: string
    noResultsText?: string
    hotkey?: string
  }>(),
  {
    placeholder: 'Buscar comando...',
    noResultsText: 'Sin resultados',
    hotkey: 'k',
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [CommandItem]
}>()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  if (!query.value) return props.items.filter(i => !i.disabled)
  const q = query.value.toLowerCase()
  return props.items.filter(
    i => !i.disabled && (i.label.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q)),
  )
})

const grouped = computed(() => {
  const map = new Map<string, CommandItem[]>()
  for (const item of filtered.value) {
    const g = item.group ?? ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  return map
})

function open() {
  emit('update:modelValue', true)
}

function close() {
  query.value = ''
  activeIndex.value = 0
  emit('update:modelValue', false)
}

function selectItem(item: CommandItem) {
  emit('select', item)
  item.onSelect?.()
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % filtered.value.length
    scrollToActive()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + filtered.value.length) % filtered.value.length
    scrollToActive()
  } else if (e.key === 'Enter' && filtered.value.length) {
    e.preventDefault()
    selectItem(filtered.value[activeIndex.value])
  } else if (e.key === 'Escape') {
    close()
  }
}

function scrollToActive() {
  nextTick(() => {
    const el = document.querySelector('[data-cmd-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === props.hotkey) {
    e.preventDefault()
    if (props.modelValue) close()
    else open()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.body.style.overflow = 'hidden'
      nextTick(() => inputRef.value?.focus())
    } else {
      document.body.style.overflow = ''
    }
  },
)

watch(query, () => { activeIndex.value = 0 })

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-cmd">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
        @click.self="close"
      >
        <div class="cmd-box flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface-container-high shadow-elevation-3">
          <!-- Search input -->
          <div class="flex items-center gap-3 border-b border-outline-variant px-4">
            <MIcon name="search" :size="20" class="shrink-0 text-on-surface-variant" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="placeholder"
              class="h-12 flex-1 bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant/50"
              @keydown="onKeydown"
            />
            <kbd class="rounded bg-surface-container px-1.5 py-0.5 text-label-small text-on-surface-variant">
              ESC
            </kbd>
          </div>

          <!-- Results -->
          <div class="max-h-80 overflow-y-auto py-2">
            <template v-if="filtered.length">
              <template v-for="[group, items] in grouped" :key="group">
                <p v-if="group" class="px-4 pt-3 pb-1 text-label-small font-medium tracking-wide text-on-surface-variant uppercase">
                  {{ group }}
                </p>
                <button
                  v-for="(item, i) in items"
                  :key="item.id"
                  type="button"
                  :data-cmd-active="filtered.indexOf(item) === activeIndex || undefined"
                  class="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  :class="filtered.indexOf(item) === activeIndex ? 'bg-primary/12 text-primary' : 'text-on-surface hover:bg-on-surface/4'"
                  @click="selectItem(item)"
                  @pointerenter="activeIndex = filtered.indexOf(item)"
                >
                  <MIcon v-if="item.icon" :name="item.icon" :size="20" class="shrink-0 opacity-70" />
                  <span class="flex-1 truncate text-body-medium">{{ item.label }}</span>
                  <kbd v-if="item.shortcut" class="rounded bg-surface-container px-1.5 py-0.5 text-label-small text-on-surface-variant">
                    {{ item.shortcut }}
                  </kbd>
                </button>
              </template>
            </template>
            <p v-else class="px-4 py-6 text-center text-body-medium text-on-surface-variant">
              {{ noResultsText }}
            </p>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-4 border-t border-outline-variant px-4 py-2">
            <span class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <kbd class="rounded bg-surface-container px-1 py-0.5">↑↓</kbd> navegar
            </span>
            <span class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <kbd class="rounded bg-surface-container px-1 py-0.5">↵</kbd> seleccionar
            </span>
            <span class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <kbd class="rounded bg-surface-container px-1 py-0.5">esc</kbd> cerrar
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-cmd-enter-active,
.m3-cmd-leave-active {
  transition: opacity 0.15s ease;
}
.m3-cmd-enter-from,
.m3-cmd-leave-to {
  opacity: 0;
}
.m3-cmd-enter-active .cmd-box,
.m3-cmd-leave-active .cmd-box {
  transition: transform 0.15s ease;
}
.m3-cmd-enter-from .cmd-box,
.m3-cmd-leave-to .cmd-box {
  transform: scale(0.95) translateY(-10px);
}
</style>
