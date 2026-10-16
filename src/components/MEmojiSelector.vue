<script setup lang="ts">
/*
 * Emoji picker. M3 has no emoji component; the reference is Google's own androidx
 * EmojiPickerView (a category bar with Recent first, a grid with headers, skin-tone variants on
 * long press) plus Gboard's search.
 *
 * Data: src/data/emojis.ts (Unicode emoji-test, generated) ships with the component; names and
 * keywords (CLDR, one file per language in src/data/emoji-names/) load on demand, for the app's
 * language plus English while searching.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale, type M3Locale } from '../composables/useLocale'
import { emojiCategories, toneableEmojis, withSkinTone, type EmojiCategory } from '../data/emojis'

const props = withDefaults(
  defineProps<{
    /** Which categories to show (ids). All if empty. */
    categories?: string[]
    /** Show the search field. */
    search?: boolean
    /** Fixed number of columns. By default as many as fit. */
    columns?: number
    /** Emoji size in px. */
    emojiSize?: number
    /** Remember picked emoji and show them first (stored in localStorage). */
    recent?: boolean
    /** How many recent emoji to keep. */
    recentLimit?: number
    /** Offer skin tones (long press, right click or Shift+Enter on an emoji, or the footer button). */
    skinTones?: boolean
    /** Show the hovered or focused emoji with its name at the bottom. */
    preview?: boolean
    /** Height of the scrolling grid. */
    height?: string
  }>(),
  { search: true, emojiSize: 28, recent: true, recentLimit: 24, skinTones: true, preview: true, height: '320px' },
)

const emit = defineEmits<{
  select: [emoji: string]
}>()

const t = useLocale()

// ── Names (lazy, per language) ────────────────────────────────────────────────────────────────

type Names = Record<string, string>
const loaders: Record<string, () => Promise<{ default: Names }>> = {
  en: () => import('../data/emoji-names/emoji-names-en'),
  es: () => import('../data/emoji-names/emoji-names-es'),
  fr: () => import('../data/emoji-names/emoji-names-fr'),
  pt: () => import('../data/emoji-names/emoji-names-pt'),
  de: () => import('../data/emoji-names/emoji-names-de'),
  ja: () => import('../data/emoji-names/emoji-names-ja'),
  zh: () => import('../data/emoji-names/emoji-names-zh'),
  ko: () => import('../data/emoji-names/emoji-names-ko'),
}
const lang = computed(() => {
  const code = (t.lang || 'en').slice(0, 2).toLowerCase()
  return code in loaders ? code : 'en'
})
const names = shallowRef<Names | null>(null)
const englishNames = shallowRef<Names | null>(null)

async function load(code: string) {
  return (await loaders[code]!()).default
}
watch(lang, async (code) => {
  names.value = await load(code)
  if (code === 'en') englishNames.value = names.value
}, { immediate: true })

/** The emoji's name in the app's language (its first entry). */
function nameOf(emoji: string) {
  const entry = names.value?.[emoji]
  if (!entry) return ''
  const name = entry.slice(0, entry.indexOf('|') === -1 ? undefined : entry.indexOf('|'))
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ── Recent and skin tone (per viewer, localStorage) ───────────────────────────────────────────

const RECENT_KEY = 'm3-emoji-recent'
const TONE_KEY = 'm3-emoji-tone'
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}
function store(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage blocked */ }
}
const recents = ref<string[]>(read<string[]>(RECENT_KEY, []))
const tone = ref<number>(read<number>(TONE_KEY, 0))

const show = (emoji: string) => (props.skinTones ? withSkinTone(emoji, tone.value) : emoji)
/** Toned variant → its base emoji, for names and the tone row (recent emoji are stored toned). */
const toneBase = new Map<string, string>()
for (const e of toneableEmojis) for (let i = 1; i <= 5; i++) toneBase.set(withSkinTone(e, i), e)
const baseOf = (emoji: string) => toneBase.get(emoji) ?? emoji

function pick(emoji: string) {
  emit('select', emoji)
  if (props.recent) {
    recents.value = [emoji, ...recents.value.filter((e) => e !== emoji)].slice(0, props.recentLimit)
    store(RECENT_KEY, recents.value)
  }
}

