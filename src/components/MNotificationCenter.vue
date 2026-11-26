<script setup lang="ts">
/**
 * An inbox of notifications: grouped by day (Today, Yesterday, a date), newest first, with relative times in the
 * app's language, unread ones marked, an All / Unread filter and Mark all as read. A click opens one (and marks it
 * read); a sideways swipe (finger or mouse), its dismiss button or Delete dismisses it. The list is the v-model:
 * reading and dismissing change it. Put it in a menu, a side sheet or a page; `MNotificationCenter` doesn't float.
 * For passing toasts, use `useNotification()`.
 *
 * @slot item One notification's content instead of the default: `{ item }`
 * @slot empty What shows with nothing to list
 * @event update:modelValue The list changed (read, unread, dismissed)
 * @event open A notification was opened (clicked, or Enter)
 * @event dismiss A notification was dismissed
 */
import { computed, ref } from 'vue'
import MButton from './MButton.vue'
import MChip from './MChip.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

/** One notification of `MNotificationCenter`. */
export interface InboxNotification {
  id: string | number
  title: string
  body?: string
  /** When: a Date, an ISO string or a timestamp */
  time: Date | string | number
  read?: boolean
  /** A Material Symbol */
  icon?: string
  /** An image URL instead of the icon */
  avatar?: string
  /** The icon's color: a theme role */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
}

const props = withDefaults(
  defineProps<{
    /** The notifications (v-model) */
    modelValue: InboxNotification[]
    /** The header's title (the locale's "Notifications" by default); empty hides the header */
    title?: string
    /** Show the All / Unread filter */
    filter?: boolean
    /** Let people dismiss notifications */
    dismissible?: boolean
    /** Limit the height (CSS), scrolling inside */
    maxHeight?: string
  }>(),
  { filter: true, dismissible: true },
)

const emit = defineEmits<{
  'update:modelValue': [items: InboxNotification[]]
  open: [item: InboxNotification]
  dismiss: [item: InboxNotification]
}>()

const t = useLocale()
const showUnread = ref(false)
const list = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const unread = computed(() => list.value.filter((n) => !n.read).length)

