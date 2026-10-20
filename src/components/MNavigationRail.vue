<script setup lang="ts">
/**
 * Compact vertical navigation for desktop/tablet layouts with a pill indicator, an optional wide "expanded"
 * state, and an optional modal (flyout) variant.
 *
 * @slot fab A FAB (or MFabMenu) at the top of the rail, above the items.
 * @event update:modelValue Emitted when an item is clicked — powers v-model
 * @event update:expanded Emitted when the modal panel closes (modal mode only) — pair with :expanded for
 *   v-model:expanded. With `hideOnCollapse`, swiping the panel away closes it too
 */
import { computed, ref, watch, onUnmounted } from 'vue'
import MIcon from './MIcon.vue'
import MBadge from './MBadge.vue'
import { useItemLink, type ItemLink } from '../composables/_useItemLink'
import { sampleSpring, sampleAt, playSamples, prefersReducedMotion } from '../composables/_springAnimation'
import { useScrollLock } from '../composables/_useScrollLock'

export interface NavRailItem {
  value: string | number
  label: string
  icon: string
  badge?: number
  badgeDot?: boolean
  disabled?: boolean
  /** Makes the item a link: a vue-router location (rendered as RouterLink), or a URL without vue-router. */
  to?: ItemLink
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Active item value, v-model */
  modelValue: string | number
  /** Array of rail items (see `NavRailItem`) */
  items: NavRailItem[]
  /** Vertical alignment of items within the rail */
  alignment?: 'top' | 'center' | 'bottom'
  /**
   * Widens the rail (220px) and shows each item's icon beside its label in a full-width pill, instead of the icon
   * over the label. Toggle it from your own menu button.
   */
  // M3 `WideNavigationRail`'s expanded state: items become icon+label side by side in a full-width pill instead of icon-over-label in a narrow centered one.
  expanded?: boolean
  /**
   * Keeps the rail collapsed and opens the expanded rail as a panel over the app, with a scrim, instead of
   * widening in place. It closes on a scrim click, Escape or picking an item, emitting `update:expanded`.
   */
  // M3 `ModalWideNavigationRail` (default `hideOnCollapse = false` variant — not the
  // dismissible, slide-from-offscreen one). Instead of this rail itself resizing between
  // collapsed/expanded, the collapsed rail stays on screen exactly as-is (so it never
  // affects the app's layout grid — `ModalWideNavigationRail`'s whole point) and `expanded`
  // instead opens a Teleported, scrim-backed panel that floats above the rest of the app.
  modal?: boolean
  /**
   * With `modal`: no collapsed rail on screen; the expanded rail slides in from off-screen and can be swiped
   * away (Compose's `hideOnCollapse`). Open it from your own menu button
   */
  hideOnCollapse?: boolean
}>(), { alignment: 'top', expanded: false, modal: false, hideOnCollapse: false })

const emit = defineEmits<{
  'update:modelValue': [string | number]
  'update:expanded': [boolean]
}>()

// The inline rail never itself expands in modal mode — see `modal` prop doc above.
const railExpanded = computed(() => !props.modal && props.expanded)

/*
 * The modal panel's items animate through the exact same collapsed->expanded item
 * transition as the non-modal rail (pill grows, label slides out from under the icon) —
 * NOT pre-rendered already-expanded and just revealed by the panel's width wipe. Since the
 * panel only exists in the DOM while `expanded` is true (v-if), binding items directly to
 * `expanded` would have them mount already in their expanded state with nothing to
 * transition from. `panelExpanded` starts false on every mount and flips true a couple
 * frames later (see onPanelEnter) so the item-level CSS transition actually has a
 * collapsed -> expanded change to animate, running alongside (not instead of) the panel's
 * own width spring.
 */
const itemLink = useItemLink()

const panelExpanded = ref(false)

