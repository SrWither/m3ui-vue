<script setup lang="ts">
import { computed, Fragment, inject, nextTick, onMounted, onUnmounted, provide, ref, useSlots, watch, type VNode } from 'vue'
import MIcon from './MIcon.vue'
import MMenuDivider from './MMenuDivider.vue'

const props = withDefaults(
  defineProps<{
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
  { submenuMode: 'flyout', variant: 'standard' },
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

// See MMenu.vue for the same mechanism: splits the default slot's content
// into groups at each `<MMenuDivider gap />`, for the 'expressive' variant's
// independently-rounded group boxes.
const groups = computed(() => {
  if (props.variant !== 'expressive') return null
  const raw = flattenVNodes((slots.default?.() ?? []) as VNode[])
  const result: VNode[][] = [[]]
  for (const vnode of raw) {
    if (isGapDivider(vnode)) result.push([])
    else result[result.length - 1]!.push(vnode)
  }
  return result.filter(g => g.length > 0)
})
const isGrouped = computed(() => !!groups.value && groups.value.length > 1)

const visible = ref(false)
const adjustedPos = ref({ x: 0, y: 0 })
const panelEl = ref<HTMLElement | null>(null)

// See MMenu.vue for why this is needed: a menu nested inside another
// MMenu/MContextMenu's slot Teleports to <body> independently, so the
// ancestor's outside-click check needs a shared registry of open panel
// elements (across the logical component tree, not the DOM tree) instead of
// checking only its own panel.
const panelRegistry = inject<Set<HTMLElement>>('m-menu-panel-registry', new Set())
provide('m-menu-panel-registry', panelRegistry)

watch(panelEl, (el, oldEl) => {
  if (oldEl) panelRegistry.delete(oldEl)
  if (el) panelRegistry.add(el)
})

onUnmounted(() => {
  if (panelEl.value) panelRegistry.delete(panelEl.value)
})

// See MMenu.vue for why this is separate from panelRegistry: keeps at most
// one of this menu's *direct* siblings-under-the-same-parent open at a time.
const siblingGroup = inject<{ current: (() => void) | null } | null>('m-menu-sibling-group', null)
provide('m-menu-sibling-group', { current: null })

type NavEntry = { icon?: string, header?: () => any, content?: () => any }
const navStack = ref<NavEntry[]>([])
const currentNav = computed(() => navStack.value[navStack.value.length - 1])
const navDirection = ref<'forward' | 'backward'>('forward')

// See MMenu.vue: driven by the Web Animations API rather than Vue's
// CSS-class transition hooks, which never reliably completed here with
// dynamic (direction-dependent) enter/leave classes on a mode-less Transition.
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

// See MMenu.vue: the real Menu.kt animates the panel's scale/alpha with
// actual springs (StandardMotionTokens: scale dampingRatio 0.9/stiffness
// 1400, alpha dampingRatio 1.0/stiffness 3800), not a duration+easing tween.
// Running close as its own forward spring toward the reversed targets isn't
// right either — alpha (stiffness 3800) settles much faster than scale
// (stiffness 1400), so the panel fades to invisible before it finishes
// shrinking and you never see the shrink. Close needs to be the literal
// time-reverse of open instead: simulated once (open direction only) and
// played back forwards for enter, backwards for leave.
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
  nextTick(() => focusableItems()[0]?.focus())
}

function popNav() {
  navDirection.value = 'backward'
  navStack.value.pop()
  nextTick(() => focusableItems()[0]?.focus())
}

async function showAt(x: number, y: number) {
  if (siblingGroup && siblingGroup.current && siblingGroup.current !== hide) {
    siblingGroup.current()
  }
  if (siblingGroup) siblingGroup.current = hide
  adjustedPos.value = { x, y }
  navStack.value = []
  visible.value = true
  await nextTick()
  if (!panelEl.value) return
  const el = panelEl.value
  adjustedPos.value = {
    x: Math.min(x, window.innerWidth - el.offsetWidth - 8),
    y: Math.min(y, window.innerHeight - el.offsetHeight - 8),
  }
  focusableItems()[0]?.focus()
}

function focusableItems() {
  if (!panelEl.value) return []
  return Array.from(
    panelEl.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
  )
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

function show(e: MouseEvent) {
  e.preventDefault()
  showAt(e.clientX, e.clientY)
}

function hide() {
  if (siblingGroup?.current === hide) siblingGroup.current = null
  visible.value = false
}

provide('m-menu-close', hide)
provide('m-menu-nav', { mode: props.submenuMode, push: pushNav })
defineExpose({ show, showAt, hide })

function onDocMouseDown(e: MouseEvent) {
  if (!visible.value) return
  const t = e.target as Node
  for (const panel of panelRegistry) {
    if (panel.contains(t)) return
  }
  if ((t as Element).closest?.('.m3-submenu')) return
  hide()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (navStack.value.length) popNav()
    else hide()
    return
  }
  if (!visible.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
}

function onScroll() {
  if (visible.value) hide()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll, true)
  cancelActive?.()
})
</script>

<template>
  <div @contextmenu="show">
    <slot name="trigger" />
  </div>

  <Teleport to="body">
    <Transition :css="false" @enter="panelEnter" @leave="panelLeave">
      <div
        v-if="visible"
        ref="panelEl"
        class="fixed z-[500] min-w-48"
        :class="[
          variant === 'expressive' ? 'rounded-lg' : 'rounded-xs',
          isGrouped ? '' : 'shadow-elevation-2',
        ]"
        :style="{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px`, transformOrigin: 'top left' }"
        @contextmenu.prevent
      >
        <!-- overflow-hidden (for the rounded-corner clip and to clip the push
             submenu's slide) lives on this inner wrapper, never together with
             shadow-elevation-2 on the same box — overflow-hidden clips an
             element's own box-shadow too, so the two have to be on separate
             elements or the shadow gets cut off -->
        <div
          class="overflow-hidden py-1"
          :class="[
            variant === 'expressive' ? 'rounded-lg' : 'rounded-xs',
            isGrouped ? '' : 'bg-surface-container',
          ]"
        >
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
              <slot v-else />
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
