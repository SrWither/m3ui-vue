<script setup lang="ts">
import { ref, onBeforeUpdate, onUpdated, onMounted, onBeforeUnmount } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

export interface KanbanCard {
  id: string | number
  [key: string]: any
}

export interface KanbanColumn {
  id: string | number
  title: string
  cards: KanbanCard[]
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
  /** Optional WIP limit: the header shows count/limit and turns error-colored when exceeded. */
  limit?: number
}

const props = defineProps<{
  modelValue: KanbanColumn[]
  emptyText?: string
}>()

const locale = useLocale()

const emit = defineEmits<{
  'update:modelValue': [KanbanColumn[]]
  cardMove: [{ cardId: string | number; fromColumn: string | number; toColumn: string | number; toIndex: number }]
  cardClick: [{ card: KanbanCard; columnId: string | number }]
}>()

defineSlots<{
  card?: (props: { card: KanbanCard; column: KanbanColumn; dragging: boolean }) => unknown
  'column-header'?: (props: { column: KanbanColumn; count: number }) => unknown
  'column-footer'?: (props: { column: KanbanColumn }) => unknown
}>()

/*
 * Pointer Events, not native HTML5 drag-and-drop (no touch support on mobile, an unstylable
 * ghost image, and no way to animate the other cards) — same approach as MDragDropList.
 *
 * While dragging, the card is switched to `position: fixed` at its own on-screen rect, so it
 * can travel across columns without being clipped by the board's horizontal scroll container;
 * its column closes up behind it. Every card's offset is a 2D spring stepped in one rAF loop
 * and written straight to `style.transform` (library convention, see CLAUDE.md): Standard
 * `DefaultSpatial`, dampingRatio 0.9 / stiffness 700. Any change to the rendered order —
 * a pointer drop, a keyboard move, or the parent editing the columns — animates with FLIP:
 * capture every card's on-screen rect before the DOM update, then spring each card from its
 * old spot to its new one (including across columns, where Vue recreates the element).
 *
 * M3 values: ElevatedCardTokens — ContainerShape CornerMedium (12dp), elevation Level1 at
 * rest, HoverContainerElevation Level2, DraggedContainerElevation Level4.
 */
const DAMPING = 0.9
const STIFFNESS = 700
const LIFT_ROTATE = 2.5 // deg
const LIFT_SCALE = 0.03

type Id = string | number
type Spring2 = { x: number; y: number; vx: number; vy: number; tx: number; ty: number }
type Spring1 = { p: number; v: number; t: number }

const boardEl = ref<HTMLElement | null>(null)
const cardEls = new Map<Id, HTMLElement>()
const columnEls = new Map<Id, HTMLElement>()
const areaEls = new Map<Id, HTMLElement>()
const placeholderEls = new Map<Id, HTMLElement>()
const springs = new Map<Id, Spring2>()

function setRef(map: Map<Id, HTMLElement>, id: Id, el: unknown) {
  if (el) map.set(id, el as HTMLElement)
  else map.delete(id)
}
function setCardEl(id: Id, el: unknown) {
  setRef(cardEls, id, el)
  if (!el) springs.delete(id)
}

function springOf(id: Id): Spring2 {
  let s = springs.get(id)
  if (!s) {
    s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
    springs.set(id, s)
  }
  return s
}

// Lift (tilt + slight scale) of the card being dragged / settling, 0..1.
let liftId: Id | null = null
const lift: Spring1 = { p: 0, v: 0, t: 0 }

function write(id: Id) {
  const el = cardEls.get(id)
  const s = springs.get(id)
  if (!el || !s) return
  let tf = Math.abs(s.x) < 0.01 && Math.abs(s.y) < 0.01 ? '' : `translate(${s.x}px, ${s.y}px)`
  if (id === liftId && lift.p > 0.001) tf += ` rotate(${LIFT_ROTATE * lift.p}deg) scale(${1 + LIFT_SCALE * lift.p})`
  el.style.transform = tf
}

// Placeholder: dashed slot in the target column showing where the card will land.
const ph: Spring1 = { p: 0, v: 0, t: 0 }
let phColumn: Id | null = null

// Reactive only for classes.
const draggingId = ref<Id | null>(null)
const settlingId = ref<Id | null>(null)
const grabbedId = ref<Id | null>(null)
const targetColumn = ref<Id | null>(null)
const announcement = ref('')

