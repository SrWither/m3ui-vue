<script setup lang="ts">
/**
 * A hover/focus-triggered label — plain text, or a rich variant with a title, detailed content, and action
 * buttons.
 *
 * @slot default The trigger element the tooltip is anchored to
 * @slot content Rich-tooltip body content (only used when rich is true)
 * @slot actions Rich-tooltip action buttons row (only used when rich is true)
 */
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Tooltip text (plain variant), or the rich variant's title line */
  text?: string
  /** Tooltip position relative to the trigger */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Show delay in ms after hover/focus */
  delay?: number
  /**
   * Rich tooltip with a #content slot and optional #actions. Stays open when hovering the tooltip itself
   * instead of closing immediately.
   */
  rich?: boolean
}>(), { placement: 'top', delay: 600, rich: false })

const visible = ref(false)
const tipEl = ref<HTMLElement>()
const triggerEl = ref<HTMLElement>()
const tipStyle = ref<Record<string, string>>({})
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function cancelTimers() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

async function show() {
  cancelTimers()
  showTimer = setTimeout(async () => {
    visible.value = true
    await nextTick()
    reposition()
  }, props.delay)
}

function hide() {
  cancelTimers()
  if (props.rich) {
    hideTimer = setTimeout(() => { visible.value = false }, 120)
  } else {
    visible.value = false
  }
}

function onTipEnter() {
  if (!props.rich) return
  cancelTimers()
}

function onTipLeave() {
  if (!props.rich) return
  cancelTimers()
  visible.value = false
}

// Input as Compose's BasicTooltip: a mouse shows it on hover; touch and pen on a long press, which also swallows
// the click it would end in (a long-pressed button doesn't fire) and hides it TOUCH_DURATION after the finger
// lifts (BasicTooltipDefaults.TooltipDuration); focus only from the keyboard. Before, the mouse events a browser
// emulates for a tap (and the focus a tap gives a button) showed it on every tap, and it stuck around.
const LONG_PRESS = 500
const TOUCH_DURATION = 1500
let press: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null
let longPressed = false

function onPointerEnter(e: PointerEvent) {
  if (e.pointerType === 'mouse') show()
}
function onPointerLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse') hide()
}

function endPress() {
  if (press) clearTimeout(press.timer)
  press = null
  window.removeEventListener('pointermove', onPressMove)
  window.removeEventListener('pointerup', onPressUp)
  window.removeEventListener('pointercancel', onPressCancel)
}
function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  endPress()
  longPressed = false
  press = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    timer: setTimeout(async () => {
      longPressed = true
      cancelTimers()
      visible.value = true
      await nextTick()
      reposition()
    }, LONG_PRESS),
  }
  window.addEventListener('pointermove', onPressMove)
  window.addEventListener('pointerup', onPressUp)
  window.addEventListener('pointercancel', onPressCancel)
}
function onPressMove(e: PointerEvent) {
  if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) endPress()
}
function onPressUp(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  endPress()
  if (!longPressed) return
  cancelTimers()
  // A rich tooltip may hold actions to tap: it stays until a touch outside it (Compose's persistent tooltips)
  if (props.rich) document.addEventListener('pointerdown', onOutsideTouch, true)
  else hideTimer = setTimeout(() => { visible.value = false }, TOUCH_DURATION)
}
function onOutsideTouch(e: PointerEvent) {
  const t = e.target as Node
  if (tipEl.value?.contains(t) || triggerEl.value?.contains(t)) return
  document.removeEventListener('pointerdown', onOutsideTouch, true)
  visible.value = false
}
// The browser took the touch (a scroll)
function onPressCancel(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  endPress()
  if (longPressed) hide()
}
// The click a long press ends in, and the context menu it may open, belong to the tooltip
function onClickCapture(e: MouseEvent) {
  if (!longPressed) return
  longPressed = false
  e.preventDefault()
  e.stopPropagation()
}
function onContextMenu(e: Event) {
  if (press || longPressed) e.preventDefault()
}

function onFocusIn(e: FocusEvent) {
  let keyboard = true
  try { keyboard = (e.target as Element).matches(':focus-visible') } catch { /* no :focus-visible: show */ }
  if (keyboard) show()
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) {
    cancelTimers()
    visible.value = false
  }
}

function onScroll() {
  if (visible.value) {
    cancelTimers()
    visible.value = false
  }
}

function reposition() {
  if (!triggerEl.value || !tipEl.value) return
  const tr = triggerEl.value.getBoundingClientRect()
  const tt = tipEl.value.getBoundingClientRect()
  const GAP = 4

  let top = 0, left = 0
  switch (props.placement) {
    case 'top':    top = tr.top - tt.height - GAP;   left = tr.left + (tr.width - tt.width) / 2; break
    case 'bottom': top = tr.bottom + GAP;             left = tr.left + (tr.width - tt.width) / 2; break
    case 'left':   top = tr.top + (tr.height - tt.height) / 2; left = tr.left - tt.width - GAP; break
    case 'right':  top = tr.top + (tr.height - tt.height) / 2; left = tr.right + GAP; break
  }

  top  = Math.max(6, Math.min(top,  window.innerHeight - tt.height - 6))
  left = Math.max(6, Math.min(left, window.innerWidth  - tt.width  - 6))
  tipStyle.value = { top: `${top}px`, left: `${left}px` }
}

onMounted(() => window.addEventListener('scroll', onScroll, true))
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  cancelTimers()
  endPress()
  document.removeEventListener('pointerdown', onOutsideTouch, true)
})
</script>

<template>
  <span
    ref="triggerEl"
    v-bind="$attrs"
    class="inline-flex"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerDown"
    @click.capture="onClickCapture"
    @contextmenu="onContextMenu"
    @focusin="onFocusIn"
    @focusout="hide"
    @keydown="onKeyDown"
  >
    <slot />
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <!-- Plain tooltip -->
      <div
        v-if="visible && !rich && text"
        ref="tipEl"
        class="pointer-events-none fixed z-400 min-h-6 min-w-10 max-w-[200px] rounded bg-inverse-surface px-2 py-1 text-body-small text-inverse-on-surface"
        :style="tipStyle"
        role="tooltip"
      >
        {{ text }}
      </div>

      <!-- Rich tooltip -->
      <div
        v-else-if="visible && rich"
        ref="tipEl"
        class="fixed z-400 max-w-[320px] rounded-xl bg-surface-container shadow-elevation-2"
        :style="tipStyle"
        role="tooltip"
        @mouseenter="onTipEnter"
        @mouseleave="onTipLeave"
      >
        <div v-if="text" class="px-4 pt-3 pb-1 text-title-small font-medium text-on-surface-variant">
          {{ text }}
        </div>
        <div class="px-4 py-2 text-body-medium text-on-surface-variant">
          <slot name="content" />
        </div>
        <div v-if="$slots.actions" class="flex justify-end gap-2 px-4 pb-3">
          <slot name="actions" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
