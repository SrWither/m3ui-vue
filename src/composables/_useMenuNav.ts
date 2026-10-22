import { computed, nextTick, onUnmounted, ref } from 'vue'
import { motionSprings } from './motion'
import { playSamples, prefersReducedMotion, sampleSpring } from './_springAnimation'

/*
 * Internal (not exported from index.ts): the `submenuMode="push"` navigation shared by MMenu and MContextMenu.
 * A stack of levels (one per opened MMenuItem with #children) shown one at a time in the panel's scroll
 * wrapper (`navBox`), with:
 * - M3's shared axis X between levels: a 30dp slide with a crossfade, the old level fading out quickly and the
 *   new one fading in after it. Driven by the Web Animations API through a `:css="false"` Transition: with
 *   direction-dependent classes on a mode-less Transition, Vue's class swap unreliably never completed.
 * - the panel's height following the new level on a spring (Standard DefaultSpatial), measured before and
 *   after the swap, with no scrollbar while the levels cross.
 * - swipe right to go back on touch: the level follows the finger and, released past a third of the panel
 *   (or flung), leaves from where it is; otherwise it springs back.
 */

export type MenuNavEntry = { icon?: string, header?: () => any, content?: () => any }

const SHARED_AXIS_OFFSET = 30
// Back to scrolling once the slide (60ms delay + 300ms) has settled
const SLIDE_SETTLE_MS = 380
// A touch decides between a vertical scroll and a swipe once it has moved this far
const SWIPE_SLOP = 8
const SWIPE_DISTANCE = 1 / 3
const SWIPE_VELOCITY = 0.5 // px/ms