interface DragState {
  id: Id
  fromColumn: Id
  fromIndex: number
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  active: boolean
  longPress?: ReturnType<typeof setTimeout>
  rect: DOMRect | null
  height: number
  toColumn: Id
  toIndex: number
}
let drag: DragState | null = null
let suppressClick = false

function cardGap(area: HTMLElement) {
  return parseFloat(getComputedStyle(area).rowGap) || 0
}
let basePadBottom = ''

// ---------- Animation loop ----------

let raf = 0
let last = 0
function kick() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(step)
}
function stepSpring1(s: Spring1, dt: number) {
  const a = -STIFFNESS * (s.p - s.t) - 2 * DAMPING * Math.sqrt(STIFFNESS) * s.v
  s.v += a * dt
  s.p += s.v * dt
  if (Math.abs(s.p - s.t) < 0.002 && Math.abs(s.v) < 0.01) {
    s.p = s.t
    s.v = 0
    return false
  }
  return true
}
function step(now: number) {
  raf = 0
  const dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  let moving = false

  if (drag?.active) autoScroll(dt)

  for (const [id, s] of springs) {
    if (drag?.active && id === drag.id) continue // follows the pointer, set in update()
    const k = 2 * DAMPING * Math.sqrt(STIFFNESS)
    s.vx += (-STIFFNESS * (s.x - s.tx) - k * s.vx) * dt
    s.vy += (-STIFFNESS * (s.y - s.ty) - k * s.vy) * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    if (Math.abs(s.x - s.tx) < 0.5 && Math.abs(s.y - s.ty) < 0.5 && Math.abs(s.vx) < 5 && Math.abs(s.vy) < 5) {
      s.x = s.tx
      s.y = s.ty
      s.vx = s.vy = 0
    } else {
      moving = true
    }
    write(id)
  }
  if (stepSpring1(lift, dt)) moving = true
  if (liftId !== null) write(liftId)
  if (stepSpring1(ph, dt)) moving = true
  if (phColumn !== null) {
    const el = placeholderEls.get(phColumn)
    if (el) el.style.transform = `translateY(${ph.p}px)`
  }

  if (moving || drag?.active) {
    last = now
    raf = requestAnimationFrame(step)
  } else {
    settlingId.value = null
    if (lift.p === 0) liftId = null
  }
}

// ---------- Pointer dragging ----------

const INTERACTIVE = 'input, textarea, select, button, a, label, [contenteditable]'
let prevUserSelect = ''
let prevSnap = ''

function onPointerDown(e: PointerEvent, card: KanbanCard, columnId: Id, index: number) {
  if (drag || e.button !== 0 || grabbedId.value !== null) return
  if ((e.target as Element).closest(INTERACTIVE)) return
  drag = {
    id: card.id,
    fromColumn: columnId,
    fromIndex: index,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    active: false,
    rect: null,
    height: 0,
    toColumn: columnId,
    toIndex: index,
  }
  // Touch needs a long press, so swiping still scrolls the board / page.
  if (e.pointerType === 'touch') drag.longPress = setTimeout(activate, 350)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function activate() {
  if (!drag || drag.active) return
  clearTimeout(drag.longPress)
  drag.longPress = undefined
  const el = cardEls.get(drag.id)
  if (!el) return cancelPress()

  // Remember where every card is, take the dragged one out of the flow, then spring the
  // cards below it up into the gap from where they were.
  const before = captureRects()
  const rect = el.getBoundingClientRect()
  drag.rect = rect
  drag.height = rect.height
  drag.active = true
  draggingId.value = drag.id
  liftId = drag.id
  lift.t = 1

  Object.assign(el.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '60',
    pointerEvents: 'none',
  })
  const s = springOf(drag.id)
  s.x = s.y = s.vx = s.vy = 0
  settleFrom(before, drag.id)

  prevUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'
  window.getSelection()?.removeAllRanges()
  if (boardEl.value) {
    prevSnap = boardEl.value.style.scrollSnapType
    boardEl.value.style.scrollSnapType = 'none'
  }
  const firstArea = areaEls.values().next().value
  if (firstArea) basePadBottom = getComputedStyle(firstArea).paddingBottom
  update(drag.lastX, drag.lastY)
  kick()
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  drag.lastX = e.clientX
  drag.lastY = e.clientY
  if (!drag.active) {
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
    if (drag.longPress !== undefined) {
      if (dist > 8) cancelPress()
      return
    }
    if (dist < 4) return
    activate()
    return
  }
  update(e.clientX, e.clientY)
}

