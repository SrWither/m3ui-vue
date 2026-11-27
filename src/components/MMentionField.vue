<script setup lang="ts">
/**
 * A text field with @mentions and #tags: typing a trigger character (`@`, `#`, or any of `sources`) at the start of a
 * word opens a list at the caret, filtered as you type, from a source's `items` or its `search` function (an API,
 * debounced). Arrow keys move, Enter or Tab picks, Escape closes; picking writes the trigger and the item's label
 * into the text. The text is the v-model, plain; the picked items that are still in it are `v-model:mentions`, with
 * their ids. Multi-line by default (a chat composer, a comment box). Built on `MTextField`. Keys it uses while the
 * list is open (arrows, Enter, Tab) are `preventDefault`ed before your own `@keydown` sees them, so a composer that
 * sends on Enter checks `e.defaultPrevented`.
 *
 * @slot item One entry of the list instead of the default (avatar or icon, label, description): `{ item, source, active }`
 * @event update:modelValue The text changed
 * @event update:mentions The picked items still in the text changed
 * @event mention An item was picked: `(item, trigger)`
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch, watchEffect } from 'vue'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MAvatar from './MAvatar.vue'
import MIcon from './MIcon.vue'
import MSpinner from './MSpinner.vue'
import MTextField from './MTextField.vue'
import { useLocale } from '../composables/useLocale'
import { useEscapeStack } from '../composables/_useEscapeStack'
import { useFollowAnchor } from '../composables/_useFollowAnchor'
import { POPUP_MARGIN, fitPopup } from '../composables/_popupPosition'
import { caretRect } from '../composables/_caretPosition'

/** Something that can be mentioned. */
export interface MentionItem {
  id: string | number
  /** What's written into the text after the trigger (spaces allowed: `@Ana López`) */
  label: string
  /** A second line in the list */
  description?: string
  /** An image URL; without one, initials (or `icon`) */
  avatar?: string
  /** A Material Symbol instead of an avatar */
  icon?: string
}

/** Where a trigger character looks things up. */
export interface MentionSource {
  /** One character: `@`, `#`, `:`… */
  trigger: string
  /** The items, filtered here as the user types */
  items?: MentionItem[]
  /** Or a lookup of yours (an API): the query in, items out; `signal` aborts a replaced one */
  search?: (query: string, signal: AbortSignal) => Promise<MentionItem[]>
  /** How many to list (8) */
  limit?: number
}

/** A picked item still in the text. */
export interface MentionRef {
  trigger: string
  id: string | number
  label: string
}

// The root is the field plus a teleported list: attributes go on the field
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The text (v-model) */
    modelValue: string
    /** The picked items still in the text (v-model:mentions) */
    mentions?: MentionRef[]
    /** Trigger characters and where each looks things up */
    sources: MentionSource[]
    /** Field label */
    label: string
    /** Field style */
    variant?: 'filled' | 'outlined'
    /** Several lines (a textarea) */
    multiline?: boolean
    /** Rows when multiline */
    rows?: number
    /** Grow with the text when multiline */
    autoGrow?: boolean
    /** Stop growing at this many rows */
    maxRows?: number
    /** The delay before a `search`, in ms */
    debounce?: number
    /** Material Symbol on the left */
    leadingIcon?: string
    /** Helper text below the field */
    hint?: string
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Validation rules (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving the field (default), while typing, or only on submit */
    validateOn?: ValidateOn
    /** The key of this field in its `MForm` */
    name?: string
    /** Marks it as required */
    required?: boolean
    /** Disables the field */
    disabled?: boolean
  }>(),
  { mentions: () => [], variant: 'filled', multiline: true, rows: 3, autoGrow: true, debounce: 200 },
)

const emit = defineEmits<{
  blur: []
  'update:modelValue': [text: string]
  'update:mentions': [mentions: MentionRef[]]
  mention: [item: MentionItem, trigger: string]
}>()

const t = useLocale()
const uid = useId()
const listId = `${uid}-list`
const optionId = (i: number) => `${uid}-opt-${i}`

const field = ref<InstanceType<typeof MTextField>>()
const listEl = ref<HTMLElement>()
const inputEl = computed(() => (field.value?.inputEl as HTMLTextAreaElement | HTMLInputElement | undefined) ?? null)