function close() {
  emit('update:expanded', false)
}
function selectModal(item: NavRailItem) {
  if (item.disabled) return
  emit('update:modelValue', item.value)
  close()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

/*
 * Modal panel open/close: a real width spring (rAF + semi-implicit Euler), not a CSS
 * transition — same convention as MProgressBar/MTabs/etc (see CLAUDE.md). Values are
 * `MotionSchemeKeyTokens.FastSpatial` (Standard scheme: dampingRatio 0.9, stiffness 1400 —
 * `WideNavigationRailLayout` uses this exact token for the modal variant's width animation,
 * vs `DefaultSpatial` for the non-modal inline rail). damping 0.9 is just underdamped enough
 * to produce the slight overshoot/bounce M3's modal rail has on open, which a CSS easing
 * curve can't reproduce (it can't overshoot past its own end value and settle back).
 * The panel wipes from 0 to its full width like a curtain reveal — content is already laid
 * out at full (expanded) size and is simply clipped by the panel's own `overflow-hidden`
 * width, rather than each item's pill separately animating like the non-modal rail's does.
 */
const PANEL_WIDTH = 220
const SPRING_DAMPING = 0.9
const SPRING_STIFFNESS = 1400
// The dismissible (hideOnCollapse) panel slides instead: ModalWideNavigationRailState's DefaultSpatial
const SLIDE_DAMPING = 0.9
const SLIDE_STIFFNESS = 700

// Guards against two overlapping spring loops fighting over the same element's
// `style.width` (e.g. a close fired before a still-running open settles) — each call gets
// a token, and a loop quietly stops as soon as a newer call supersedes it instead of
// continuing to write stale values.
const springTokens = new WeakMap<HTMLElement, number>()

function springWidth(el: HTMLElement, from: number, to: number, done?: () => void) {
  springValue(el, from, to, (v) => { el.style.width = `${v}px` }, SPRING_STIFFNESS, SPRING_DAMPING, 0, done)
}

function springValue(
  el: HTMLElement,
  from: number,
  to: number,
  apply: (v: number) => void,
  stiffness: number,
  damping: number,
  initialVelocity: number,
  done?: () => void,
) {
  const token = (springTokens.get(el) ?? 0) + 1
  springTokens.set(el, token)
  let pos = from
  let vel = initialVelocity
  let last = performance.now()
  const start = last
  apply(from)
  function finish() {
    apply(to)
    done?.()
  }
  function tick(now: number) {
    if (springTokens.get(el) !== token) return
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const accel = -stiffness * (pos - to) - 2 * damping * Math.sqrt(stiffness) * vel
    vel += accel * dt
    pos += vel * dt
    apply(pos)
    // Settled normally, or a safety net in case rAF stalls/throttles badly enough that the
    // spring can't converge in reasonable real time (e.g. a backgrounded tab) — either way
    // the panel must never get stuck mid-animation forever.
    if ((Math.abs(pos - to) < 0.5 && Math.abs(vel) < 5) || now - start > 1000) {
      finish()
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ── Dismissible panel (hideOnCollapse): slide + swipe ─────────────────────────────────────────
// The panel's x runs from -1 (off-screen, a fraction of its width) to 0, and the scrim's opacity follows it.
// Slides play as Web Animations (see _springAnimation.ts), on the compositor, so the open isn't janked by the
// panel mounting at the same moment; only the drag writes the transform directly.
let panelX = 0
let releaseVelocity = 0
let slideAnim: Animation | null = null
let slideScrimAnim: Animation | null = null
let slideSamples: number[] = []
let slidePanel: HTMLElement | null = null
let slideScrim: HTMLElement | null = null
let slideDone: (() => void) | null = null

function setSlide(panel: HTMLElement, scrim: HTMLElement | null, x: number) {
  panelX = x
  panel.style.transform = `translateX(${x * 100}%)`
  if (scrim) scrim.style.opacity = String(Math.min(1, Math.max(0, 1 + x)))
}

// Freezes the panel where the running slide has it
function stopSlide() {
  if (!slideAnim) return
  if (slidePanel) setSlide(slidePanel, slideScrim, sampleAt(slideSamples, slideAnim.currentTime))
  slideAnim.cancel()
  slideScrimAnim?.cancel()
  slideAnim = slideScrimAnim = null
}

function finishSlide() {
  const cb = slideDone
  slideDone = null
  cb?.()
}

// Without `done`, a pending Transition callback (an enter interrupted by a swipe) is kept for this slide
function slide(el: Element, to: number, done?: () => void) {
  const panel = (el as HTMLElement).querySelector<HTMLElement>('.wnr-panel')
  const scrim = (el as HTMLElement).querySelector<HTMLElement>('.wnr-scrim')
  if (done) {
    finishSlide()
    slideDone = done
  }
  if (!panel) return finishSlide()
  if (scrim) scrim.style.transition = 'none'
  stopSlide()
  const from = panelX
  const v = releaseVelocity
  releaseVelocity = 0
  // The end state goes inline underneath, so nothing jumps when the animation ends
  setSlide(panel, scrim, to)
  if (prefersReducedMotion() || from === to) return finishSlide()
  slideSamples = sampleSpring(from, to, v, { dampingRatio: SLIDE_DAMPING, stiffness: SLIDE_STIFFNESS }, 0.001)
  const a = playSamples(panel, slideSamples, (x) => ({ transform: `translateX(${x * 100}%)` }))
  if (!a) return finishSlide()
  slideScrimAnim = playSamples(scrim, slideSamples, (x) => ({ opacity: String(Math.min(1, Math.max(0, 1 + x))) }))
  slideAnim = a
  slidePanel = panel
  slideScrim = scrim
  a.onfinish = () => {
    if (slideAnim !== a) return
    slideAnim = slideScrimAnim = null
    finishSlide()
  }
}

// AnchoredDraggableDefaults: settles at the nearer anchor (positionalThreshold 50%) unless released faster
// than 125dp/s, which goes the way of the fling
const FLING_VELOCITY = 125
let drag: { id: number; x: number; y: number; startX: number; width: number; active: boolean; samples: { t: number; x: number }[] } | null = null
let suppressClick = false

function onPanelPointerDown(e: PointerEvent) {
  if (!props.hideOnCollapse || e.button !== 0) return
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: 0, width: 1, active: false, samples: [{ t: e.timeStamp, x: e.clientX }] }
}

function onPanelPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (!drag.active) {
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = null; return }
    if (Math.abs(dx) < 8) return
    drag.active = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    // Stop a running slide; the finger owns the panel from where it is
    stopSlide()
    drag.startX = panelX
    drag.width = (e.currentTarget as HTMLElement).offsetWidth || PANEL_WIDTH
  }
  const panel = e.currentTarget as HTMLElement
  const scrim = panel.parentElement?.querySelector<HTMLElement>('.wnr-scrim') ?? null
  if (scrim) scrim.style.transition = 'none'
  setSlide(panel, scrim, Math.min(0, Math.max(-1, drag.startX + dx / drag.width)))
  drag.samples.push({ t: e.timeStamp, x: e.clientX })
  drag.samples = drag.samples.filter((p) => e.timeStamp - p.t < 100)
}

function onPanelPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const wasActive = drag.active
  const first = drag.samples[0]!
  const lastSample = drag.samples[drag.samples.length - 1]!
  const dt = (lastSample.t - first.t) / 1000
  const velocity = dt > 0 ? (lastSample.x - first.x) / dt : 0
  const width = drag.width
  drag = null
  if (!wasActive) return
  suppressClick = true
  setTimeout(() => { suppressClick = false })
  const panel = e.currentTarget as HTMLElement
  const dismiss = Math.abs(velocity) > FLING_VELOCITY ? velocity < 0 : panelX < -0.5
  releaseVelocity = velocity / width
  if (dismiss) close()
  else slide(panel.parentElement!, 0)
}

