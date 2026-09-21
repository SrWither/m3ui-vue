<script setup lang="ts">
import { computed, Fragment, inject, nextTick, onMounted, onUnmounted, provide, ref, useSlots, watch, type VNode } from 'vue'
import MIcon from './MIcon.vue'
import MMenuDivider from './MMenuDivider.vue'

const props = withDefaults(
  defineProps<{
    /** Which edge of the trigger the dropdown aligns to. */
    align?: 'left' | 'right'
    /**
     * How items with a `#children` slot behave.
     * `'flyout'` opens a hover-positioned side panel (desktop).
     * `'push'` replaces the panel's own content with the submenu and a
     * back header — no positioning math, works with touch. Useful for mobile.
     */
    submenuMode?: 'flyout' | 'push'
    /**
     * `'standard'` is M3's baseline menu — square-ish 4dp corners
     * (`MenuTokens.ContainerShape`/`CornerExtraSmall`).
     * `'expressive'` is M3's rounder "vertical menu" styling — 16dp corners
     * (`SegmentedMenuTokens.ContainerShape`/`CornerLarge`). Combine with
     * `<MMenuDivider gap />` to split the panel into independently-rounded
     * groups with a visible gap between them, instead of a plain line.
     */
    variant?: 'standard' | 'expressive'
  }>(),
  { align: 'right', submenuMode: 'flyout', variant: 'standard' },
)

const slots = useSlots()

function flattenVNodes(vnodes: VNode[]): VNode[] {
  const out: VNode[] = []
  for (const vnode of vnodes) {
    if (vnode.type === Fragment && Array.isArray(vnode.children)) {
      out.push(...flattenVNodes(vnode.children as VNode[]))
    } else {
      out.push(vnode)
    }
  }
  return out
}

function isGapDivider(vnode: VNode): boolean {
  if (vnode.type !== MMenuDivider) return false
  const gap = (vnode.props as { gap?: unknown } | null)?.gap
  return gap === '' || gap === true || gap === 'true'
}

// Splits the default slot's content into groups at each `<MMenuDivider gap />`
// — only used by the 'expressive' variant to render independently-rounded
// group boxes. A plain `<MMenuDivider />` (no `gap`) stays a normal in-line
// divider inside a single group, same as 'standard'.
const groups = computed(() => {
  if (props.variant !== 'expressive') return null
  const raw = flattenVNodes((slots.default?.({ close }) ?? []) as VNode[])
  const result: VNode[][] = [[]]
  for (const vnode of raw) {
    if (isGapDivider(vnode)) result.push([])
    else result[result.length - 1]!.push(vnode)
  }
  return result.filter(g => g.length > 0)
})
const isGrouped = computed(() => !!groups.value && groups.value.length > 1)

type NavEntry = { icon?: string, header?: () => any, content?: () => any }
const navStack = ref<NavEntry[]>([])
const currentNav = computed(() => navStack.value[navStack.value.length - 1])
const navDirection = ref<'forward' | 'backward'>('forward')

// Driven by the Web Animations API rather than Vue's CSS-class transition
// hooks — with dynamic (direction-dependent) enter/leave classes on a
// Transition with no `mode`, Vue's from->active->to class swap unreliably
// never completed (elements got stuck straddling from/active with the
// animation never actually running), so this drives it directly instead.
const slideDuration = 220
function navSlideEnter(el: Element, done: () => void) {
  const dir = navDirection.value === 'forward' ? 1 : -1
  const anim = (el as HTMLElement).animate(
    [
      { transform: `translateX(${dir * 100}%)`, opacity: 0.4 },
      { transform: 'translateX(0%)', opacity: 1 },
    ],
    { duration: slideDuration, easing: 'cubic-bezier(0.05,0.7,0.1,1)' },
  )
  anim.onfinish = done
}
function navSlideLeave(el: Element, done: () => void) {
  const dir = navDirection.value === 'forward' ? -1 : 1
  const htmlEl = el as HTMLElement
  htmlEl.style.position = 'absolute'
  htmlEl.style.insetInline = '0'
  htmlEl.style.top = '0'
  const anim = htmlEl.animate(
    [
      { transform: 'translateX(0%)', opacity: 1 },
      { transform: `translateX(${dir * 100}%)`, opacity: 0.4 },
    ],
    { duration: slideDuration, easing: 'cubic-bezier(0.3,0,0.8,0.15)' },
  )
  anim.onfinish = done
}

