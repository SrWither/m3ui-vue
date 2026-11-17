<script lang="ts">
import { ref as sharedRef, type Ref } from 'vue'

/** A modifier on an order line: a plain string, or with a kind to style additions and removals. */
export type OrderModifier = string | { label: string; kind?: 'add' | 'remove' | 'info' }

/** A line of an `MOrderTicket`. */
export interface OrderItem {
  id: string | number
  name: string
  quantity?: number
  modifiers?: OrderModifier[]
  /** A free note for this line, e.g. "allergy: nuts" */
  note?: string
}

// One clock for every ticket on the screen: a kitchen display can show dozens
const now: Ref<number> = sharedRef(Date.now())
let subscribers = 0
let timer: ReturnType<typeof setInterval> | null = null

function subscribe() {
  if (subscribers++ === 0 && typeof window !== 'undefined') {
    now.value = Date.now()
    timer = setInterval(() => (now.value = Date.now()), 1000)
  }
}
function unsubscribe() {
  if (--subscribers === 0 && timer) {
    clearInterval(timer)
    timer = null
  }
}
</script>

<script setup lang="ts">
/**
 * A kitchen ticket (comanda) for a kitchen display or an order queue: the order number, where it goes, how long it
 * has been waiting (the header turns amber, then red, as it ages) and its lines with quantities, modifiers and
 * notes. Tapping a line crosses it out as done; once every line is done `complete` fires. Every ticket on the page
 * shares one clock.
 *
 * @slot header Extra content in the header, under the title (e.g. chips with the waiter or channel)
 * @slot item Replaces a line's content (the tappable row stays). Slot props: `{ item, done }`
 * @slot actions Content at the bottom (e.g. bump / recall buttons). Slot props: `{ allDone, elapsed }`
 * @event update:done Emitted with the ids of the lines marked done — powers v-model:done
 * @event complete Emitted when the last line is marked done
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    /** Order number shown big in the header, e.g. 42 or "A-17" */
    number: string | number
    /** Where it goes, e.g. "Table 7", "Takeaway · Ana" */
    title?: string
    /** Material Symbol before the title, e.g. "restaurant", "takeout_dining", "two_wheeler" */
    icon?: string
    /** When the order came in (Date, ISO string or epoch ms); drives the timer */
    createdAt: Date | string | number
    /** When it was finished: freezes the timer at that moment */
    finishedAt?: Date | string | number
    /** The order lines */
    items: OrderItem[]
    /** Ids of the lines done (v-model:done) */
    done?: (string | number)[]
    /** A note for the whole order */
    note?: string
    /** Minutes after which the header turns to the warning color */
    warnAfter?: number
    /** Minutes after which the header turns to the error color */
    lateAfter?: number
    /** Read-only: lines can't be ticked */
    readonly?: boolean
  }>(),
  {
    done: () => [],
    warnAfter: 10,
    lateAfter: 20,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:done': [(string | number)[]]
  complete: []
}>()

// The shared clock only runs while a ticket is mounted: refresh it so the first render isn't stale
if (subscribers === 0) now.value = Date.now()
onMounted(subscribe)
onBeforeUnmount(unsubscribe)

function toMs(v: Date | string | number) {
  return v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v)
}

/** Seconds since the order came in */
const elapsed = computed(() => {
  const end = props.finishedAt !== undefined ? toMs(props.finishedAt) : now.value
  return Math.max(0, Math.floor((end - toMs(props.createdAt)) / 1000))
})

const elapsedText = computed(() => {
  const s = elapsed.value
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
})

const level = computed<'normal' | 'warn' | 'late'>(() => {
  const min = elapsed.value / 60
  if (props.finishedAt !== undefined) return 'normal'
  if (min >= props.lateAfter) return 'late'
  if (min >= props.warnAfter) return 'warn'
  return 'normal'
})

const doneSet = computed(() => new Set(props.done))
const allDone = computed(() => props.items.length > 0 && props.items.every((i) => doneSet.value.has(i.id)))