const when = (n: InboxNotification) => new Date(n.time)
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Newest first, grouped by day */
const groups = computed(() => {
  const shown = [...list.value].filter((n) => !showUnread.value || !n.read).sort((a, b) => when(b).getTime() - when(a).getTime())
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const fmt = new Intl.DateTimeFormat(t.lang || undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const out: { label: string; items: InboxNotification[] }[] = []
  for (const n of shown) {
    const d = when(n)
    const label = dayKey(d) === dayKey(today) ? t.notifToday : dayKey(d) === dayKey(yesterday) ? t.notifYesterday : fmt.format(d)
    const last = out[out.length - 1]
    if (last?.label === label) last.items.push(n)
    else out.push({ label, items: [n] })
  }
  return out
})

/** "5 min ago", "3 h ago", or the time for older ones */
function relative(n: InboxNotification) {
  const d = when(n)
  const s = (d.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(t.lang || undefined, { numeric: 'auto', style: 'short' })
  if (Math.abs(s) < 60) return rtf.format(0, 'second')
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (Math.abs(s) < 6 * 3600) return rtf.format(Math.round(s / 3600), 'hour')
  return new Intl.DateTimeFormat(t.lang || undefined, { hour: 'numeric', minute: '2-digit' }).format(d)
}

function update(id: InboxNotification['id'], patch: Partial<InboxNotification>) {
  emit('update:modelValue', list.value.map((n) => (n.id === id ? { ...n, ...patch } : n)))
}
function open(n: InboxNotification) {
  if (!n.read) update(n.id, { read: true })
  emit('open', { ...n, read: true })
}
function markAll() {
  emit('update:modelValue', list.value.map((n) => (n.read ? n : { ...n, read: true })))
}
function dismiss(n: InboxNotification) {
  emit('update:modelValue', list.value.filter((x) => x.id !== n.id))
  emit('dismiss', n)
}

// ── Swipe to dismiss (finger or mouse); the row follows, then flies out or springs back ─────────

let swipe: { id: InboxNotification['id']; x: number; y: number; dx: number; active: boolean; el: HTMLElement } | null = null
const swiping = ref<InboxNotification['id'] | null>(null)

function onPointerDown(e: PointerEvent, n: InboxNotification) {
  if (!props.dismissible || e.button > 0 || (e.target as HTMLElement).closest('button, a')) return
  swipe = { id: n.id, x: e.clientX, y: e.clientY, dx: 0, active: false, el: e.currentTarget as HTMLElement }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}
function onPointerMove(e: PointerEvent) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  if (!swipe.active) {
    // A vertical move is a scroll: let it go
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return end()
    if (Math.abs(dx) < 10) return
    swipe.active = true
    swiping.value = swipe.id
  }
  swipe.dx = dx
  swipe.el.style.transform = `translateX(${dx}px)`
  swipe.el.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / swipe.el.offsetWidth))
}
function onPointerUp() {
  if (!swipe) return
  const { el, dx, active, id } = swipe
  const n = list.value.find((x) => x.id === id)
  end()
  if (!active) return
  const width = el.offsetWidth || 1
  if (n && Math.abs(dx) > width * 0.35) {
    // Off it goes, then out of the list
    const out = el.animate([{ transform: `translateX(${dx}px)`, opacity: el.style.opacity }, { transform: `translateX(${Math.sign(dx) * width}px)`, opacity: 0 }], { duration: 180, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)' })
    el.style.transform = `translateX(${Math.sign(dx) * width}px)`
    el.style.opacity = '0'
    const done = () => dismiss(n)
    if (out?.finished) out.finished.then(done, done)
    else done()
  } else {
    el.animate?.([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
    el.style.transform = ''
    el.style.opacity = ''
  }
  // The click that ends a swipe isn't an open
  setTimeout(() => (swiping.value = null))
}
function end() {
  swipe = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

function onClick(n: InboxNotification) {
  if (swiping.value === n.id) return
  open(n)
}
function onKey(e: KeyboardEvent, n: InboxNotification) {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open(n)
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && props.dismissible) {
    e.preventDefault()
    const row = e.currentTarget as HTMLElement
    const next = (row.nextElementSibling ?? row.previousElementSibling) as HTMLElement | null
    dismiss(n)
    next?.focus?.()
  }
}

const ROLE_BG = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  success: 'bg-success-container text-on-success-container',
} as const
</script>

<template>
  <div class="m3-notification-center flex flex-col overflow-hidden bg-surface-container-low text-on-surface">
    <div v-if="title !== ''" class="flex items-center gap-2 px-4 pb-2 pt-4">
      <h2 class="flex-1 text-title-large">{{ title ?? t.notifTitle }}</h2>
      <span v-if="unread" class="rounded-full bg-error px-2 text-label-small text-on-error">{{ unread }}</span>
      <MButton v-if="unread" variant="text" size="sm" @click="markAll">{{ t.notifMarkAllRead }}</MButton>
    </div>
    <div v-if="filter" class="flex gap-2 px-4 pb-2" role="group">
      <MChip type="filter" :selected="!showUnread" @click="showUnread = false">{{ t.notifAll }}</MChip>
      <MChip type="filter" :selected="showUnread" @click="showUnread = true">{{ t.notifUnread }}<template v-if="unread"> ({{ unread }})</template></MChip>
    </div>

    <div class="flex-1 overflow-y-auto overflow-x-hidden pb-2" :style="{ maxHeight }">
      <div v-if="!groups.length" class="flex flex-col items-center gap-2 px-6 py-10 text-center text-on-surface-variant">
        <slot name="empty">
          <MIcon name="notifications_off" :size="36" />
          <p class="text-body-medium">{{ t.notifEmpty }}</p>
        </slot>
      </div>
      <section v-for="g in groups" :key="g.label">
        <h3 class="sticky top-0 z-[1] bg-surface-container-low px-4 py-2 text-label-large text-on-surface-variant first-letter:uppercase">{{ g.label }}</h3>
        <ul role="list">
          <li
            v-for="n in g.items"
            :key="n.id"
            class="group relative flex cursor-pointer touch-pan-y items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-on-surface/8 focus-visible:bg-on-surface/10"
            :class="n.read ? '' : 'bg-secondary-container/40'"
            tabindex="0"
            :aria-label="`${n.title}${n.read ? '' : ` (${t.notifUnread})`}`"
            @pointerdown="onPointerDown($event, n)"
            @click="onClick(n)"
            @keydown="onKey($event, n)"
          >
            <slot name="item" :item="n">
              <img v-if="n.avatar" :src="n.avatar" alt="" class="size-10 shrink-0 rounded-full object-cover">
              <span v-else class="grid size-10 shrink-0 place-items-center rounded-full" :class="ROLE_BG[n.color ?? 'secondary']">
                <MIcon :name="n.icon ?? 'notifications'" :size="22" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="flex items-baseline gap-2">
                  <span class="min-w-0 flex-1 truncate text-body-large" :class="n.read ? '' : 'font-medium'">{{ n.title }}</span>
                  <span class="shrink-0 text-label-small text-on-surface-variant">{{ relative(n) }}</span>
                </span>
                <span v-if="n.body" class="line-clamp-2 text-body-medium text-on-surface-variant">{{ n.body }}</span>
              </span>
            </slot>
            <span v-if="!n.read" class="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <!-- Floating over the row on hover / focus, so they take no room from the text -->
            <span class="absolute right-2 top-1/2 flex -translate-y-1/2 rounded-full bg-surface-container-high opacity-0 shadow-elevation-1 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:hidden">
              <MIconButton :icon="n.read ? 'mark_email_unread' : 'mark_email_read'" :label="n.read ? t.notifMarkUnread : t.notifMarkRead" size="sm" @click.stop="update(n.id, { read: !n.read })" />
              <MIconButton v-if="dismissible" icon="close" :label="t.notifDismiss" size="sm" @click.stop="dismiss(n)" />
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