function columnAt(x: number): Id | null {
  let best: Id | null = null
  let bestDist = Infinity
  for (const col of props.modelValue) {
    const el = columnEls.get(col.id)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (x >= r.left && x <= r.right) return col.id
    const d = Math.min(Math.abs(x - r.left), Math.abs(x - r.right))
    if (d < bestDist) {
      bestDist = d
      best = col.id
    }
  }
  return best
}

function update(x: number, y: number) {
  if (!drag?.active || !drag.rect) return
  const dragged = springOf(drag.id)
  dragged.x = x - drag.startX
  dragged.y = y - drag.startY
  write(drag.id)

  const colId = columnAt(x)
  if (colId === null) return
  const area = areaEls.get(colId)
  const column = props.modelValue.find((c) => c.id === colId)
  if (!area || !column) return

  // Insertion index from the dragged card's center against the column's (closed-up) cards.
  const areaRect = area.getBoundingClientRect()
  const center = drag.rect.top + dragged.y + drag.height / 2 - areaRect.top
  const others = column.cards.filter((c) => c.id !== drag!.id)
  const els = others.map((c) => cardEls.get(c.id)).filter((el): el is HTMLElement => !!el)
  let index = 0
  for (const el of els) if (el.offsetTop + el.offsetHeight / 2 < center) index++

  const gap = cardGap(area)
  const shift = drag.height + gap
  drag.toColumn = colId
  drag.toIndex = index

  for (const col of props.modelValue) {
    col.cards.forEach((c) => {
      if (c.id === drag!.id) return
      const s = springOf(c.id)
      s.tx = 0
      s.ty = 0
    })
  }
  others.forEach((c, i) => {
    if (i >= index) springOf(c.id).ty = shift
  })

  // Placeholder slot + room for it at the bottom of the column.
  const padTop = parseFloat(getComputedStyle(area).paddingTop) || 0
  const slotTop = index < els.length
    ? els[index]!.offsetTop
    : els.length
      ? els[els.length - 1]!.offsetTop + els[els.length - 1]!.offsetHeight + gap
      : padTop
  if (phColumn !== colId) {
    if (phColumn !== null) {
      const old = placeholderEls.get(phColumn)
      if (old) old.style.opacity = '0'
      const oldArea = areaEls.get(phColumn)
      if (oldArea) oldArea.style.paddingBottom = ''
    }
    phColumn = colId
    ph.p = slotTop
    ph.v = 0
  }
  ph.t = slotTop
  const phEl = placeholderEls.get(colId)
  if (phEl) {
    phEl.style.height = `${drag.height}px`
    phEl.style.opacity = '1'
  }
  area.style.paddingBottom = `calc(${basePadBottom || '0px'} + ${shift}px)`
  targetColumn.value = colId
  kick()
}

const EDGE = 56
const MAX_SPEED = 900 // px/s
function autoScroll(dt: number) {
  const board = boardEl.value
  if (!board || !drag) return
  const r = board.getBoundingClientRect()
  let v = 0
  if (drag.lastX < r.left + EDGE) v = -MAX_SPEED * (1 - Math.max(0, drag.lastX - r.left) / EDGE)
  else if (drag.lastX > r.right - EDGE) v = MAX_SPEED * (1 - Math.max(0, r.right - drag.lastX) / EDGE)
  if (!v) return
  const before = board.scrollLeft
  board.scrollLeft += v * dt
  if (board.scrollLeft !== before) update(drag.lastX, drag.lastY)
}

function removeListeners() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function cancelPress() {
  if (drag) clearTimeout(drag.longPress)
  drag = null
  removeListeners()
}

function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  if (!drag.active) return cancelPress()
  finishDrag(true)
}
function onPointerCancel(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  if (!drag.active) return cancelPress()
  finishDrag(false)
}

function clearDragChrome() {
  for (const area of areaEls.values()) area.style.paddingBottom = ''
  for (const el of placeholderEls.values()) el.style.opacity = '0'
  phColumn = null
  targetColumn.value = null
}