// Belt and braces once a swipe has started: the browser must not scroll or navigate with it
function onPanelTouchMove(e: TouchEvent) {
  if (drag?.active && e.cancelable) e.preventDefault()
}

function onPanelClickCapture(e: MouseEvent) {
  if (!suppressClick) return
  e.preventDefault()
  e.stopPropagation()
}

function onPanelEnter(el: Element, done: () => void) {
  if (props.hideOnCollapse) {
    // Standalone modal: the items are expanded from the start, the panel slides in from off-screen
    panelExpanded.value = true
    // Reopened mid-close: the old panel goes now
    finishSlide()
    slideAnim?.cancel()
    slideScrimAnim?.cancel()
    slideAnim = slideScrimAnim = null
    const panel = (el as HTMLElement).querySelector<HTMLElement>('.wnr-panel')
    const scrim = (el as HTMLElement).querySelector<HTMLElement>('.wnr-scrim')
    if (panel) setSlide(panel, scrim, -1)
    slide(el, 0, done)
    return
  }
  const panel = (el as HTMLElement).querySelector<HTMLElement>('.wnr-panel')
  const scrim = (el as HTMLElement).querySelector<HTMLElement>('.wnr-scrim')
  panelExpanded.value = false
  if (scrim) {
    scrim.style.opacity = '0'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrim.style.opacity = '1'
      panelExpanded.value = true
    }))
  } else {
    panelExpanded.value = true
  }
  if (panel) springWidth(panel, 0, PANEL_WIDTH, done)
  else done()
}
function onPanelLeave(el: Element, done: () => void) {
  if (props.hideOnCollapse) {
    slide(el, -1, done)
    return
  }
  const panel = (el as HTMLElement).querySelector<HTMLElement>('.wnr-panel')
  const scrim = (el as HTMLElement).querySelector<HTMLElement>('.wnr-scrim')
  panelExpanded.value = false
  if (scrim) scrim.style.opacity = '0'
  if (panel) springWidth(panel, PANEL_WIDTH, 0, done)
  else done()
}