// ── Sections ──────────────────────────────────────────────────────────────────────────────────

const categoryLabel: Record<string, keyof M3Locale> = {
  smileys: 'emojiCategorySmileys', gestures: 'emojiCategoryGestures', people: 'emojiCategoryPeople',
  animals: 'emojiCategoryAnimals', nature: 'emojiCategoryNature', food: 'emojiCategoryFood',
  activities: 'emojiCategoryActivities', travel: 'emojiCategoryTravel', objects: 'emojiCategoryObjects',
  symbols: 'emojiCategorySymbols', flags: 'emojiCategoryFlags',
}
const labelOf = (c: EmojiCategory) => (categoryLabel[c.id] ? String(t[categoryLabel[c.id]!]) : c.label)

const visibleCategories = computed<EmojiCategory[]>(() =>
  props.categories?.length ? emojiCategories.filter((c) => props.categories!.includes(c.id)) : emojiCategories,
)

interface Section { id: string; label: string; icon: string; emojis: string[] }

const query = ref('')
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

watch(query, (q) => {
  // Searching also matches English names, which people often type regardless of the UI language.
  if (q && !englishNames.value) load('en').then((n) => (englishNames.value = n))
})

const searchIndex = computed(() => {
  const local = names.value
  const english = englishNames.value
  if (!local && !english) return []
  return visibleCategories.value.flatMap((c) =>
    c.emojis.map((emoji) => ({
      emoji,
      name: normalize((local?.[emoji] ?? '').split('|')[0] ?? ''),
      text: normalize(`${local?.[emoji] ?? ''}|${english && english !== local ? english[emoji] ?? '' : ''}`),
    })),
  )
})

const results = computed(() => {
  const q = normalize(query.value.trim())
  if (!q) return []
  const tokens = q.split(/\s+/)
  return searchIndex.value
    .filter((it) => tokens.every((tok) => it.text.includes(tok)))
    .map((it) => ({ emoji: it.emoji, rank: it.name.startsWith(q) ? 0 : it.text.split('|').some((w) => w.startsWith(tokens[0]!)) ? 1 : 2 }))
    .sort((a, b) => a.rank - b.rank)
    .map((it) => it.emoji)
})

const sections = computed<Section[]>(() => {
  if (query.value.trim()) return [{ id: 'results', label: t.emojiSearch, icon: 'search', emojis: results.value }]
  const list: Section[] = visibleCategories.value.map((c) => ({ id: c.id, label: labelOf(c), icon: c.icon, emojis: c.emojis }))
  if (props.recent && recents.value.length) list.unshift({ id: 'recent', label: t.emojiRecent, icon: 'schedule', emojis: recents.value })
  return list
})

// ── Scrolling and the category bar ────────────────────────────────────────────────────────────

const gridEl = ref<HTMLElement | null>(null)
const activeSection = ref<string | null>(null)
let scrollFrame = 0

function onScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    const grid = gridEl.value
    if (!grid) return
    let current = sections.value[0]?.id ?? null
    for (const el of grid.querySelectorAll<HTMLElement>('[data-emoji-section]')) {
      if (el.offsetTop - grid.scrollTop <= 8) current = el.dataset.emojiSection!
    }
    activeSection.value = current
  })
}

function scrollToSection(id: string) {
  const grid = gridEl.value
  const el = grid?.querySelector<HTMLElement>(`[data-emoji-section="${id}"]`)
  if (!grid || !el) return
  activeSection.value = id
  // scrollTo on the grid only: scrollIntoView() would scroll the page around it too.
  grid.scrollTo({ top: el.offsetTop, behavior: 'smooth' })
}

watch(sections, () => nextTick(onScroll))

const gridColumns = computed(() =>
  props.columns
    ? `repeat(${props.columns}, minmax(0, 1fr))`
    : `repeat(auto-fill, minmax(${props.emojiSize + 12}px, 1fr))`,
)

// ── Preview ───────────────────────────────────────────────────────────────────────────────────

const previewed = ref<string | null>(null)

// ── Keyboard (roving focus over the grid) ─────────────────────────────────────────────────────

