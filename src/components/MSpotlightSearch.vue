<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MIcon from './MIcon.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

export interface SpotlightResult {
  id: string | number
  title: string
  description?: string
  icon?: string
  category?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    results?: SpotlightResult[]
    placeholder?: string
    loading?: boolean
    noResultsText?: string
    hotkey?: string
    debounce?: number
    navigateHint?: string
    openHint?: string
    closeHint?: string
  }>(),
  {
    results: () => [],
    loading: false,
    hotkey: '/',
    debounce: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  search: [string]
  select: [SpotlightResult]
}>()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const hasQuery = computed(() => query.value.trim().length > 0)

const grouped = computed(() => {
  const map = new Map<string, SpotlightResult[]>()
  for (const r of props.results) {
    const cat = r.category ?? ''
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(r)
  }
  return map
})

function close() {
  query.value = ''
  activeIndex.value = 0
  emit('update:modelValue', false)
}

function selectResult(result: SpotlightResult) {
  emit('select', result)
  close()
}

function emitSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (props.debounce > 0) {
    debounceTimer = setTimeout(() => emit('search', query.value), props.debounce)
  } else {
    emit('search', query.value)
  }
}

function onKeydown(e: KeyboardEvent) {
  const len = props.results.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = len ? (activeIndex.value + 1) % len : 0
    scrollToActive()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = len ? (activeIndex.value - 1 + len) % len : 0
    scrollToActive()
  } else if (e.key === 'Enter' && len) {
    e.preventDefault()
    selectResult(props.results[activeIndex.value]!)
  } else if (e.key === 'Escape') {
    close()
  }
}

function scrollToActive() {
  nextTick(() => {
    const el = document.querySelector('[data-spot-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onGlobalKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
  if (e.key === props.hotkey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    emit('update:modelValue', true)
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

watch(query, () => {
  activeIndex.value = 0
  emitSearch()
})

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-spot">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]"
        @click.self="close"
      >
        <div class="spot-box flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface-container-high shadow-elevation-3">
          <!-- Search bar -->
          <div class="flex items-center gap-3 px-5 py-1">
            <MIcon name="search" :size="24" class="shrink-0 text-primary" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :placeholder="placeholder ?? locale.search"
              class="h-14 flex-1 bg-transparent text-title-medium text-on-surface outline-none placeholder:text-on-surface-variant/50"
              @keydown="onKeydown"
            />
            <MSpinner v-if="loading" :size="20" class="shrink-0 text-primary" />
            <button
              v-else-if="hasQuery"
              type="button"
              class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
              @click="query = ''"
            >
              <MIcon name="close" :size="18" />
            </button>
          </div>

          <!-- Results -->
          <div v-if="hasQuery" class="max-h-96 overflow-y-auto border-t border-outline-variant">
            <template v-if="results.length">
              <template v-for="[category, items] in grouped" :key="category">
                <p v-if="category" class="px-5 pt-4 pb-1 text-label-small font-medium tracking-wide text-on-surface-variant uppercase">
                  {{ category }}
                </p>
                <button
                  v-for="item in items"
                  :key="item.id"
                  type="button"
                  :data-spot-active="results.indexOf(item) === activeIndex || undefined"
                  class="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors"
                  :class="results.indexOf(item) === activeIndex ? 'bg-primary/12' : 'hover:bg-on-surface/4'"
                  @click="selectResult(item)"
                  @pointerenter="activeIndex = results.indexOf(item)"
                >
                  <div
                    v-if="item.icon"
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container"
                  >
                    <MIcon :name="item.icon" :size="20" class="text-on-primary-container" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-body-medium text-on-surface">{{ item.title }}</p>
                    <p v-if="item.description" class="truncate text-body-small text-on-surface-variant">
                      {{ item.description }}
                    </p>
                  </div>
                  <MIcon name="arrow_forward" :size="16" class="shrink-0 text-on-surface-variant/40" />
                </button>
              </template>
            </template>
            <div v-else-if="!loading" class="flex flex-col items-center gap-2 py-10">
              <MIcon name="search_off" :size="40" class="text-on-surface-variant/40" />
              <p class="text-body-medium text-on-surface-variant">{{ noResultsText ?? locale.noResults }}</p>
            </div>
          </div>

          <!-- Hints -->
          <div class="flex items-center gap-4 border-t border-outline-variant px-5 py-2">
            <span class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <kbd class="rounded bg-surface-container px-1 py-0.5">↑↓</kbd> {{ navigateHint ?? locale.navigateHint }}
            </span>
            <span class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <kbd class="rounded bg-surface-container px-1 py-0.5">↵</kbd> {{ openHint ?? locale.openHint }}
            </span>
            <span class="flex items-center gap-1 text-label-small text-on-surface-variant">
              <kbd class="rounded bg-surface-container px-1 py-0.5">esc</kbd> {{ closeHint ?? locale.closeHint }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-spot-enter-active,
.m3-spot-leave-active {
  transition: opacity 0.15s ease;
}
.m3-spot-enter-from,
.m3-spot-leave-to {
  opacity: 0;
}
.m3-spot-enter-active .spot-box,
.m3-spot-leave-active .spot-box {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.m3-spot-enter-from .spot-box {
  transform: scale(0.96) translateY(-8px);
  opacity: 0;
}
.m3-spot-leave-to .spot-box {
  transform: scale(0.98);
  opacity: 0;
}
</style>