/** The word being typed after a trigger: where it starts, which source, and the text so far */
const query = shallowRef<{ source: MentionSource; start: number; text: string } | null>(null)
const results = shallowRef<MentionItem[]>([])
const loading = ref(false)
const active = ref(0)
const listPos = ref<Record<string, string>>({})
let controller: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined

const open = computed(() => !!query.value && (loading.value || results.value.length > 0 || !!query.value.source.search))

// ── Finding the query ──────────────────────────────────────────────────────────────────────────

/** Accents and case don't matter when filtering */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()

function detect() {
  const el = inputEl.value
  if (!el || props.disabled) return close()
  const caret = el.selectionStart ?? 0
  if (caret !== el.selectionEnd) return close()
  const before = el.value.slice(0, caret)
  let found: typeof query.value = null
  for (const source of props.sources) {
    const i = before.lastIndexOf(source.trigger)
    if (i < 0 || (found && i < found.start)) continue
    // At the start of a word, with no space typed since
    if (i > 0 && !/\s/.test(before[i - 1]!)) continue
    const text = before.slice(i + source.trigger.length)
    if (/\s/.test(text) || text.length > 40) continue
    found = { source, start: i, text }
  }
  if (!found) return close()
  const q = query.value
  // The same query (a caret move, a key that typed nothing) keeps its object: a search on its way checks it's still current
  if (q && q.source === found.source && q.text === found.text && q.start === found.start) return
  query.value = found
  lookUp()
}

function lookUp() {
  const q = query.value
  if (!q) return
  const limit = q.source.limit ?? 8
  active.value = 0
  if (q.source.items) {
    const f = fold(q.text)
    const hits = q.source.items.filter((it) => fold(it.label).includes(f))
    // Those starting with the query first
    hits.sort((a, b) => Number(!fold(a.label).startsWith(f)) - Number(!fold(b.label).startsWith(f)))
    results.value = hits.slice(0, limit)
    return
  }
  if (!q.source.search) return
  controller?.abort()
  clearTimeout(timer)
  loading.value = true
  const search = q.source.search
  timer = setTimeout(async () => {
    controller = new AbortController()
    const mine = controller
    try {
      const items = await search(q.text, mine.signal)
      if (query.value === q) results.value = items.slice(0, limit)
    } catch {
      if (!mine.signal.aborted && query.value === q) results.value = []
    } finally {
      if (controller === mine) loading.value = false
    }
  }, props.debounce)
}

function close() {
  query.value = null
  results.value = []
  loading.value = false
  controller?.abort()
  clearTimeout(timer)
}

// ── Picking ────────────────────────────────────────────────────────────────────────────────────

function pick(item: MentionItem) {
  const q = query.value
  const el = inputEl.value
  if (!q || !el) return
  const caret = el.selectionStart ?? el.value.length
  const inserted = `${q.source.trigger}${item.label} `
  const text = props.modelValue.slice(0, q.start) + inserted + props.modelValue.slice(caret)
  close()
  emit('update:modelValue', text)
  emit('mention', item, q.source.trigger)
  emit('update:mentions', [...live(props.mentions, text), { trigger: q.source.trigger, id: item.id, label: item.label }])
  const at = q.start + inserted.length
  nextTick(() => {
    el.focus()
    el.setSelectionRange(at, at)
  })
}

/** The mentions whose text is still there, as many of each as times it appears. */
function live(list: MentionRef[], text: string) {
  const left = new Map<string, number>()
  return list.filter((m) => {
    const token = `${m.trigger}${m.label}`
    const used = left.get(token) ?? 0
    const count = text.split(token).length - 1
    if (used >= count) return false
    left.set(token, used + 1)
    return true
  })
}

function onText(value: string | number) {
  const text = String(value)
  emit('update:modelValue', text)
  const kept = live(props.mentions, text)
  if (kept.length !== props.mentions.length) emit('update:mentions', kept)
  nextTick(detect)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || !results.value.length) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = results.value.length
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    nextTick(() => listEl.value?.querySelector(`#${CSS.escape(optionId(active.value))}`)?.scrollIntoView({ block: 'nearest' }))
  } else if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
    e.preventDefault()
    const item = results.value[active.value]
    if (item) pick(item)
  }
}