// The real DropdownMenuContent in Menu.kt animates scale (0.8 -> 1) and alpha
// (0 -> 1) with actual springs (MotionSchemeKeyTokens.FastSpatial/FastEffects
// on the Standard scheme, StandardMotionTokens: scale dampingRatio 0.9/
// stiffness 1400, alpha dampingRatio 1.0/stiffness 3800) — not a duration+
// easing tween, which is why a cubic-bezier stand-in read as an abrupt cut on
// close (a bezier can't carry a spring's momentum). But running the *close*
// as its own independent spring toward the opposite target isn't right
// either: alpha (stiffness 3800) settles much faster than scale (stiffness
// 1400), so on close the panel fades to invisible well before it finishes
// shrinking — you never actually see the shrink. On open this isn't a
// problem (it becomes visible early, *then* you watch it keep growing), but
// close needs to be the literal time-reverse of open, not a forward
// simulation toward reversed targets, so the shrink stays visible the whole
// time and only the fade races ahead right at the very end (mirroring how
// the fade led at the very start of open). Simulated once (open direction
// only) and played back forwards for enter, backwards for leave.
//
// A damped spring approaches its target exponentially, so it keeps "settling"
// long after the motion is visually done — with a tight (0.001) tolerance on
// both position *and* velocity, roughly the last third of the recorded
// trajectory is values within a fraction of a percent of the target, visually
// indistinguishable from it. Reversed for close, that flat tail lands at the
// *start* instead, so nothing visibly happens for the first ~80ms before the
// close animation actually appears to begin. Trimmed on position alone with a
// much looser tolerance instead, since that's what's actually visible.
let cachedTrajectory: { scale: number, alpha: number }[] | null = null
const trajectoryStep = 1 / 240
function openTrajectory() {
  if (cachedTrajectory) return cachedTrajectory
  const samples: { scale: number, alpha: number }[] = []
  let scale = 0.8
  let scaleVel = 0
  let alpha = 0
  let alphaVel = 0
  const scaleDamping = 0.9
  const scaleStiffness = 1400
  const alphaDamping = 1.0
  const alphaStiffness = 3800
  for (let t = 0; t < 1; t += trajectoryStep) {
    samples.push({ scale, alpha })
    scaleVel += (-scaleStiffness * (scale - 1) - 2 * scaleDamping * Math.sqrt(scaleStiffness) * scaleVel) * trajectoryStep
    scale += scaleVel * trajectoryStep
    alphaVel += (-alphaStiffness * (alpha - 1) - 2 * alphaDamping * Math.sqrt(alphaStiffness) * alphaVel) * trajectoryStep
    alpha += alphaVel * trajectoryStep
    const visuallySettled = Math.abs(scale - 1) < 0.003 && Math.abs(alpha - 1) < 0.003
    if (visuallySettled) break
  }
  samples.push({ scale: 1, alpha: 1 })
  cachedTrajectory = samples
  return samples
}

// Vue interrupts and reverses this mid-flight when the menu is toggled
// quickly (close while still opening, or vice versa) — it calls the other
// hook on the same still-mounted element without waiting for `done()`. Both
// `currentIdx` (how far along the trajectory we are, so a reversal continues
// smoothly from wherever it currently is instead of snapping back to a fixed
// start) and `cancelActive` (so the previous rAF loop actually stops instead
// of running alongside the new one, fighting over the same style every
// frame) have to live outside this function to survive that interruption.
let currentIdx = 0
let cancelActive: (() => void) | null = null