const focusKey = ref<string | null>(null)
const keyOf = (section: string, emoji: string) => `${section}:${emoji}`
const firstKey = computed(() => {
  const s = sections.value.find((x) => x.emojis.length)
  return s ? keyOf(s.id, s.emojis[0]!) : null
})
const rovingKey = computed(() => focusKey.value ?? firstKey.value)
watch(sections, () => (focusKey.value = null))

function buttons() {
  return Array.from(gridEl.value?.querySelectorAll<HTMLElement>('[data-emoji]') ?? [])
}

/** Keeps a focused emoji in view below the sticky header, scrolling the grid only. */
function keepVisible(el: HTMLElement) {
  const grid = gridEl.value
  if (!grid) return
  const g = grid.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const header = 32
  if (r.top < g.top + header) grid.scrollTop -= g.top + header - r.top
  else if (r.bottom > g.bottom) grid.scrollTop += r.bottom - g.bottom
}

function focusButton(el: HTMLElement | undefined) {
  if (!el) return
  focusKey.value = el.dataset.key!
  el.focus({ preventScroll: true })
  keepVisible(el)
}

function onGridKeydown(e: KeyboardEvent) {
  const list = buttons()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (i === -1) return
  const cur = list[i]!
  const rect = cur.getBoundingClientRect()
  const sameColumnIn = (rows: HTMLElement[]) =>
    rows.reduce<HTMLElement | undefined>((best, el) => {
      const d = Math.abs(el.getBoundingClientRect().left - rect.left)
      return !best || d < Math.abs(best.getBoundingClientRect().left - rect.left) ? el : best
    }, undefined)
  const rowOf = (from: HTMLElement[], top: number) => from.filter((el) => Math.abs(el.getBoundingClientRect().top - top) < 2)

  if (e.key === 'ArrowRight') focusButton(list[i + 1])
  else if (e.key === 'ArrowLeft') focusButton(list[i - 1])
  else if (e.key === 'ArrowDown') {
    const next = list.slice(i + 1).find((el) => el.getBoundingClientRect().top > rect.top + 2)
    if (next) focusButton(sameColumnIn(rowOf(list.slice(i + 1), next.getBoundingClientRect().top)))
  } else if (e.key === 'ArrowUp') {
    const prev = [...list.slice(0, i)].reverse().find((el) => el.getBoundingClientRect().top < rect.top - 2)
    if (prev) focusButton(sameColumnIn(rowOf(list.slice(0, i), prev.getBoundingClientRect().top)))
    else searchEl.value?.focus()
  } else if (e.key === 'Home') focusButton(list[0])
  else if (e.key === 'End') focusButton(list[list.length - 1])
  else if ((e.key === 'Enter' && e.shiftKey) || e.key === 'ContextMenu') {
    const emoji = cur.dataset.emoji!
    if (props.skinTones && toneableEmojis.has(baseOf(emoji))) openTones(baseOf(emoji), cur)
  } else return
  e.preventDefault()
}

const searchEl = ref<HTMLInputElement | null>(null)
function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusButton(buttons()[0])
  } else if (e.key === 'Enter') {
    const first = results.value[0]
    if (first) pick(show(first))
  } else if (e.key === 'Escape' && query.value) {
    e.stopPropagation()
    query.value = ''
  }
}

// ── Skin tones ────────────────────────────────────────────────────────────────────────────────

const rootEl = ref<HTMLElement | null>(null)
const tonePicker = ref<{ emoji: string | null; x: number; y: number; below: boolean } | null>(null)
const toneLabels = computed(() => t.emojiSkinTones.split('|'))

/** Opens the tone row above `anchor`, for `emoji` (null: the default tone for every emoji). */
function openTones(emoji: string | null, anchor: HTMLElement) {
  const root = rootEl.value
  if (!root) return
  const r = root.getBoundingClientRect()
  const a = anchor.getBoundingClientRect()
  const below = a.top - r.top < 56
  tonePicker.value = { emoji, x: a.left - r.left + a.width / 2, y: below ? a.bottom - r.top + 4 : a.top - r.top - 4, below }
  nextTick(() => rootEl.value?.querySelector<HTMLElement>('[data-tone-option][aria-checked="true"]')?.focus())
}