// Caret moves without typing (clicks, arrows on a closed list, Home/End) can enter or leave a mention query
function onCaretMove(e: Event) {
  if (e instanceof KeyboardEvent && open.value && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return
  detect()
}

useEscapeStack(() => open.value, close)

// ── The list at the caret ──────────────────────────────────────────────────────────────────────

const WIDTH = 288
function place() {
  const el = inputEl.value
  const list = listEl.value
  if (!el || !list || !query.value) return
  const caret = caretRect(el, query.value.start)
  const box = el.getBoundingClientRect()
  // Kept to the field's height: a caret scrolled out of a tall textarea sits on its edge
  const top = Math.min(Math.max(caret.top, box.top), box.bottom - caret.height)
  const h = list.offsetHeight
  const y = fitPopup([top + caret.height + 4, top - 4 - h], h, window.innerHeight, POPUP_MARGIN)
  const x = fitPopup([caret.left, window.innerWidth - POPUP_MARGIN - WIDTH], WIDTH, window.innerWidth, POPUP_MARGIN)
  listPos.value = { top: `${y}px`, left: `${x}px`, width: `${WIDTH}px` }
}
watch([open, results, loading], () => nextTick(place))
useFollowAnchor({ open: () => open.value, anchor: inputEl as never, popup: listEl, place, close })

// The field as an ARIA combobox while a list is open
watchEffect(() => {
  const el = inputEl.value
  if (!el) return
  el.setAttribute('aria-autocomplete', 'list')
  el.setAttribute('aria-controls', listId)
  el.setAttribute('aria-expanded', String(open.value))
  if (open.value && results.value.length) el.setAttribute('aria-activedescendant', optionId(active.value))
  else el.removeAttribute('aria-activedescendant')
})

onBeforeUnmount(() => {
  controller?.abort()
  clearTimeout(timer)
})

defineExpose({
  /** Focuses the field */
  focus: () => field.value?.focus(),
  /** Inserts text at the caret (a trigger, to open the list from a button: `insert('@')`) */
  insert(text: string) {
    const el = inputEl.value
    if (!el) return
    const start = el.selectionStart ?? props.modelValue.length
    const end = el.selectionEnd ?? start
    const value = props.modelValue.slice(0, start) + text + props.modelValue.slice(end)
    emit('update:modelValue', value)
    nextTick(() => {
      el.focus()
      el.setSelectionRange(start + text.length, start + text.length)
      detect()
    })
  },
})
</script>

<template>
  <div v-bind="$attrs" @keydown.capture="onKeydown" @keyup="onCaretMove" @click="onCaretMove" @focusout="close">
    <MTextField
      ref="field"
      :model-value="modelValue"
      :label="label"
      :variant="variant"
      :multiline="multiline"
      :rows="rows"
      :auto-grow="autoGrow"
      :max-rows="maxRows"
      :leading-icon="leadingIcon"
      :hint="hint"
      :error="error"
      :error-label="errorLabel"
      :rules="rules"
      :validate-on="validateOn"
      :name="name"
      @blur="emit('blur')"
      :required="required"
      :disabled="disabled"
      @update:model-value="onText"
    />
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      :id="listId"
      ref="listEl"
      role="listbox"
      :aria-label="label"
      class="fixed z-500 max-h-72 overflow-auto rounded-xs bg-surface-container py-1 shadow-elevation-2"
      :style="listPos"
    >
      <div v-if="loading && !results.length" class="flex items-center gap-3 px-4 py-3 text-body-medium text-on-surface-variant" role="status">
        <MSpinner :size="20" />{{ t.loading }}
      </div>
      <div v-else-if="!results.length" class="px-4 py-3 text-body-medium text-on-surface-variant" role="status">{{ t.noResults }}</div>
      <div
        v-for="(item, i) in results"
        :id="optionId(i)"
        :key="String(item.id)"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-center gap-3 px-3 py-2 text-on-surface hover:bg-on-surface/8"
        :class="i === active ? 'bg-on-surface/12' : ''"
        @mousedown.prevent="pick(item)"
        @mousemove="active = i"
      >
        <slot name="item" :item="item" :source="query!.source" :active="i === active">
          <img v-if="item.avatar" :src="item.avatar" alt="" class="size-8 shrink-0 rounded-full object-cover">
          <span v-else-if="item.icon" class="grid size-8 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
            <MIcon :name="item.icon" :size="18" />
          </span>
          <MAvatar v-else :name="item.label" :size="32" class="shrink-0" />
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-body-large">{{ item.label }}</span>
            <span v-if="item.description" class="truncate text-body-small text-on-surface-variant">{{ item.description }}</span>
          </span>
        </slot>
      </div>
    </div>
  </Teleport>
</template>
