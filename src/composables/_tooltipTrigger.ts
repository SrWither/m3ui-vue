/*
 * Internal (not exported from index.ts): what opens and closes a tooltip, shared by MTooltip and v-tooltip.
 *
 * Input as Compose's BasicTooltip: a mouse shows it on hover after `delay`; touch and pen on a long press, which
 * also swallows the click it would end in (a long-pressed button doesn't fire) and hides it TOUCH_DURATION after
 * the finger lifts (BasicTooltipDefaults.TooltipDuration); focus only from the keyboard. Escape hides it (and
 * stops there, so a dialog around it stays open), and so does any scroll. A rich tooltip closes a moment after
 * the pointer leaves (so it can move onto the tooltip), and after a long press stays until a touch outside it.
 */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

const LONG_PRESS = 500
const TOUCH_DURATION = 1500
const RICH_HIDE_DELAY = 120
const GAP = 4
const MARGIN = 6

/** Where `tip` goes next to `trigger`, kept 6px inside the window */
export function placeTooltip(trigger: HTMLElement, tip: HTMLElement, placement: TooltipPlacement) {
  const tr = trigger.getBoundingClientRect()
  const tt = tip.getBoundingClientRect()
  let top = 0
  let left = 0
  switch (placement) {
    case 'top': top = tr.top - tt.height - GAP; left = tr.left + (tr.width - tt.width) / 2; break
    case 'bottom': top = tr.bottom + GAP; left = tr.left + (tr.width - tt.width) / 2; break
    case 'left': top = tr.top + (tr.height - tt.height) / 2; left = tr.left - tt.width - GAP; break
    case 'right': top = tr.top + (tr.height - tt.height) / 2; left = tr.right + GAP; break
  }
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - tt.height - MARGIN))
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - tt.width - MARGIN))
  return { top, left }
}

export interface TooltipTriggerOptions {
  delay: () => number
  rich?: () => boolean
  visible: () => boolean
  open: () => void
  close: () => void
  /** The tooltip's element while shown: a touch on it doesn't close a rich tooltip */
  tip: () => HTMLElement | null | undefined
}

export function createTooltipTrigger(el: HTMLElement, o: TooltipTriggerOptions) {
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let press: { id: number, x: number, y: number, timer: ReturnType<typeof setTimeout> } | null = null
  let longPressed = false
  const rich = () => o.rich?.() ?? false

  function cancel() {
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
  }
  function show() {
    cancel()
    showTimer = setTimeout(o.open, o.delay())
  }
  function hide() {
    cancel()
    if (rich()) hideTimer = setTimeout(o.close, RICH_HIDE_DELAY)
    else o.close()
  }
  function closeNow() {
    cancel()
    o.close()
  }

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
      timer: setTimeout(() => {
        longPressed = true
        cancel()
        o.open()
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
    cancel()
    // A rich tooltip may hold actions to tap: it stays until a touch outside it (Compose's persistent tooltips)
    if (rich()) document.addEventListener('pointerdown', onOutsideTouch, true)
    else hideTimer = setTimeout(o.close, TOUCH_DURATION)
  }
  function onOutsideTouch(e: PointerEvent) {
    const t = e.target as Node
    if (o.tip()?.contains(t) || el.contains(t)) return
    document.removeEventListener('pointerdown', onOutsideTouch, true)
    o.close()
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
    if (e.key === 'Escape' && o.visible()) {
      // Hiding the tooltip uses the key: a dialog around it stays open
      e.stopPropagation()
      closeNow()
    }
  }
  function onScroll() {
    if (o.visible()) closeNow()
  }

  el.addEventListener('pointerenter', onPointerEnter)
  el.addEventListener('pointerleave', onPointerLeave)
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('click', onClickCapture, true)
  el.addEventListener('contextmenu', onContextMenu)
  el.addEventListener('focusin', onFocusIn)
  el.addEventListener('focusout', hide)
  el.addEventListener('keydown', onKeyDown)
  window.addEventListener('scroll', onScroll, true)

  return {
    /** Keeps it open (the pointer moved onto a rich tooltip) */
    cancel,
    /** Closes it at once */
    closeNow,
    destroy() {
      cancel()
      endPress()
      document.removeEventListener('pointerdown', onOutsideTouch, true)
      el.removeEventListener('pointerenter', onPointerEnter)
      el.removeEventListener('pointerleave', onPointerLeave)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('click', onClickCapture, true)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', hide)
      el.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    },
  }
}