watch(
  () => props.modal && props.expanded,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  slideAnim?.cancel()
  slideScrimAnim?.cancel()
  document.removeEventListener('keydown', onKeydown)
})
useScrollLock(() => props.modal && props.expanded)
</script>

<template>
  <!--
    Inline rail: stays collapsed and in-flow at all times when `modal` is true — the real
    ModalWideNavigationRail's collapsed rail is never affected by the modal panel opening,
    so this half of the template intentionally reads `railExpanded` (forced false under
    `modal`), not the raw `expanded` prop. The Teleported modal panel below is the part
    that actually reacts to `expanded` when `modal` is set.
  -->
  <nav
    v-if="!(modal && hideOnCollapse)"
    v-bind="$attrs"
    class="flex h-full flex-col border-r border-outline-variant bg-surface transition-[width] duration-200"
    :class="railExpanded ? 'w-[220px]' : 'w-20'"
  >
    <!--
      Header slot: menu-toggle button and/or FAB. Left-anchored (not `items-center`) inside
      a fixed 56px box, same technique as MNavigationDrawer's `.nd-toggle-inner` — `items-center`
      would re-center against the *header's own* width, which changes a lot between collapsed
      (80px rail) and expanded (220px rail), making the button visibly jump sideways when toggling.
      A fixed-width box pinned to the same left inset as the items below stays put regardless.
      The box is a *minimum* (40×56, an icon button or small FAB): a regular FAB (56dp) or an
      extended one in the expanded rail grows it instead of overflowing it, which used to push
      the FAB past the rail's top and left edges.
    -->
    <div v-if="$slots.fab" class="flex shrink-0 flex-col items-start gap-2 px-3 pt-3 pb-2">
      <div class="flex min-h-10 min-w-14 shrink-0 items-center justify-center">
        <slot name="fab" />
      </div>
    </div>

    <!-- Items -->
    <div
      class="flex flex-1 flex-col gap-1 px-3 py-3"
      :class="{
        'justify-start': alignment === 'top',
        'justify-center': alignment === 'center',
        'justify-end': alignment === 'bottom',
      }"
    >
      <component
        :is="itemLink(item).tag"
        v-for="item in items"
        :key="item.value"
        v-bind="itemLink(item).attrs"
        class="group relative block h-16 w-full cursor-pointer focus-visible:outline-none"
        :class="item.disabled ? 'cursor-not-allowed opacity-[0.38]' : ''"
        @click="!item.disabled && $emit('update:modelValue', item.value)"
      >
        <!--
          Row height is a constant 64dp (NavigationRailBaselineItemTokens.ContainerHeight)
          in BOTH modes so toggling `expanded` never reflows sibling items — only the pill
          and label (below) resize/reposition *within* that fixed-height row.

          The pill's own top/height offsets always use fixed pixel values (top-1.5/h-8 vs
          top-1/h-14), never percentage-based centering (top-1/2 + -translate-y-1/2) — that
          resolves relative to the element's OWN size, which is also mid-transition, so mixing
          it with an animating height makes the icon appear to snap to a center point and drift
          as the box resizes, instead of a single clean interpolation.

          Expanded width is intentionally NOT `w-full`: NavigationRailBaselineItemTokens'
          ActiveIndicatorLeadingSpace/ActiveIndicatorTrailingSpace are 16dp each (pl-4/pr-4
          below) around icon+label, not a bar stretched to the rail's own width — the pill is
          meant to hug its content, leaving empty space in the rail after a short label like
          "Home", exactly like the real WideNavigationRailItem. Nesting the label INSIDE the
          pill (rather than a separately absolutely-positioned span) is what makes that
          hugging automatic: as the label's own overflow-hidden box animates its width from 0,
          the pill (inline-flex, no explicit width) resizes right along with it via ordinary
          flex layout — no separate width bookkeeping needed. The pill is always left-anchored
          with a constant `pl-4`, so the icon's horizontal position never moves at all.

          The pill NEVER gets an explicit width, collapsed included: collapsed it's
          pl-4 + 24px icon + pr-4 + a 0-wide label = exactly 56dp, the same as the old `w-14`.
          Switching `auto` <-> `w-14` can't be transitioned (auto isn't interpolable), so on
          collapse the pill snapped to 56px on the first frame and flex-shrink squeezed the
          still-visible label to 0, which then regrew a few px before clipping away — the
          label visibly vanished and popped back. Keeping width content-driven in both
          states means it only ever follows the label's own animated width.
        -->
        <span
          class="absolute left-0 inline-flex items-center pl-4 pr-4 rounded-full transition-all duration-200"
          :class="[
            railExpanded ? 'top-1 h-14' : 'top-1.5 h-8',
            item.value === modelValue
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-transparent text-on-surface-variant group-hover:bg-on-surface/8',
          ]"
        >
          <MBadge v-if="item.badge != null" :count="item.badge">
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MBadge v-else-if="item.badgeDot" dot>
            <MIcon :name="item.icon" :size="24" />
          </MBadge>
          <MIcon v-else :name="item.icon" :size="24" />

          <!--
            Label, expanded: revealed through an `overflow-hidden` box whose width (and
            margin, so it doesn't leave a gap when collapsed) grows left-to-right out of the
            icon's edge, so the text reads as emerging out of the icon rather than fading in
            in place. Text itself never moves — only the clipping box's width animates.
            The width animates via a one-column grid, `grid-template-columns: 0fr <-> 1fr`
            (the inner span is `min-w-0 overflow-hidden`), which interpolates straight to the
            label's own intrinsic width. Earlier versions used `width` (fixed end value, every
            pill stopped at the same 130px regardless of text) and then `max-width: 0 <-> 200px`
            (hugged the text, but since 200px is far past a label like "Home" (~38px), most of
            the transition changed nothing visible and the real shrink was crammed into its
            last few frames). `whitespace-nowrap` keeps the text from reflowing. Opacity animates
            alongside it so collapsing reads as fading out while it shrinks, rather than
            staying solid until the box clips it. Its own text color intentionally differs from
            the pill's (`text-secondary` vs the pill's `text-on-secondary-container`) — M3's
            `ItemActiveLabelTextColor` is a different token from `ItemActiveIconColor`.
          -->
          <span
            class="grid transition-[grid-template-columns,opacity,margin-left] duration-200"
            :class="railExpanded ? 'ml-2 grid-cols-[1fr] opacity-100' : 'ml-0 grid-cols-[0fr] opacity-0'"
          >
            <span
              class="min-w-0 overflow-hidden whitespace-nowrap text-left text-label-large font-medium"
              :class="item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant'"
            >
              {{ item.label }}
            </span>
          </span>
        </span>

        <!-- Label, collapsed: stays put below the icon, just fades out when expanding -->
        <span
          class="pointer-events-none absolute left-0 top-[42px] w-14 truncate text-center text-label-medium font-medium transition-opacity duration-150"
          :class="[
            railExpanded ? 'opacity-0' : 'opacity-100',
            item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
          ]"
        >
          {{ item.label }}
        </span>
      </component>
    </div>
  </nav>

  <!--
    Modal panel: ModalWideNavigationRail's expanded state (default hideOnCollapse=false
    variant). Floats above the app with its own scrim — `NavigationRailExpandedTokens`:
    ModalContainerColor = surface-container, ModalContainerElevation = Level2. Flush against
    the screen edge (`inset-y-0 left-0`), same as the collapsed rail and MNavigationDrawer —
    confirmed against the real M3 demo app/reference video, not floating with a margin as an
    earlier version of this comment assumed from the token name alone. Only the far (right)
    corners are rounded (`rounded-r-lg`): rounding the near/screen-edge corners too would be
    invisible anyway since they're flush against the viewport edge. Item markup below is
    intentionally a near-duplicate of the inline rail's (see the top-of-file "not DRY" note
    in CLAUDE.md for pickers/modals) — check here too if fixing a pill/label bug above.
  -->
  <Teleport v-if="modal" to="body">
    <Transition :css="false" @enter="onPanelEnter" @leave="onPanelLeave">
      <div v-if="expanded" class="fixed inset-0 z-100" @keydown.escape="close">
        <div class="wnr-scrim absolute inset-0 bg-scrim/32" @click="close" />

        <nav
          class="wnr-panel fixed inset-y-0 left-0 z-10 flex flex-col overflow-hidden rounded-r-lg bg-surface-container shadow-elevation-2"
          :class="hideOnCollapse ? 'w-[220px] touch-pan-y' : ''"
          @pointerdown="onPanelPointerDown"
          @pointermove="onPanelPointerMove"
          @pointerup="onPanelPointerUp"
          @pointercancel="onPanelPointerUp"
          @touchmove="onPanelTouchMove"
          @click.capture="onPanelClickCapture"
        >
          <div v-if="$slots.fab" class="flex shrink-0 flex-col items-start gap-2 px-3 pt-3 pb-2">
            <div class="flex min-h-10 min-w-14 shrink-0 items-center justify-center">
              <slot name="fab" />
            </div>
          </div>

          <!-- touch-action stops at the nearest scroll container, so this one needs pan-y of its own or a
               finger landing on an item lets the browser take the horizontal swipe -->
          <div
            class="scrollbar-none flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
            :class="{
              'touch-pan-y': hideOnCollapse,
              'justify-start': alignment === 'top',
              'justify-center': alignment === 'center',
              'justify-end': alignment === 'bottom',
            }"
          >
            <!--
              Items animate collapsed -> expanded exactly like the inline rail's (see the
              comment on that block above) driven by `panelExpanded` instead of
              `railExpanded` — see the `panelExpanded` doc in <script> for why the panel
              can't just bind to `expanded` directly. Keep any pill/label fix in sync
              between the two copies.
            -->
            <component
              :is="itemLink(item).tag"
              v-for="item in items"
              :key="item.value"
              v-bind="itemLink(item).attrs"
              class="group relative block h-16 w-full shrink-0 cursor-pointer focus-visible:outline-none"
              :class="item.disabled ? 'cursor-not-allowed opacity-[0.38]' : ''"
              @click="selectModal(item)"
            >
              <span
                class="absolute left-0 inline-flex items-center pl-4 pr-4 rounded-full transition-all duration-200"
                :class="[
                  panelExpanded ? 'top-1 h-14' : 'top-1.5 h-8',
                  item.value === modelValue
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-transparent text-on-surface-variant group-hover:bg-on-surface/8',
                ]"
              >
                <MBadge v-if="item.badge != null" :count="item.badge">
                  <MIcon :name="item.icon" :size="24" />
                </MBadge>
                <MBadge v-else-if="item.badgeDot" dot>
                  <MIcon :name="item.icon" :size="24" />
                </MBadge>
                <MIcon v-else :name="item.icon" :size="24" />

                <span
                  class="grid transition-[grid-template-columns,opacity,margin-left] duration-200"
                  :class="panelExpanded ? 'ml-2 grid-cols-[1fr] opacity-100' : 'ml-0 grid-cols-[0fr] opacity-0'"
                >
                  <span
                    class="min-w-0 overflow-hidden whitespace-nowrap text-left text-label-large font-medium"
                    :class="item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant'"
                  >
                    {{ item.label }}
                  </span>
                </span>
              </span>

              <!-- Label, collapsed: stays put below the icon, just fades out when expanding -->
              <span
                class="pointer-events-none absolute left-0 top-[42px] w-14 truncate text-center text-label-medium font-medium transition-opacity duration-150"
                :class="[
                  panelExpanded ? 'opacity-0' : 'opacity-100',
                  item.value === modelValue ? 'text-secondary' : 'text-on-surface-variant',
                ]"
              >
                {{ item.label }}
              </span>
            </component>
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Panel width is driven entirely by the JS spring in onPanelEnter/onPanelLeave (see
 * <script>) — this is only the scrim's fade, a plain CSS transition since it's a
 * non-spatial color/alpha change (M3's "effects" motion, as opposed to the panel's
 * "spatial" width spring). JS just flips `.wnr-scrim`'s opacity; this rule is what
 * actually animates that change.
 */
.wnr-scrim {
  transition: opacity 220ms ease;
}
</style>
