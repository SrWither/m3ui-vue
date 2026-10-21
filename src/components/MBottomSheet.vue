<script setup lang="ts">
/**
 * A sheet that slides up from the bottom of the screen, capped at a 640px max width and rounded top corners.
 * Supports drag-to-dismiss via the handle bar, or tapping the scrim. With `partial`, a sheet taller than that
 * share of the screen opens partially expanded and is dragged (handle or content) up to its full height,
 * after Compose's ModalBottomSheet.
 *
 * @slot default Sheet body content (scrollable)
 * @slot actions Footer action buttons, shown in a bordered strip below the content
 * @event update:modelValue Emitted when the sheet closes (scrim click, drag-to-dismiss, or the close button) —
 *   powers v-model
 * @event update:expanded Emitted when the sheet moves between partially and fully expanded (or closes) —
 *   powers v-model:expanded
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { useSheetMotion } from '../composables/_useSheetMotion'

const props = withDefaults(defineProps<{
  /** Open/closed state (v-model) */
  modelValue: boolean
  /** Sheet header title */
  title?: string
  /**
   * Tallest the sheet gets, as a CSS length (`'480px'`, `'70dvh'`); past it the content scrolls. Default 60vh,
   * or the whole screen with `partial`
   */
  maxHeight?: string
  /** @deprecated Use `max-height="92vh"` */
  fullHeight?: boolean
  /**
   * Opens a sheet taller than this share of the screen partially expanded (`true` = half, or a ratio
   * like 0.4); dragging the handle or the content up expands it fully
   */
  partial?: boolean | number
  /** Fully (true) or partially (false) expanded, with `partial` (v-model:expanded) */
  expanded?: boolean
  /** Squares the top corners while the expanded sheet fills the screen, as Android's views sheet does */
  squareCornersWhenFull?: boolean
}>(), { fullHeight: false, partial: false, expanded: false, squareCornersWhenFull: false })

const emit = defineEmits<{ 'update:modelValue': [boolean]; 'update:expanded': [boolean] }>()
const close = () => emit('update:modelValue', false)
const locale = useLocale()

// Only the safe area is kept clear at the top, like the status bar inset in Compose
const FULL = 'calc(100dvh - env(safe-area-inset-top, 0px))'
const ratio = computed(() =>
  props.partial === true ? 0.5 : typeof props.partial === 'number' ? Math.min(1, Math.max(0, props.partial)) : 0,
)
const cap = computed(() => props.maxHeight ?? (ratio.value ? FULL : props.fullHeight ? '92vh' : '60vh'))

// The partially expanded offset, as a fraction of the panel's height: it shows `ratio` of the screen, and
// exists only when the sheet is taller than that (calculatePartiallyExpandedOffset / isPartiallyExpandedAnchorAvailable)
function partialAnchor(panel: HTMLElement): number | null {
  if (!ratio.value) return null
  const h = panel.offsetHeight
  const visible = window.innerHeight * ratio.value
  return h > visible ? (h - visible) / h : null
}

const isExpanded = ref(true)
// The sheet is tall enough for a partially expanded state (the handle then toggles it)
const hasPartial = ref(false)
const dragging = ref(false)
const fillsScreen = ref(false)
const panelEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()

// Slide in/out and drags between the anchors, as springs (see _useSheetMotion).
const motion = useSheetMotion('y', close, {
  anchors: (panel) => {
    const p = partialAnchor(panel)
    return p === null ? [0] : [0, p]
  },
  openAt: (panel) => (props.expanded ? 0 : partialAnchor(panel) ?? 0),
  onAnchor: (anchor, panel) => {
    hasPartial.value = !!panel && partialAnchor(panel) !== null
    fillsScreen.value = !!panel && panel.offsetHeight >= window.innerHeight - 2
    setExpanded(anchor === 0)
  },
  onDrag: (active) => { dragging.value = active },
})

function setExpanded(v: boolean) {
  const changed = v !== isExpanded.value
  isExpanded.value = v
  if (ratio.value && changed) emit('update:expanded', v)
  updateContentTouchAction()
}

watch(() => props.expanded, (v) => {
  const panel = panelEl.value
  if (!props.modelValue || !panel || v === isExpanded.value) return
  motion.snapTo(v ? 0 : partialAnchor(panel) ?? 0)
})

watch(() => props.modelValue, (open) => {
  if (!open && isExpanded.value && ratio.value) setExpanded(false)
})

// Content or window size changed: stay on the same state, its anchor recomputed
function reanchor() {
  const panel = panelEl.value
  if (!panel || !props.modelValue || dragging.value) return
  const p = partialAnchor(panel)
  hasPartial.value = p !== null
  fillsScreen.value = panel.offsetHeight >= window.innerHeight - 2
  if (!isExpanded.value) motion.snapTo(p ?? 0)
}
let observer: ResizeObserver | null = null
watch(panelEl, (panel) => {
  observer?.disconnect()
  observer = null
  if (!panel || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(reanchor)
  observer.observe(panel)
})
onMounted(() => window.addEventListener('resize', reanchor))
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', reanchor)
})

// ── The handle: drag it (pointer events, touch-none), or with `partial` tap it to toggle ─────────────
let handleDownY = 0
function onHandleDown(e: PointerEvent) {
  handleDownY = e.clientY
  motion.onDragStart(e)
}
function toggle() {
  const panel = panelEl.value
  const p = panel && partialAnchor(panel)
  if (p == null) return
  motion.snapTo(isExpanded.value ? p : 0)
}
function onHandleClick(e: MouseEvent) {
  if (ratio.value && Math.abs(e.clientY - handleDownY) < 4) toggle()
}