function chooseTone(i: number) {
  const picker = tonePicker.value
  tone.value = i
  store(TONE_KEY, i)
  tonePicker.value = null
  if (picker?.emoji) pick(withSkinTone(picker.emoji, i))
}

function onToneKeydown(e: KeyboardEvent) {
  const opts = Array.from(rootEl.value?.querySelectorAll<HTMLElement>('[data-tone-option]') ?? [])
  const i = opts.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowRight') opts[Math.min(i + 1, opts.length - 1)]?.focus()
  else if (e.key === 'ArrowLeft') opts[Math.max(i - 1, 0)]?.focus()
  else if (e.key === 'Escape') {
    e.stopPropagation()
    tonePicker.value = null
  } else return
  e.preventDefault()
}

function onDocPointerDown(e: PointerEvent) {
  if (tonePicker.value && !(e.target as Element).closest('[data-tone-picker]')) tonePicker.value = null
}

// Long press (touch) opens the tones; the click that ends it doesn't also pick the emoji.
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStart = { x: 0, y: 0 }
let suppressClick = false

function onEmojiPointerDown(e: PointerEvent, base: string) {
  if (!props.skinTones || !toneableEmojis.has(base) || e.pointerType === 'mouse') return
  const target = e.currentTarget as HTMLElement
  pressStart = { x: e.clientX, y: e.clientY }
  pressTimer = setTimeout(() => {
    pressTimer = null
    suppressClick = true
    openTones(base, target)
  }, 450)
}
function onEmojiPointerMove(e: PointerEvent) {
  if (pressTimer && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 8) cancelPress()
}
function cancelPress() {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = null
}
function onEmojiClick(emoji: string) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  pick(emoji)
}
function onEmojiContextMenu(e: MouseEvent, base: string) {
  if (!props.skinTones || !toneableEmojis.has(base)) return
  e.preventDefault()
  openTones(base, e.currentTarget as HTMLElement)
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  onScroll()
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  cancelPress()
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
})

defineExpose({ focus: () => (searchEl.value ?? buttons()[0])?.focus() })
</script>