export function useMenuNav(focusFirst: () => void) {
  const navStack = ref<MenuNavEntry[]>([])
  const currentNav = computed(() => navStack.value[navStack.value.length - 1])
  const navDirection = ref<'forward' | 'backward'>('forward')
  const navBox = ref<HTMLElement>()

  // Where a swiped level was released, so its leave starts there instead of jumping back to 0
  let leaveFromX = 0
  let leaveFromOpacity = 1

  function navSlideEnter(el: Element, done: () => void) {
    const dir = navDirection.value === 'forward' ? 1 : -1
    const anim = (el as HTMLElement).animate(
      [
        { transform: `translateX(${dir * SHARED_AXIS_OFFSET}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 300, delay: 60, easing: 'cubic-bezier(0.05,0.7,0.1,1)', fill: 'backwards' },
    )
    anim.onfinish = done
  }

  function navSlideLeave(el: Element, done: () => void) {
    const dir = navDirection.value === 'forward' ? -1 : 1
    const htmlEl = el as HTMLElement
    htmlEl.style.position = 'absolute'
    htmlEl.style.insetInline = '0'
    htmlEl.style.top = '0'
    const from = leaveFromX
    const opacity = leaveFromOpacity
    leaveFromX = 0
    leaveFromOpacity = 1
    const anim = htmlEl.animate(
      [
        { transform: `translateX(${from}px)`, opacity },
        { transform: `translateX(${from + dir * SHARED_AXIS_OFFSET}px)`, opacity: 0 },
      ],
      { duration: 90, easing: 'cubic-bezier(0.3,0,0.8,0.15)', fill: 'forwards' },
    )
    anim.onfinish = done
  }

  function resizeAround(change: () => void) {
    const el = navBox.value
    const from = el?.offsetHeight ?? 0
    // Both levels overflow for a moment: no scrollbar until they settle, then the wrapper's own inline value
    const prevOverflow = el?.style.overflowY ?? ''
    if (el) el.style.overflowY = 'hidden'
    const restore = () => { if (el) el.style.overflowY = prevOverflow }
    change()
    if (!el || prefersReducedMotion()) return restore()
    nextTick(() => {
      const to = el.offsetHeight
      const anim = Math.abs(to - from) < 1 ? null
        : playSamples(el, sampleSpring(from, to, 0, motionSprings.standard.defaultSpatial, 0.5), (h) => ({ height: `${h}px` }))
      const slide = new Promise((r) => setTimeout(r, SLIDE_SETTLE_MS))
      Promise.all([slide, anim?.finished.catch(() => {})]).then(restore)
    })
  }

  function pushNav(entry: MenuNavEntry) {
    navDirection.value = 'forward'
    resizeAround(() => navStack.value.push(entry))
    nextTick(focusFirst)
  }

  function popNav() {
    navDirection.value = 'backward'
    resizeAround(() => navStack.value.pop())
    nextTick(focusFirst)
  }

  function resetNav() {
    navStack.value = []
  }

  // Swipe back. The wrapper has `touch-action: pan-y` while a level is pushed, so a sideways drag reaches us
  // as pointer events while vertical ones still scroll the list
  let swipe: { id: number, x: number, y: number, level: HTMLElement, width: number, active: boolean, lastX: number, lastT: number, vel: number } | null = null

  function levelEl() {
    // The level on screen (a level still leaving has another depth)
    return navBox.value?.querySelector<HTMLElement>(`:scope > [data-menu-level="${navStack.value.length}"]`) ?? null
  }

  function onNavPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'touch' || !navStack.value.length || swipe) return
    const level = levelEl()
    if (!level) return
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, level, width: navBox.value!.clientWidth, active: false, lastX: e.clientX, lastT: e.timeStamp, vel: 0 }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function writeDrag(dx: number) {
    if (!swipe) return
    swipe.level.style.transform = `translateX(${dx}px)`
    swipe.level.style.opacity = String(1 - 0.5 * Math.min(1, dx / swipe.width))
  }

  function onMove(e: PointerEvent) {
    if (!swipe || e.pointerId !== swipe.id) return
    const dx = e.clientX - swipe.x
    const dy = e.clientY - swipe.y
    if (!swipe.active) {
      if (Math.hypot(dx, dy) < SWIPE_SLOP) return
      // Vertical (a scroll) or leftwards: not ours
      if (Math.abs(dy) > Math.abs(dx) || dx < 0) return stopListening()
      swipe.active = true
      swipe.x = e.clientX
      swipe.level.getAnimations().forEach((a) => a.finish())
    }
    const dt = e.timeStamp - swipe.lastT
    if (dt > 0) swipe.vel = 0.8 * ((e.clientX - swipe.lastX) / dt) + 0.2 * swipe.vel
    swipe.lastX = e.clientX
    swipe.lastT = e.timeStamp
    writeDrag(Math.max(0, e.clientX - swipe.x))
  }

  function onUp(e: PointerEvent) {
    if (!swipe || e.pointerId !== swipe.id) return
    const s = swipe
    stopListening()
    if (!s.active) return
    // The finger lifted on an item: that's not a tap on it. The click comes in a later task, so the guard
    // waits for it a little while
    window.addEventListener('click', swallowClick, { capture: true, once: true })
    clearTimeout(swallowTimer)
    swallowTimer = setTimeout(stopSwallowing, 400)
    const dx = Math.max(0, e.clientX - s.x)
    if (dx > s.width * SWIPE_DISTANCE || s.vel > SWIPE_VELOCITY) {
      leaveFromX = dx
      leaveFromOpacity = Number(s.level.style.opacity || 1)
      popNav()
    }
    else settleBack(s.level, dx)
  }

  function onCancel(e: PointerEvent) {
    if (!swipe || e.pointerId !== swipe.id) return
    const s = swipe
    stopListening()
    if (s.active) settleBack(s.level, Math.max(0, s.lastX - s.x))
  }

  function settleBack(level: HTMLElement, dx: number) {
    level.style.transform = ''
    level.style.opacity = ''
    if (prefersReducedMotion() || dx < 1) return
    const width = navBox.value?.clientWidth || 1
    playSamples(level, sampleSpring(dx, 0, 0, motionSprings.standard.defaultSpatial, 0.5), (x) => ({
      transform: `translateX(${x}px)`,
      opacity: String(1 - 0.5 * Math.min(1, x / width)),
    }))
  }

  let swallowTimer: ReturnType<typeof setTimeout> | undefined
  function stopSwallowing() {
    clearTimeout(swallowTimer)
    window.removeEventListener('click', swallowClick, { capture: true })
  }

  function swallowClick(e: Event) {
    e.stopPropagation()
    e.preventDefault()
  }

  function stopListening() {
    swipe = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }

  onUnmounted(() => {
    stopListening()
    stopSwallowing()
  })

  return { navStack, currentNav, navBox, navSlideEnter, navSlideLeave, pushNav, popNav, resetNav, onNavPointerDown }
}
