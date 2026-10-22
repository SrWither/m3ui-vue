<script setup lang="ts">
/**
 * A reorderable list: v-model the array and render each row with the #default slot. Works with a mouse, a
 * finger and the keyboard. The dragged row lifts with M3's dragged-item elevation and the rest slide out of its
 * way.
 *
 * @slot default Content of each row (or the whole row with bare). Falls back to item.id. Controls inside it
 *   (checkboxes, switches, buttons, links) keep working and never start a drag. dragging is true while the row
 *   is lifted; handleProps (with handle) goes on your own grip element via v-bind
 * @event update:modelValue Emitted with the reordered array (v-model)
 * @event reorder Emitted alongside update:modelValue with the source and destination indices. Useful for saving
 *   the new order to a backend
 */
import { ref, onBeforeUpdate, onUpdated, onMounted, onBeforeUnmount } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

export interface DragDropItem {
  id: string | number
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    /** Array of items with a unique id (v-model) */
    modelValue: DragDropItem[]
    /**
     * Drag only from a handle button at the start of each row. Touch drags start right away from the handle;
     * without it, a whole row starts dragging after a long press so swipes still scroll the page
     */
    handle?: boolean
    /** Turns reordering off (pointer and keyboard) and dims the list */
    disabled?: boolean
    /**
     * Drops the row's own look (padding, min height, hover/dragged state layer, background)
     * so the slot draws the whole row, e.g. one card per item. Dragging, the lift shadow
     * (as a drop-shadow that follows your content's shape) and keyboard support remain.
     * With `handle`, bind the slot's `handleProps` onto your own grip element.
     */
    bare?: boolean
  }>(),
  { handle: false, disabled: false, bare: false },
)

const emit = defineEmits<{
  'update:modelValue': [DragDropItem[]]
  reorder: [{ from: number; to: number; items: DragDropItem[] }]
}>()

const t = useLocale()

defineSlots<{
  default?: (props: {
    item: DragDropItem
    index: number
    /** True while this row is lifted (pointer drag, drop settle, or keyboard grab). */
    dragging: boolean
    /** With `handle`: spread onto your own grip (`v-bind="handleProps"`), needed in `bare` mode. */
    handleProps: Record<string, unknown>
  }) => unknown
}>()

/*
 * Pointer Events, not native HTML5 drag-and-drop: native DnD never fires for touch on most
 * mobile browsers, can't be styled (the browser draws its own translucent screenshot), and
 * gives no way to animate the other rows out of the way.
 *
 * Motion follows the library convention (see CLAUDE.md): every row's translateY is a spring
 * stepped in one rAF loop, held in plain variables and written straight to `style.transform`
 * — never a CSS transition, never a reactive :style binding. Standard `DefaultSpatial`
 * (dampingRatio 0.9, stiffness 700), same scheme as MTabs' indicator.
 *
 * M3 has no reorderable-list component, but ListTokens defines the dragged item:
 * ItemDraggedContainerElevation = Level4, ItemDraggedContainerExpressiveShape = CornerLarge
 * (16dp), DraggedStateLayerOpacity = 0.16, ItemOneLineContainerHeight = 56dp,
 * ItemLeading/TrailingSpace = 16dp.
 */
const DAMPING = 0.9
const STIFFNESS = 700

type Id = string | number
type Spring = { pos: number; vel: number; target: number }

const rootEl = ref<HTMLElement | null>(null)
const rowEls = new Map<Id, HTMLElement>()
const springs = new Map<Id, Spring>()

function setRowEl(id: Id, el: unknown) {
  if (el) rowEls.set(id, el as HTMLElement)
  else {
    rowEls.delete(id)
    springs.delete(id)
  }
}

function springOf(id: Id): Spring {
  let s = springs.get(id)
  if (!s) {
    s = { pos: 0, vel: 0, target: 0 }
    springs.set(id, s)
  }
  return s
}

function write(id: Id, s: Spring) {
  const el = rowEls.get(id)
  if (el) el.style.transform = Math.abs(s.pos) < 0.01 ? '' : `translateY(${s.pos}px)`
}

// Reactive only for classes (lifted look); per-frame state stays in `drag`/`springs`.
const draggingId = ref<Id | null>(null)
const settlingId = ref<Id | null>(null)
const grabbedId = ref<Id | null>(null)
const announcement = ref('')

interface DragState {
  id: Id
  from: number
  to: number
  pointerId: number
  startX: number
  startY: number
  active: boolean
  fromHandle: boolean
  longPress?: ReturnType<typeof setTimeout>
  tops: number[]
  heights: number[]
  gap: number
}
let drag: DragState | null = null