// ── With `partial`, the content drags the sheet too (ConsumeSwipeWithinBottomSheetBoundsNestedScrollConnection):
// a drag up expands it before the content scrolls, a drag down with the content at its top collapses or
// dismisses it. The drag runs along the content's scroll, so a touch goes through touch events and the first
// move decides, as in MNavigationDrawer; touch-action allows only the scroll that can actually happen (none while
// partially expanded, pan-down at the top), or Chrome delivers the touchmoves at 60Hz on a 120Hz phone.
let touch: { id: number; x: number; y: number; active: boolean; scrollFrom: number } | null = null

function updateContentTouchAction() {
  const el = contentEl.value
  if (!el || !ratio.value) return
  const directional = typeof CSS !== 'undefined' && !!CSS.supports?.('touch-action', 'pan-down')
  el.style.touchAction = !isExpanded.value
    ? 'pan-x'
    : el.scrollTop <= 0 && directional ? 'pan-x pan-down' : 'pan-x pan-y'
}

function onTouchStart(e: TouchEvent) {
  if (!ratio.value || e.touches.length !== 1) return
  if ((e.target as Element).closest('[data-sheet-handle]')) return
  const t = e.touches[0]!
  touch = { id: t.identifier, x: t.clientX, y: t.clientY, active: false, scrollFrom: 0 }
}

function onTouchMove(e: TouchEvent) {
  if (!touch) return
  const id = touch.id
  const t = Array.from(e.changedTouches).find((x) => x.identifier === id)
  if (!t) return
  if (!touch.active) {
    const dy = t.clientY - touch.y
    const dx = t.clientX - touch.x
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { touch = null; return }
    if (Math.abs(dy) < 2) return
    const content = contentEl.value
    const scrolled = !!content && content.contains(e.target as Node) && content.scrollTop > 0
    const sheetTakes = dy < 0 ? motion.target() > 1e-3 : !scrolled
    if (!sheetTakes) { touch = null; return }
    touch.active = true
    touch.scrollFrom = content?.scrollTop ?? 0
    motion.dragStart(e.currentTarget as Element, touch.y)
  }
  // Past fully expanded, the rest of the drag scrolls the content
  const over = motion.dragMove(t.clientY)
  if (contentEl.value && over > 0) contentEl.value.scrollTop = touch.scrollFrom + over
  if (e.cancelable) e.preventDefault()
}

function onTouchEnd(e: TouchEvent) {
  if (!touch) return
  const id = touch.id
  if (!Array.from(e.changedTouches).some((x) => x.identifier === id)) return
  const wasActive = touch.active
  touch = null
  if (wasActive) motion.dragEnd()
}

// A mouse wheel scrolling down a partially expanded sheet expands it first
function onWheel(e: WheelEvent) {
  if (!ratio.value || isExpanded.value || e.deltaY <= 0 || !hasPartial.value) return
  e.preventDefault()
  motion.snapTo(0)
}

const squareCorners = computed(() => props.squareCornersWhenFull && isExpanded.value && fillsScreen.value && !dragging.value)
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" @enter="motion.onEnter" @leave="motion.onLeave" appear>
      <div v-if="modelValue" class="fixed inset-0 z-200 flex flex-col justify-end">
        <!-- Scrim -->
        <div data-sheet-scrim class="absolute inset-0 bg-scrim/32" @click="close" />

        <!-- Panel -->
        <div
          ref="panelEl"
          data-sheet-panel
          class="relative mx-auto flex w-full max-w-[640px] flex-col bg-surface-container-low shadow-elevation-1 transition-[border-radius] duration-200"
          :class="[squareCorners ? 'rounded-t-none' : 'rounded-t-[28px]', ratio ? 'touch-none' : '']"
          :style="{ maxHeight: cap }"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
          @wheel="onWheel"
        >
          <!-- Drag handle -->
          <div
            data-sheet-handle
            class="flex h-12 shrink-0 cursor-grab touch-none select-none items-center justify-center outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
            :role="hasPartial ? 'button' : undefined"
            :tabindex="hasPartial ? 0 : undefined"
            :aria-label="hasPartial ? (isExpanded ? locale.sheetCollapse : locale.sheetExpand) : undefined"
            :aria-expanded="hasPartial ? isExpanded : undefined"
            @pointerdown="onHandleDown"
            @pointermove="motion.onDragMove"
            @pointerup="motion.onDragEnd"
            @pointercancel="motion.onDragEnd"
            @click="onHandleClick"
            @keydown.enter.prevent="toggle"
            @keydown.space.prevent="toggle"
          >
            <div class="h-1 w-8 rounded-full bg-on-surface-variant" />
          </div>

          <!-- Header -->
          <div v-if="title" class="flex shrink-0 items-center justify-between px-6 pb-4">
            <h2 class="text-title-large text-on-surface">{{ title }}</h2>
            <button
              :aria-label="locale.close"
              type="button"
              class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
              @click="close"
            >
              <MIcon name="close" :size="20" />
            </button>
          </div>

          <!-- Content (touch-action set by updateContentTouchAction with `partial`: it stops at this scroll container) -->
          <div
            ref="contentEl"
            class="flex-1 overflow-y-auto px-6 pb-6"
            :class="ratio ? 'overscroll-y-contain' : ''"
            @scroll.passive="updateContentTouchAction"
          >
            <slot />
          </div>

          <!-- Actions -->
          <div v-if="$slots.actions" class="shrink-0 border-t border-outline-variant px-6 py-4">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