function playTrajectory(el: Element, done: () => void, opening: boolean) {
  cancelActive?.()
  const htmlEl = el as HTMLElement
  const samples = openTrajectory()
  const last = samples.length - 1
  const direction = opening ? 1 : -1
  const target = opening ? last : 0
  let lastTime = 0
  let rafId = 0
  let cancelled = false

  function apply(idx: number) {
    const sample = samples[Math.round(Math.max(0, Math.min(last, idx)))]!
    htmlEl.style.transform = `scale(${sample.scale})`
    htmlEl.style.opacity = String(Math.min(1, Math.max(0, sample.alpha)))
  }

  function step(now: number) {
    if (cancelled) return
    const dtSteps = lastTime ? (now - lastTime) / 1000 / trajectoryStep : 1
    lastTime = now
    currentIdx = Math.max(0, Math.min(last, currentIdx + direction * dtSteps))
    apply(currentIdx)
    if ((opening && currentIdx >= target) || (!opening && currentIdx <= target)) {
      cancelActive = null
      done()
      return
    }
    rafId = requestAnimationFrame(step)
  }

  cancelActive = () => { cancelled = true; cancelAnimationFrame(rafId) }
  apply(currentIdx)
  rafId = requestAnimationFrame(step)
}
function panelEnter(el: Element, done: () => void) {
  playTrajectory(el, done, true)
}
function panelLeave(el: Element, done: () => void) {
  playTrajectory(el, done, false)
}

function pushNav(entry: NavEntry) {
  navDirection.value = 'forward'
  navStack.value.push(entry)
  nextTick(() => focusFirstItem())
}

function popNav() {
  navDirection.value = 'backward'
  navStack.value.pop()
  nextTick(() => focusFirstItem())
}

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const dropdownEl = ref<HTMLElement | null>(null)
const dropStyle = ref<Record<string, string>>({})

// A menu can be nested inside another MMenu/MContextMenu's slot (e.g. a
// "Language" picker menu inside a "More options" overflow menu) — since both
// Teleport straight to <body>, the outer one's panel DOM never contains the
// inner one's, so the outer's outside-click check would otherwise see a click
// inside the nested menu as "outside" and close (unmount) itself on
// mousedown, before the inner button's own click can fire. Sharing one
// registry of open panel elements across the whole logical (not DOM) menu
// tree via provide/inject fixes that for arbitrary nesting depth.
const panelRegistry = inject<Set<HTMLElement>>('m-menu-panel-registry', new Set())
provide('m-menu-panel-registry', panelRegistry)

watch(dropdownEl, (el, oldEl) => {
  if (oldEl) panelRegistry.delete(oldEl)
  if (el) panelRegistry.add(el)
})

onUnmounted(() => {
  if (dropdownEl.value) panelRegistry.delete(dropdownEl.value)
})

// Separate from panelRegistry above: that one is shared all the way down the
// nesting chain so a click inside a descendant menu never closes an ancestor.
// This one is scoped to just this menu's *direct* children (e.g. "Language"
// and "Color palette", both nested inside the same "More options" menu) —
// without it, opening one no longer closes the other (since panelRegistry now
// treats a click on either as "inside" the shared ancestor), so two sibling
// pickers could stay open at once. Only one child of the same parent open at
// a time, like an accordion; doesn't affect unrelated top-level menus.
const siblingGroup = inject<{ current: (() => void) | null } | null>('m-menu-sibling-group', null)
provide('m-menu-sibling-group', { current: null })

function computePos() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const openAbove = spaceBelow < 200 && rect.top > spaceBelow

  const style: Record<string, string> = {
    maxHeight: `${Math.min(openAbove ? rect.top - 12 : spaceBelow, 400)}px`,
  }

  if (openAbove) {
    style.bottom = `${window.innerHeight - rect.top + 4}px`
  } else {
    style.top = `${rect.bottom + 4}px`
  }

  if (props.align === 'right') {
    style.right = `${window.innerWidth - rect.right}px`
  } else {
    style.left = `${rect.left}px`
  }

  dropStyle.value = style
}

function focusableItems() {
  if (!dropdownEl.value) return []
  return Array.from(
    dropdownEl.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
  )
}