<template>
  <div ref="rootEl" class="relative flex w-full flex-col overflow-hidden rounded-xl bg-surface-container-high">
    <!-- Search -->
    <!-- Its own bottom space: while searching the category bar is gone, and the results' sticky
         header would otherwise cover the field's focus outline -->
    <div v-if="search" class="px-3 pt-3 pb-1.5">
      <label class="flex h-12 items-center gap-2 rounded-full bg-surface-container-highest px-4 focus-within:outline-2 focus-within:outline-secondary">
        <MIcon name="search" :size="20" class="shrink-0 text-on-surface-variant" />
        <input
          ref="searchEl"
          v-model="query"
          type="text"
          :placeholder="t.emojiSearch"
          :aria-label="t.emojiSearch"
          class="min-w-0 flex-1 bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
          @keydown="onSearchKeydown"
        />
        <button
          v-if="query"
          type="button"
          class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
          :aria-label="t.clearSearch"
          @click="query = ''; searchEl?.focus()"
        >
          <MIcon name="close" :size="18" />
        </button>
      </label>
    </div>

    <!-- Category bar -->
    <div v-if="!query.trim()" class="flex gap-0.5 overflow-x-auto px-2 pb-1" :class="search ? 'pt-0.5' : 'pt-2'" style="scrollbar-width: none" role="tablist">
      <button
        v-for="s in sections"
        :key="s.id"
        type="button"
        role="tab"
        :aria-selected="activeSection === s.id"
        :aria-label="s.label"
        :title="s.label"
        class="flex h-9 min-w-9 flex-1 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150"
        :class="activeSection === s.id ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-on-surface/8'"
        @click="scrollToSection(s.id)"
      >
        <MIcon :name="s.icon" :size="20" />
      </button>
    </div>

    <!-- Grid -->
    <div
      ref="gridEl"
      class="relative overflow-x-hidden overflow-y-auto px-2 pb-2"
      :style="{ height }"
      @scroll.passive="onScroll"
      @keydown="onGridKeydown"
    >
      <section
        v-for="s in sections"
        :key="s.id"
        :data-emoji-section="s.id"
        role="group"
        :aria-label="s.label"
      >
        <h3 class="sticky top-0 z-10 -mx-2 bg-surface-container-high px-3 py-1.5 text-label-medium text-on-surface-variant">{{ s.label }}</h3>
        <div class="grid gap-0.5" :style="{ gridTemplateColumns: gridColumns }">
          <button
            v-for="emoji in s.emojis"
            :key="emoji"
            type="button"
            :data-emoji="show(emoji)"
            :data-key="keyOf(s.id, emoji)"
            :tabindex="rovingKey === keyOf(s.id, emoji) ? 0 : -1"
            :aria-label="nameOf(baseOf(emoji)) || emoji"
            class="relative flex cursor-pointer items-center justify-center rounded-lg leading-none transition-transform duration-75 select-none hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-secondary active:scale-90"
            :style="{ fontSize: `${emojiSize}px`, height: `${emojiSize + 12}px` }"
            @click="onEmojiClick(show(emoji))"
            @contextmenu="onEmojiContextMenu($event, baseOf(emoji))"
            @pointerdown="onEmojiPointerDown($event, baseOf(emoji))"
            @pointermove="onEmojiPointerMove"
            @pointerup="cancelPress"
            @pointercancel="cancelPress"
            @pointerleave="cancelPress"
            @mouseenter="previewed = show(emoji)"
            @focus="previewed = show(emoji)"
          >
            {{ s.id === 'recent' ? emoji : show(emoji) }}
            <!-- Takes a skin tone: a small corner mark, like Android's picker -->
            <span
              v-if="skinTones && s.id !== 'recent' && toneableEmojis.has(emoji)"
              aria-hidden="true"
              class="absolute right-1 bottom-1 h-1.5 w-1.5 bg-on-surface-variant/50 [clip-path:polygon(100%_0,100%_100%,0_100%)]"
            />
          </button>
        </div>
      </section>

      <p v-if="query.trim() && !results.length" class="py-10 text-center text-body-medium text-on-surface-variant">
        {{ names || englishNames ? t.emojiNoResults : '…' }}
      </p>
    </div>

    <!-- Preview and default skin tone -->
    <div v-if="preview || skinTones" class="flex h-14 items-center gap-3 border-t border-outline-variant/60 px-4">
      <template v-if="preview && previewed">
        <span class="text-[32px] leading-none" aria-hidden="true">{{ previewed }}</span>
        <span class="min-w-0 flex-1 truncate text-body-medium text-on-surface">{{ nameOf(baseOf(previewed)) }}</span>
      </template>
      <span v-else class="flex-1" />
      <button
        v-if="skinTones"
        type="button"
        class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[22px] leading-none hover:bg-on-surface/8"
        :aria-label="`${t.emojiSkinTone}: ${toneLabels[tone] ?? ''}`"
        :title="t.emojiSkinTone"
        @click="openTones(null, $event.currentTarget as HTMLElement)"
      >
        {{ withSkinTone('✋', tone) }}
      </button>
    </div>

    <!-- Skin tone row -->
    <div
      v-if="tonePicker"
      data-tone-picker
      role="radiogroup"
      :aria-label="t.emojiSkinTone"
      class="absolute z-30 flex gap-0.5 rounded-full bg-surface-container-highest p-1 shadow-elevation-2"
      :style="{
        left: `clamp(4px, ${tonePicker.x}px - ${(emojiSize + 12) * 3}px, calc(100% - ${(emojiSize + 12) * 6 + 12}px))`,
        top: `${tonePicker.y}px`,
        transform: tonePicker.below ? undefined : 'translateY(-100%)',
      }"
      @keydown="onToneKeydown"
    >
      <button
        v-for="(label, i) in toneLabels"
        :key="i"
        type="button"
        role="radio"
        data-tone-option
        :aria-checked="tone === i"
        :aria-label="label"
        class="flex cursor-pointer items-center justify-center rounded-full leading-none hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-secondary"
        :class="tone === i ? 'bg-secondary-container' : ''"
        :style="{ fontSize: `${emojiSize}px`, width: `${emojiSize + 12}px`, height: `${emojiSize + 12}px` }"
        @click="chooseTone(i)"
      >
        {{ withSkinTone(tonePicker.emoji ?? '✋', i) }}
      </button>
    </div>
  </div>
</template>