function unfix(el: HTMLElement) {
  Object.assign(el.style, { position: '', left: '', top: '', width: '', height: '', margin: '', zIndex: '', pointerEvents: '' })
}

function finishDrag(commitMove: boolean) {
  if (!drag) return
  const d = drag
  drag = null
  removeListeners()
  document.body.style.userSelect = prevUserSelect
  if (boardEl.value) boardEl.value.style.scrollSnapType = prevSnap
  // The pointerup's click lands on the card; don't treat a drag as a cardClick.
  suppressClick = true
  setTimeout(() => (suppressClick = false), 0)
  draggingId.value = null
  settlingId.value = d.id
  lift.t = 0

  const moved = commitMove && (d.toColumn !== d.fromColumn || d.toIndex !== d.fromIndex)
  if (moved) {
    // onBeforeUpdate captures the fixed card's on-screen rect and un-fixes it; onUpdated
    // springs it (and everyone else) into place.
    pendingUnfix = d.id
    commit(d.id, d.fromColumn, d.toColumn, d.toIndex)
    // If the parent doesn't apply the update, fall back to animating home.
    queueMicrotask(() => {
      if (pendingUnfix === d.id) setTimeout(() => pendingUnfix === d.id && returnHome(d.id), 0)
    })
  } else {
    returnHome(d.id)
  }
  kick()
}

function returnHome(id: Id) {
  pendingUnfix = null
  const before = captureRects()
  const el = cardEls.get(id)
  if (el) unfix(el)
  clearDragChrome()
  settleFrom(before)
}

function commit(cardId: Id, fromColumn: Id, toColumn: Id, toIndex: number) {
  const columns = props.modelValue.map((col) => ({ ...col, cards: [...col.cards] }))
  const from = columns.find((c) => c.id === fromColumn)
  const to = columns.find((c) => c.id === toColumn)
  if (!from || !to) return
  const i = from.cards.findIndex((c) => c.id === cardId)
  if (i === -1) return
  const [card] = from.cards.splice(i, 1)
  to.cards.splice(Math.min(toIndex, to.cards.length), 0, card!)
  emit('update:modelValue', columns)
  emit('cardMove', { cardId, fromColumn, toColumn, toIndex })
}

// While a card is actually being dragged, stop the page/board from scrolling under the finger.
function onTouchMove(e: TouchEvent) {
  if (drag?.active && e.cancelable) e.preventDefault()
}
function onContextMenu(e: Event) {
  if (drag) e.preventDefault()
}

// ---------- FLIP ----------

function captureRects() {
  const m = new Map<Id, DOMRect>()
  for (const [id, el] of cardEls) m.set(id, el.getBoundingClientRect())
  return m
}

// Spring every card from its previous on-screen rect to wherever it is now.
function settleFrom(before: Map<Id, DOMRect>, skip?: Id) {
  const ids: Id[] = []
  for (const [id, el] of cardEls) {
    if (id === skip || !before.has(id)) continue
    const s = springOf(id)
    s.x = s.y = 0
    el.style.transform = ''
    ids.push(id)
  }
  let changed = false
  for (const id of ids) {
    const el = cardEls.get(id)!
    const b = before.get(id)!
    const a = el.getBoundingClientRect()
    const s = springOf(id)
    s.x = b.left - a.left
    s.y = b.top - a.top
    s.tx = 0
    s.ty = 0
    if (Math.abs(s.x) > 0.5 || Math.abs(s.y) > 0.5) changed = true
    write(id)
  }
  if (changed || lift.p !== lift.t) kick()
}

let pendingUnfix: Id | null = null
let beforeUpdate: Map<Id, DOMRect> | null = null
onBeforeUpdate(() => {
  if (drag?.active) return
  beforeUpdate = captureRects()
  if (pendingUnfix !== null) {
    const el = cardEls.get(pendingUnfix)
    if (el) unfix(el)
    clearDragChrome()
    pendingUnfix = null
  }
})
onUpdated(() => {
  const before = beforeUpdate
  beforeUpdate = null
  if (before) settleFrom(before)
  if (grabbedId.value !== null) focusCard(grabbedId.value)
})

// ---------- Keyboard ----------

let grabOrigin: KanbanColumn[] | null = null
let grabFrom: { column: Id; index: number } | null = null