let raf = 0
let last = 0
function kick() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(step)
}
function step(now: number) {
  raf = 0
  const dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  let moving = false
  for (const [id, s] of springs) {
    // The row under the pointer follows it directly; update() sets its pos.
    if (drag?.active && id === drag.id) {
      write(id, s)
      continue
    }
    const accel = -STIFFNESS * (s.pos - s.target) - 2 * DAMPING * Math.sqrt(STIFFNESS) * s.vel
    s.vel += accel * dt
    s.pos += s.vel * dt
    if (Math.abs(s.pos - s.target) < 0.5 && Math.abs(s.vel) < 5) {
      s.pos = s.target
      s.vel = 0
    } else {
      moving = true
    }
    write(id, s)
  }
  if (moving || drag?.active) {
    last = now
    raf = requestAnimationFrame(step)
  } else {
    settlingId.value = null
  }
}

const isLifted = (id: Id) => draggingId.value === id || settlingId.value === id || grabbedId.value === id

// ---------- Pointer dragging ----------

const INTERACTIVE = 'input, textarea, select, button, a, label, [contenteditable]'
let prevUserSelect = ''

function onPointerDown(e: PointerEvent, index: number, fromHandle: boolean) {
  if (props.disabled || drag || e.button !== 0) return
  if (props.handle && !fromHandle) return
  // Let the row's own controls (checkboxes, switches, links...) work normally.
  if (!fromHandle && (e.target as Element).closest(INTERACTIVE)) return
  const item = props.modelValue[index]
  if (!item) return
  drag = {
    id: item.id,
    from: index,
    to: index,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
    fromHandle,
    tops: [],
    heights: [],
    gap: 0,
  }
  // A whole row dragged by touch needs a long press first, so a plain swipe still scrolls
  // the page. The handle is `touch-action: none`, so it starts right away.
  if (e.pointerType === 'touch' && !fromHandle) drag.longPress = setTimeout(activate, 350)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function activate() {
  if (!drag || drag.active) return
  clearTimeout(drag.longPress)
  drag.longPress = undefined
  // offsetTop ignores transforms, so this is the natural layout even mid-animation.
  const els = props.modelValue.map((it) => rowEls.get(it.id))
  if (els.some((el) => !el)) return cancelPress()
  drag.tops = els.map((el) => el!.offsetTop)
  drag.heights = els.map((el) => el!.offsetHeight)
  drag.gap = els.length > 1 ? drag.tops[1]! - drag.tops[0]! - drag.heights[0]! : 0
  drag.active = true
  draggingId.value = drag.id
  springOf(drag.id).vel = 0
  prevUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'
  window.getSelection()?.removeAllRanges()
  kick()
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const dy = e.clientY - drag.startY
  if (!drag.active) {
    const dist = Math.hypot(e.clientX - drag.startX, dy)
    if (drag.longPress !== undefined) {
      // Moved before the long press fired: it's a scroll, not a drag.
      if (dist > 8) cancelPress()
      return
    }
    if (dist < 4) return
    activate()
    if (!drag?.active) return
  }
  update(dy)
}

function update(rawDy: number) {
  if (!drag) return
  const { tops, heights, from, gap } = drag
  const n = tops.length
  // Keep the lifted row within the list's own bounds.
  const minDy = tops[0]! - tops[from]!
  const maxDy = tops[n - 1]! + heights[n - 1]! - heights[from]! - tops[from]!
  const dy = Math.min(maxDy, Math.max(minDy, rawDy))
  const center = tops[from]! + dy + heights[from]! / 2
  let to = from
  // Inclusive: the clamp above stops the row exactly at the first/last row's midpoint,
  // so a strict comparison would make the two ends unreachable.
  for (let i = from + 1; i < n; i++) if (center >= tops[i]! + heights[i]! / 2) to = i
  for (let i = from - 1; i >= 0; i--) if (center <= tops[i]! + heights[i]! / 2) to = i
  drag.to = to
  const shift = heights[from]! + gap
  props.modelValue.forEach((it, i) => {
    const s = springOf(it.id)
    if (i === from) {
      s.pos = dy
      return
    }
    s.target = from < to && i > from && i <= to ? -shift : from > to && i >= to && i < from ? shift : 0
  })
  kick()
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
  finishDrag(drag.to)
}

function onPointerCancel(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  if (!drag.active) return cancelPress()
  finishDrag(drag.from)
}

function finishDrag(to: number) {
  if (!drag) return
  const { id, from } = drag
  drag = null
  removeListeners()
  draggingId.value = null
  settlingId.value = id
  document.body.style.userSelect = prevUserSelect
  // Everything heads home; if the parent applies the new order, onUpdated re-bases each
  // row so it springs from where it is on screen into its new slot instead.
  for (const s of springs.values()) s.target = 0
  if (to !== from) commit(from, to)
  kick()
}

function commit(from: number, to: number) {
  const items = [...props.modelValue]
  const moved = items.splice(from, 1)[0]!
  items.splice(to, 0, moved)
  emit('update:modelValue', items)
  emit('reorder', { from, to, items })
}

// While a row is actually being dragged, stop the page from scrolling under the finger.
// Must be a non-passive touchmove: touch-action can't be changed mid-gesture.
function onTouchMove(e: TouchEvent) {
  if (drag?.active && e.cancelable) e.preventDefault()
}
function onContextMenu(e: Event) {
  // Long-pressing a row on touch would otherwise open the browser's context menu.
  if (drag) e.preventDefault()
}

// ---------- FLIP: animate any reorder of the rendered list ----------
// Covers a pointer drop, keyboard moves, and the parent changing the array itself.

let beforeTops: Map<Id, { natural: number; visual: number }> | null = null
onBeforeUpdate(() => {
  if (drag?.active) return
  beforeTops = new Map()
  for (const [id, el] of rowEls) {
    beforeTops.set(id, { natural: el.offsetTop, visual: el.offsetTop + (springs.get(id)?.pos ?? 0) })
  }
})
onUpdated(() => {
  const before = beforeTops
  beforeTops = null
  if (before) {
    let changed = false
    for (const [id, el] of rowEls) {
      const b = before.get(id)
      if (!b || Math.abs(b.natural - el.offsetTop) < 0.5) continue
      const s = springOf(id)
      s.pos = b.visual - el.offsetTop
      s.target = 0
      write(id, s)
      changed = true
    }
    if (changed) kick()
  }
  // A keyboard move re-inserts the focused row in the DOM, which can drop focus.
  if (grabbedId.value !== null) focusRow(grabbedId.value)
})

// ---------- Keyboard ----------

let grabOrigin: DragDropItem[] | null = null
let grabFromIndex = 0

function say(template: string, index?: number) {
  announcement.value = template
    .replace('{pos}', String((index ?? 0) + 1))
    .replace('{total}', String(props.modelValue.length))
}

function focusRow(id: Id) {
  const row = rowEls.get(id)
  const target = props.handle ? row?.querySelector<HTMLElement>('[data-drag-handle]') : row
  if (target && document.activeElement !== target) target.focus({ preventScroll: true })
}

function onKeydown(e: KeyboardEvent, index: number) {
  // Only keys aimed at the row/handle itself, not at a control inside the slot.
  if (props.disabled || e.target !== e.currentTarget) return
  const item = props.modelValue[index]
  if (!item) return
  const grabbed = grabbedId.value === item.id

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (!grabbed) {
      grabbedId.value = item.id
      grabOrigin = [...props.modelValue]
      grabFromIndex = index
      say(t.reorderGrabbed, index)
    } else {
      grabbedId.value = null
      grabOrigin = null
      settlingId.value = item.id
      kick()
      say(t.reorderDropped, index)
    }
  } else if (grabbed && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const to = e.key === 'ArrowUp' ? index - 1 : index + 1
    if (to < 0 || to >= props.modelValue.length) return
    commit(index, to)
    say(t.reorderMoved, to)
  } else if (grabbed && e.key === 'Escape') {
    // Cancelling the move uses the key: a dialog around the list stays open
    e.preventDefault()
    e.stopPropagation()
    cancelKeyboard(index)
  }
}

