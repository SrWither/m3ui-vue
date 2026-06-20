<script setup lang="ts">
import { ref, computed } from 'vue'
import MIcon from './MIcon.vue'
import MTextField from './MTextField.vue'
import { emojiCategories, type EmojiCategory } from '../data/emojis'

const props = withDefaults(
  defineProps<{
    /** Which categories to show (ids). All if empty. */
    categories?: string[]
    /** Show search bar */
    search?: boolean
    /** Number of recent columns */
    columns?: number
    /** Emoji render size in px */
    emojiSize?: number
  }>(),
  { search: true, columns: 8, emojiSize: 28 },
)

const emit = defineEmits<{
  select: [emoji: string]
}>()

const query = ref('')
const activeCategory = ref<string | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const categoryRefs = ref<Record<string, HTMLElement>>({})

const visibleCategories = computed<EmojiCategory[]>(() => {
  if (props.categories?.length) {
    return emojiCategories.filter((c) => props.categories!.includes(c.id))
  }
  return emojiCategories
})

const filteredCategories = computed(() => {
  if (!query.value) return visibleCategories.value
  const q = query.value.toLowerCase()
  return visibleCategories.value
    .map((cat) => ({
      ...cat,
      emojis: cat.id.includes(q) || cat.label.toLowerCase().includes(q)
        ? cat.emojis
        : [],
    }))
    .filter((cat) => cat.emojis.length > 0)
})

function scrollToCategory(id: string) {
  activeCategory.value = id
  const el = categoryRefs.value[id]
  if (el && scrollContainer.value) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function selectEmoji(emoji: string) {
  emit('select', emoji)
}

function setCategoryRef(id: string, el: any) {
  if (el) categoryRefs.value[id] = el as HTMLElement
}
</script>

<template>
  <div class="flex w-full flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
    <!-- Search -->
    <div v-if="search" class="px-3 pt-3">
      <MTextField
        v-model="query"
        label="Search"
        leading-icon="search"
        variant="outlined"
      />
    </div>

    <!-- Category tabs -->
    <div class="flex gap-0.5 overflow-x-auto border-b border-outline-variant px-2 py-1.5">
      <button
        v-for="cat in visibleCategories"
        :key="cat.id"
        type="button"
        :title="cat.label"
        class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-100"
        :class="activeCategory === cat.id
          ? 'bg-secondary-container text-on-secondary-container'
          : 'text-on-surface-variant hover:bg-on-surface/8'"
        @click="scrollToCategory(cat.id)"
      >
        <MIcon :name="cat.icon" :size="20" />
      </button>
    </div>

    <!-- Emoji grid -->
    <div ref="scrollContainer" class="overflow-y-auto overflow-x-hidden px-2" style="max-height: 320px">
      <template v-for="cat in filteredCategories" :key="cat.id">
        <div :ref="(el) => setCategoryRef(cat.id, el)">
          <p class="sticky -top-px z-10 -mx-2 bg-surface-container px-3 py-1.5 text-label-medium text-on-surface-variant">
            {{ cat.label }}
          </p>
          <div class="grid gap-0.5" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
            <button
              v-for="emoji in cat.emojis"
              :key="emoji"
              type="button"
              class="flex cursor-pointer items-center justify-center rounded-lg p-1 transition-transform duration-75 hover:scale-115 hover:bg-on-surface/8 active:scale-95"
              :style="{ fontSize: `${emojiSize}px`, height: `${emojiSize + 10}px` }"
              @click="selectEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </template>

      <p
        v-if="query && filteredCategories.length === 0"
        class="py-8 text-center text-body-medium text-on-surface-variant"
      >
        No results
      </p>
    </div>
  </div>
</template>