function toggle(item: OrderItem) {
  if (props.readonly) return
  const next = doneSet.value.has(item.id) ? props.done.filter((id) => id !== item.id) : [...props.done, item.id]
  emit('update:done', next)
  if (!doneSet.value.has(item.id) && props.items.every((i) => i.id === item.id || doneSet.value.has(i.id))) emit('complete')
}

function mod(m: OrderModifier) {
  return typeof m === 'string' ? { label: m, kind: 'info' as const } : { kind: 'info' as const, ...m }
}
</script>

<template>
  <div class="m3-order-ticket flex flex-col overflow-hidden rounded-lg bg-surface-container-low text-on-surface shadow-elevation-1">
    <div
      class="flex items-start gap-3 px-4 py-3 transition-colors duration-300"
      :class="{
        'bg-surface-container-highest text-on-surface': level === 'normal',
        'bg-tertiary-container text-on-tertiary-container': level === 'warn',
        'bg-error-container text-on-error-container': level === 'late',
      }"
      :data-level="level"
    >
      <span class="text-headline-small font-medium tabular-nums">#{{ number }}</span>
      <div class="min-w-0 flex-1">
        <div v-if="title" class="flex items-center gap-1.5 truncate text-title-medium">
          <MIcon v-if="icon" :name="icon" :size="20" />
          <span class="truncate">{{ title }}</span>
        </div>
        <slot name="header" />
      </div>
      <span class="flex shrink-0 items-center gap-1 text-title-medium tabular-nums" role="timer" :aria-label="elapsedText">
        <MIcon :name="finishedAt !== undefined ? 'check_circle' : 'schedule'" :size="20" />
        {{ elapsedText }}
      </span>
    </div>

    <ul class="flex flex-col py-1" role="list">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="m3-order-line flex w-full items-start gap-3 px-4 py-2 text-left transition-opacity duration-150"
          :class="[doneSet.has(item.id) ? 'is-done opacity-50' : '', readonly ? 'cursor-default' : 'cursor-pointer']"
          :aria-pressed="doneSet.has(item.id)"
          :disabled="readonly"
          @click="toggle(item)"
        >
          <slot name="item" :item="item" :done="doneSet.has(item.id)">
            <span class="min-w-8 text-title-medium font-medium tabular-nums">{{ item.quantity ?? 1 }}×</span>
            <span class="min-w-0 flex-1">
              <span class="m3-order-line__name block text-title-medium">{{ item.name }}</span>
              <span
                v-for="(m, i) in (item.modifiers ?? []).map(mod)"
                :key="i"
                class="block text-body-medium"
                :class="{
                  'text-error': m.kind === 'remove',
                  'text-primary': m.kind === 'add',
                  'text-on-surface-variant': m.kind === 'info',
                }"
              >{{ m.kind === 'remove' ? '− ' : m.kind === 'add' ? '+ ' : '' }}{{ m.label }}</span>
              <span v-if="item.note" class="mt-0.5 flex items-center gap-1 text-body-medium italic text-tertiary">
                <MIcon name="sticky_note_2" :size="16" />{{ item.note }}
              </span>
            </span>
            <MIcon v-if="doneSet.has(item.id)" name="check" :size="20" class="text-primary" />
          </slot>
        </button>
      </li>
    </ul>

    <div v-if="note" class="mx-4 mb-3 flex items-start gap-2 rounded-sm bg-tertiary-container/50 px-3 py-2 text-body-medium text-on-tertiary-container">
      <MIcon name="sticky_note_2" :size="18" class="mt-0.5" />
      <span>{{ note }}</span>
    </div>

    <div v-if="$slots.actions" class="mt-auto flex gap-2 px-4 pb-4">
      <slot name="actions" :allDone="allDone" :elapsed="elapsed" />
    </div>
  </div>
</template>

<style>
.m3-order-line:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}
.m3-order-line:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: -3px;
}
.m3-order-line.is-done .m3-order-line__name {
  text-decoration: line-through;
}
</style>