function locate(cardId: Id) {
  for (const col of props.modelValue) {
    const index = col.cards.findIndex((c) => c.id === cardId)
    if (index !== -1) return { column: col, index }
  }
  return null
}

function say(template: string, columnTitle: string, index: number, total: number) {
  announcement.value = template
    .replace('{column}', columnTitle)
    .replace('{pos}', String(index + 1))
    .replace('{total}', String(total))
}

function focusCard(id: Id) {
  const el = cardEls.get(id)
  if (el && document.activeElement !== el) el.focus({ preventScroll: false })
}

function onCardKeydown(e: KeyboardEvent, card: KanbanCard, column: KanbanColumn) {
  if (e.target !== e.currentTarget) return
  const here = locate(card.id)
  if (!here) return
  const grabbed = grabbedId.value === card.id

  if (e.key === ' ') {
    e.preventDefault()
    if (!grabbed) {
      grabbedId.value = card.id
      liftId = card.id
      lift.t = 1
      grabOrigin = props.modelValue.map((c) => ({ ...c, cards: [...c.cards] }))
      grabFrom = { column: column.id, index: here.index }
      say(locale.reorderGrabbed, column.title, here.index, column.cards.length)
    } else {
      dropKeyboard(card.id)
      say(locale.reorderDropped, column.title, here.index, column.cards.length)
    }
    kick()
    return
  }
  if (!grabbed) {
    if (e.key === 'Enter') {
      e.preventDefault()
      emit('cardClick', { card, columnId: column.id })
    }
    return
  }
  const cols = props.modelValue
  const ci = cols.findIndex((c) => c.id === here.column.id)
  let toCol = here.column
  let toIndex = here.index
  if (e.key === 'ArrowUp') toIndex = here.index - 1
  else if (e.key === 'ArrowDown') toIndex = here.index + 1
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const next = cols[ci + (e.key === 'ArrowLeft' ? -1 : 1)]
    if (!next) return e.preventDefault()
    toCol = next
    toIndex = Math.min(here.index, next.cards.length)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelKeyboard(card.id, here.column.id, here.index)
    return
  } else if (e.key === 'Enter') {
    e.preventDefault()
    dropKeyboard(card.id)
    say(locale.reorderDropped, column.title, here.index, column.cards.length)
    return
  } else {
    return
  }
  e.preventDefault()
  const total = toCol === here.column ? toCol.cards.length : toCol.cards.length + 1
  if (toIndex < 0 || toIndex >= total) return
  commit(card.id, here.column.id, toCol.id, toIndex)
  say(locale.kanbanMoved, toCol.title, toIndex, total)
}

function dropKeyboard(id: Id) {
  grabbedId.value = null
  grabOrigin = null
  grabFrom = null
  settlingId.value = id
  lift.t = 0
  kick()
}

function cancelKeyboard(id: Id, currentColumn: Id, currentIndex: number) {
  const origin = grabOrigin
  const from = grabFrom
  dropKeyboard(id)
  if (origin && from && (from.column !== currentColumn || from.index !== currentIndex)) {
    emit('update:modelValue', origin)
    emit('cardMove', { cardId: id, fromColumn: currentColumn, toColumn: from.column, toIndex: from.index })
  }
  announcement.value = locale.reorderCancelled
}

function onCardBlur(card: KanbanCard) {
  if (grabbedId.value !== card.id) return
  // Moving a card to another column recreates its element, which blurs it; onUpdated
  // refocuses it. Only a real tab-away drops the grab.
  requestAnimationFrame(() => {
    const el = cardEls.get(card.id)
    if (grabbedId.value === card.id && el && document.activeElement !== el) dropKeyboard(card.id)
  })
}

function onCardClick(card: KanbanCard, columnId: Id) {
  if (suppressClick) return
  emit('cardClick', { card, columnId })
}

// ---------- Presentation ----------

const dotColor: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
  success: 'bg-success',
}

const isLifted = (id: Id) => draggingId.value === id || settlingId.value === id || grabbedId.value === id
const overLimit = (col: KanbanColumn) => col.limit != null && col.cards.length > col.limit
const atLimit = (col: KanbanColumn) => col.limit != null && col.cards.length === col.limit