function cancelKeyboard(currentIndex: number) {
  const origin = grabOrigin
  const id = grabbedId.value
  grabbedId.value = null
  grabOrigin = null
  if (origin && currentIndex !== grabFromIndex) {
    emit('update:modelValue', origin)
    emit('reorder', { from: currentIndex, to: grabFromIndex, items: origin })
  }
  if (id !== null) settlingId.value = id
  kick()
  say(t.reorderCancelled)
}

function onBlur(e: FocusEvent, index: number) {
  // Tabbing away while grabbed drops the row where it is.
  if (e.target !== e.currentTarget) return
  const item = props.modelValue[index]
  if (!item || grabbedId.value !== item.id) return
  // Focus can briefly leave while Vue moves the row; onUpdated restores it.
  requestAnimationFrame(() => {
    const row = rowEls.get(item.id)
    if (grabbedId.value === item.id && row && !row.contains(document.activeElement)) {
      grabbedId.value = null
      grabOrigin = null
    }
  })
}

function handlePropsFor(index: number, id: Id): Record<string, unknown> {
  if (!props.handle) return {}
  return {
    'data-drag-handle': '',
    role: 'button',
    tabindex: props.disabled ? -1 : 0,
    'aria-label': t.reorderHandle,
    'aria-pressed': grabbedId.value === id,
    'aria-disabled': props.disabled || undefined,
    style: { touchAction: 'none', cursor: props.disabled ? 'default' : draggingId.value === id ? 'grabbing' : 'grab' },
    onPointerdown: (e: PointerEvent) => {
      e.stopPropagation()
      onPointerDown(e, index, true)
    },
    onKeydown: (e: KeyboardEvent) => onKeydown(e, index),
    onBlur: (e: FocusEvent) => onBlur(e, index),
  }
}