function focusFirstItem() {
  nextTick(() => focusableItems()[0]?.focus())
}

function moveFocus(dir: 1 | -1) {
  const items = focusableItems()
  if (!items.length) return
  const idx = items.indexOf(document.activeElement as HTMLElement)
  const next = idx === -1
    ? (dir === 1 ? items[0] : items[items.length - 1])
    : items[(idx + dir + items.length) % items.length]
  next?.focus()
}

function toggle() {
  if (!open.value) {
    if (siblingGroup && siblingGroup.current && siblingGroup.current !== close) {
      siblingGroup.current()
    }
    if (siblingGroup) siblingGroup.current = close
    computePos()
    navStack.value = []
  } else if (siblingGroup?.current === close) {
    siblingGroup.current = null
  }
  open.value = !open.value
  if (open.value) focusFirstItem()
}

function close() {
  if (siblingGroup?.current === close) siblingGroup.current = null
  open.value = false
}

provide('m-menu-close', close)
provide('m-menu-nav', { mode: props.submenuMode, push: pushNav })
defineExpose({ close, open })

function onOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (triggerEl.value?.contains(t)) return
  for (const panel of panelRegistry) {
    if (panel.contains(t)) return
  }
  if ((t as Element).closest?.('.m3-submenu')) return
  close()
}

function onScroll(e: Event) {
  if (!open.value) return
  if (dropdownEl.value?.contains(e.target as Node)) return
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (navStack.value.length) popNav()
    else close()
    return
  }
  if (!open.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
}

onMounted(() => {
  document.addEventListener('mousedown', onOutsideClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll, true)
  cancelActive?.()
})

const origin = computed(() =>
  props.align === 'right' ? 'top right' : 'top left',
)
</script>

<template>
  <div ref="triggerEl" class="inline-block" @click="toggle">
    <slot name="trigger" :open="open" />
  </div>

  <Teleport to="body">
    <Transition :css="false" @enter="panelEnter" @leave="panelLeave">
      <div
        v-if="open"
        ref="dropdownEl"
        class="fixed z-500 min-w-48"
        :class="[
          variant === 'expressive' ? 'rounded-lg' : 'rounded-xs',
          isGrouped ? '' : 'shadow-elevation-2',
        ]"
        :style="{ ...dropStyle, transformOrigin: origin }"
      >
        <!-- overflow-hidden (for the rounded-corner clip and to clip the push
             submenu's slide) lives on this inner wrapper, never together with
             shadow-elevation-2 on the same box — overflow-hidden clips an
             element's own box-shadow too, so the two have to be on separate
             elements or the shadow gets cut off -->
        <div
          class="overflow-hidden"
          :class="[
            variant === 'expressive' ? 'rounded-lg' : 'rounded-xs',
            isGrouped ? '' : 'bg-surface-container',
          ]"
        >
          <div class="relative overflow-y-auto py-1" :style="{ maxHeight: dropStyle.maxHeight }">
            <Transition :css="false" @enter="navSlideEnter" @leave="navSlideLeave">
              <div v-if="currentNav" :key="navStack.length">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 border-b border-outline-variant px-4 py-2.5 text-left text-body-large text-on-surface outline-none transition-colors hover:bg-on-surface/8 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
                  @click="popNav"
                >
                  <MIcon name="chevron_left" :size="20" class="shrink-0 text-on-surface-variant" />
                  <MIcon v-if="currentNav.icon" :name="currentNav.icon" :size="20" class="shrink-0 text-on-surface-variant" />
                  <span class="flex-1 truncate"><component :is="() => currentNav?.header?.()" /></span>
                </button>
                <component :is="() => currentNav?.content?.()" />
              </div>
              <div v-else key="root">
                <div v-if="isGrouped" class="flex flex-col gap-1 px-1.5">
                  <div v-for="(group, i) in groups" :key="i" class="rounded-lg shadow-elevation-2">
                    <div class="overflow-hidden rounded-lg bg-surface-container">
                      <component :is="() => group" />
                    </div>
                  </div>
                </div>
                <slot v-else :close="close" />
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