onMounted(() => {
  boardEl.value?.addEventListener('touchmove', onTouchMove, { passive: false })
})
onBeforeUnmount(() => {
  boardEl.value?.removeEventListener('touchmove', onTouchMove)
  cancelAnimationFrame(raf)
  raf = 0
  if (drag) {
    clearTimeout(drag.longPress)
    if (drag.active) document.body.style.userSelect = prevUserSelect
  }
  drag = null
  removeListeners()
})
</script>

<template>
  <div
    ref="boardEl"
    class="flex snap-x snap-proximity items-start gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]"
    @contextmenu="onContextMenu"
  >
    <section
      v-for="column in modelValue"
      :key="column.id"
      :ref="(el) => setRef(columnEls, column.id, el)"
      class="relative flex w-72 shrink-0 snap-start flex-col rounded-lg bg-surface-container"
    >
      <!-- Drop-target tint -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 rounded-[inherit] bg-primary transition-opacity duration-200"
        :class="targetColumn === column.id ? 'opacity-[0.06]' : 'opacity-0'"
      />

      <!-- Header -->
      <header class="relative flex items-center gap-2 px-4 pt-4 pb-2">
        <slot name="column-header" :column="column" :count="column.cards.length">
          <span v-if="column.color" class="h-2.5 w-2.5 shrink-0 rounded-full" :class="dotColor[column.color] ?? 'bg-primary'" />
          <h3 class="min-w-0 flex-1 truncate text-title-medium text-on-surface">{{ column.title }}</h3>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-label-medium tabular-nums transition-colors duration-200"
            :class="
              overLimit(column)
                ? 'bg-error-container text-on-error-container'
                : atLimit(column)
                  ? 'bg-tertiary-container text-on-tertiary-container'
                  : 'bg-surface-container-highest text-on-surface-variant'
            "
          >
            {{ column.cards.length }}<template v-if="column.limit != null">/{{ column.limit }}</template>
          </span>
        </slot>
      </header>

      <!-- Cards -->
      <div
        :ref="(el) => setRef(areaEls, column.id, el)"
        class="relative flex min-h-24 flex-1 flex-col gap-2 px-3 pt-1 pb-3 transition-[padding] duration-200"
        role="list"
        :aria-label="column.title"
      >
        <div
          :ref="(el) => setRef(placeholderEls, column.id, el)"
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-3 top-0 rounded-md border-2 border-dashed border-primary/50 bg-primary/8 opacity-0 transition-opacity duration-150"
        />

        <div
          v-for="(card, index) in column.cards"
          :key="card.id"
          :ref="(el) => setCardEl(card.id, el)"
          role="listitem"
          tabindex="0"
          :aria-grabbed="grabbedId === card.id"
          class="group relative cursor-grab touch-manipulation select-none rounded-md bg-surface-container-low p-4 outline-none [-webkit-touch-callout:none] transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-secondary"
          :class="[
            isLifted(card.id) ? 'shadow-elevation-4' : 'shadow-elevation-1 hover:shadow-elevation-2',
            draggingId === card.id ? 'cursor-grabbing' : '',
          ]"
          @pointerdown="onPointerDown($event, card, column.id, index)"
          @click="onCardClick(card, column.id)"
          @keydown="onCardKeydown($event, card, column)"
          @blur="onCardBlur(card)"
        >
          <!-- State layer: 8% hover, 16% while dragged -->
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 rounded-[inherit] bg-on-surface transition-opacity duration-150"
            :class="isLifted(card.id) ? 'opacity-[0.08]' : 'opacity-0 group-hover:opacity-[0.04]'"
          />
          <div class="relative">
            <slot name="card" :card="card" :column="column" :dragging="isLifted(card.id)">
              <p class="text-body-medium text-on-surface">{{ card.id }}</p>
            </slot>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="column.cards.length === 0"
          class="flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center transition-colors duration-200"
          :class="targetColumn === column.id ? 'border-transparent' : 'border-outline-variant'"
        >
          <template v-if="targetColumn !== column.id">
            <MIcon name="inbox" :size="24" class="text-on-surface-variant/60" />
            <p class="text-body-small text-on-surface-variant">{{ emptyText ?? locale.noItems }}</p>
          </template>
        </div>
      </div>

      <footer v-if="$slots['column-footer']" class="relative px-3 pb-3">
        <slot name="column-footer" :column="column" />
      </footer>
    </section>

    <div class="sr-only" aria-live="assertive" aria-atomic="true">{{ announcement }}</div>
  </div>
</template>