onMounted(() => {
  rootEl.value?.addEventListener('touchmove', onTouchMove, { passive: false })
})
onBeforeUnmount(() => {
  rootEl.value?.removeEventListener('touchmove', onTouchMove)
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
    ref="rootEl"
    class="relative flex flex-col"
    :class="disabled ? 'opacity-[0.38]' : ''"
    role="list"
    @contextmenu="onContextMenu"
  >
    <div
      v-for="(item, index) in modelValue"
      :key="item.id"
      :ref="(el) => setRowEl(item.id, el)"
      role="listitem"
      class="group relative outline-none"
      :class="[
        bare
          ? ['transition-[filter] duration-150', isLifted(item.id) ? 'm3-dd-bare-lifted z-10' : '']
          : [
              'flex min-h-14 items-center gap-4 px-4 py-2 transition-[box-shadow,background-color,border-radius] duration-150',
              isLifted(item.id) ? 'z-10 rounded-lg bg-surface shadow-elevation-4' : 'rounded-none',
            ],
        !handle && !disabled
          ? [
              'cursor-grab touch-pan-y select-none [-webkit-touch-callout:none]',
              bare
                ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'
                : 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary',
            ]
          : '',
        draggingId === item.id ? 'cursor-grabbing' : '',
      ]"
      :tabindex="!handle && !disabled ? 0 : undefined"
      :aria-grabbed="!handle ? grabbedId === item.id : undefined"
      @pointerdown="onPointerDown($event, index, false)"
      @keydown="!handle && onKeydown($event, index)"
      @blur="!handle && onBlur($event, index)"
    >
      <!-- State layer: 8% hover, 16% while dragged (DraggedStateLayerOpacity) -->
      <span
        v-if="!bare"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 rounded-[inherit] bg-on-surface transition-opacity duration-150"
        :class="
          isLifted(item.id)
            ? 'opacity-[0.16]'
            : !disabled && !handle
              ? 'opacity-0 group-hover:opacity-[0.08]'
              : 'opacity-0'
        "
      />

      <button
        v-if="handle && !bare"
        type="button"
        data-drag-handle
        class="relative -ml-2 flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-full text-on-surface-variant outline-none transition-colors hover:bg-on-surface/8 focus-visible:ring-2 focus-visible:ring-secondary"
        :class="disabled ? 'cursor-default' : draggingId === item.id ? 'cursor-grabbing' : 'cursor-grab'"
        :aria-label="t.reorderHandle"
        :aria-pressed="grabbedId === item.id"
        :disabled="disabled"
        @pointerdown.stop="onPointerDown($event, index, true)"
        @keydown="onKeydown($event, index)"
        @blur="onBlur($event, index)"
      >
        <MIcon name="drag_indicator" :size="24" />
      </button>

      <div :class="bare ? '' : 'relative min-w-0 flex-1 text-body-large text-on-surface'">
        <slot
          :item="item"
          :index="index"
          :dragging="isLifted(item.id)"
          :handle-props="handlePropsFor(index, item.id)"
        >
          <span>{{ item.id }}</span>
        </slot>
      </div>
    </div>

    <div class="sr-only" aria-live="assertive" aria-atomic="true">{{ announcement }}</div>
  </div>
</template>

<style scoped>
/* Elevation level 4 as a drop-shadow, so in `bare` mode it follows whatever shape the slot
   draws (rounded card, pill...) instead of the row's own box. */
.m3-dd-bare-lifted {
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.3)) drop-shadow(0 6px 10px rgb(0 0 0 / 0.15));
}
</style>
