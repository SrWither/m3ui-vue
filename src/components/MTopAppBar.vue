<script setup lang="ts">
/**
 * A top app bar in four M3 layouts — center-aligned, small, medium, and large — with a leading navigation icon
 * and trailing actions. Medium and large can be M3 Expressive's flexible bars (bigger titles, a subtitle), and
 * any of them can react to scrolling: change color, hide, or collapse to the small bar.
 *
 * @slot navigation Custom leading area (default: an MIconButton built from the navigationIcon prop)
 * @slot title Custom title content (default: renders the title prop)
 * @slot subtitle Custom subtitle content (default: renders the subtitle prop)
 * @slot actions Trailing action buttons
 * @event navigation Emitted when the default navigation icon button is clicked (not emitted when the
 *   #navigation slot is overridden — that content is fully custom)
 */
import { computed, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'
import { DEFAULT_EFFECTS } from '../composables/_useSpring'

const props = withDefaults(defineProps<{
  /** App bar title */
  title?: string
  /** A line below the title (Compose's `subtitle`): small, center-aligned and flexible medium/large bars */
  subtitle?: string
  /** 64dp small/center-aligned row, or a 112dp medium / 152dp large two-row layout with the title below */
  variant?: 'center' | 'small' | 'medium' | 'large'
  /**
   * Medium/large only: M3 Expressive's MediumFlexibleTopAppBar / LargeFlexibleTopAppBar, with a
   * headline-medium / display-small title and room for a subtitle (112/136dp and 120/152dp tall)
   */
  flexible?: boolean
  /** Medium/large only: where the title row sits (Compose's `titleHorizontalAlignment`) */
  titleAlignment?: 'start' | 'center'
  /** Leading icon (e.g. menu, arrow_back) */
  navigationIcon?: string
  /** Accessible label for the navigation icon button — defaults to the
   *  locale's generic "Menu" label; override when navigationIcon is
   *  actually a back arrow rather than a drawer toggle. */
  navigationLabel?: string
  /**
   * Swaps both container color (surface → surface-container) and elevation (level 0 → level 2), matching the
   * real M3 on-scroll container tokens rather than just adding a shadow
   */
  elevated?: boolean
  /** Add a bottom border (border-outline-variant) */
  bordered?: boolean
  /**
   * How the bar reacts to `scrollTarget` scrolling (Compose's TopAppBarDefaults scroll behaviors). `pinned`
   * stays put and takes the scrolled container color once the content moves under it; `enter-always` hides
   * (a medium/large bar collapses to the small one) while the content scrolls down and comes back as soon as
   * it scrolls up; `exit-until-collapsed` collapses a medium/large bar as the content scrolls and expands it
   * only back at the top. The last two make the bar sticky over the content: put it at the top of the
   * scrolling element (or of the page)
   */
  scrollBehavior?: 'pinned' | 'enter-always' | 'exit-until-collapsed'
  /** What `scrollBehavior` follows: an element or a CSS selector for it. Defaults to the window */
  scrollTarget?: HTMLElement | string | null
}>(), { variant: 'small', flexible: false, titleAlignment: 'start', scrollTarget: null })

defineEmits<{ navigation: [] }>()

const locale = useLocale()
const slots = useSlots()

const twoRow = computed(() => props.variant === 'medium' || props.variant === 'large')
const hasSubtitle = computed(() => !!(props.subtitle || slots.subtitle))
const COLLAPSED = 64
// AppBarMedium/Large(Flexible)Tokens container heights
const expandedHeight = computed(() => {
  if (!twoRow.value) return COLLAPSED
  if (!props.flexible) return props.variant === 'large' ? 152 : 112
  if (props.variant === 'large') return hasSubtitle.value ? 152 : 120
  return hasSubtitle.value ? 136 : 112
})
const titleClass = computed(() => {
  if (props.variant === 'large') return props.flexible ? 'text-display-small' : 'text-headline-medium'
  return props.flexible ? 'text-headline-medium' : 'text-headline-small'
})
const subtitleClass = computed(() => (props.variant === 'large' ? 'text-title-medium' : 'text-label-large'))

// ── Scroll behaviors ─────────────────────────────────────────────────────────────────────────────
// TopAppBarState: heightOffset from 0 (expanded) to heightOffsetLimit (the bottom row gone for a two-row bar,
// the whole bar for a single row). Compose shrinks the bar in the layout and consumes the scroll first (the
// nested scroll's pre-scroll), so the content doesn't move while the bar collapses. A web page scrolls
// natively, so instead the bar is sticky over the content and, as it shrinks, its bottom margin grows by the
// same amount: it keeps taking its expanded height in the layout, and its bottom edge stays on the content's
// top edge, one-to-one with the finger.
const overlay = computed(() => props.scrollBehavior === 'enter-always' || props.scrollBehavior === 'exit-until-collapsed')
const limit = () => -(twoRow.value ? expandedHeight.value - COLLAPSED : COLLAPSED)

const barEl = ref<HTMLElement>()
const bottomRowEl = ref<HTMLElement>()
const smallTitleEl = ref<HTMLElement>()
const bigTitleEl = ref<HTMLElement>()
const scrolled = ref(false)
const collapsedHalf = ref(false)

let offset = 0
let vel = 0
let snapTarget: number | null = null
let raf = 0
let last = 0
let settleTimer = 0
let lastScroll = 0
let target: HTMLElement | Window | null = null

// TopTitleAlphaEasing = CubicBezierEasing(.8, 0, .8, .15); the container lerps on FastOutLinearInEasing
function bezier(x1: number, y1: number, x2: number, y2: number, t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let u = t
  for (let i = 0; i < 8; i++) {
    const x = 3 * u * (1 - u) ** 2 * x1 + 3 * u ** 2 * (1 - u) * x2 + u ** 3 - t
    const dx = 3 * (1 - u) ** 2 * x1 + 6 * u * (1 - u) * (x2 - x1) + 3 * u ** 2 * (1 - x2)
    if (Math.abs(dx) < 1e-6) break
    u -= x / dx
  }
  return 3 * u * (1 - u) ** 2 * y1 + 3 * u ** 2 * (1 - u) * y2 + u ** 3
}

function write() {
  const f = offset === 0 ? 0 : offset / limit()
  collapsedHalf.value = f >= 0.5
  if (barEl.value) {
    barEl.value.style.height = props.scrollBehavior && offset !== 0 ? `${expandedHeight.value + offset}px` : ''
    barEl.value.style.marginBottom = overlay.value && offset !== 0 ? `${-offset}px` : ''
  }
  if (!twoRow.value) return
  if (bottomRowEl.value) bottomRowEl.value.style.height = `${expandedHeight.value - COLLAPSED + offset}px`
  if (smallTitleEl.value) smallTitleEl.value.style.opacity = String(bezier(0.8, 0, 0.8, 0.15, f))
  if (bigTitleEl.value) bigTitleEl.value.style.opacity = String(1 - f)
  // A two-row bar's container follows the collapse continuously (TwoRowsTopAppBar's colorTransitionFraction)
  if (barEl.value) {
    barEl.value.style.backgroundColor = props.elevated || f === 0
      ? ''
      : `color-mix(in srgb, var(--color-surface-container) ${(bezier(0.4, 0, 1, 1, f) * 100).toFixed(1)}%, var(--color-surface))`
  }
}

const scrollTop = () => (target instanceof Window ? target.scrollY : target?.scrollTop ?? 0)

function stopSnap() {
  cancelAnimationFrame(raf)
  raf = 0
  snapTarget = null
  vel = 0
}

function onScroll() {
  const y = Math.max(0, scrollTop())
  const dy = y - lastScroll
  lastScroll = y
  // SingleRowTopAppBar: the scrolled color as soon as content sits under the bar (overlappedFraction)
  scrolled.value = y > 0
  if (props.scrollBehavior === 'exit-until-collapsed') {
    // Collapses with the content and expands only as the content comes back to its top
    offset = Math.max(limit(), -y)
    write()
    return
  }
  if (props.scrollBehavior !== 'enter-always' || !dy) return
  stopSnap()
  offset = Math.min(0, Math.max(limit(), offset - dy))
  write()
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(settle, 150)
}

// settleAppBar: a bar left half-way snaps to the closer end (TopAppBarDefaults.snapAnimationSpec, DefaultEffects)
function settle() {
  const lim = limit()
  if (offset === 0 || offset === lim) return
  snapTarget = offset / lim < 0.5 ? 0 : lim
  last = performance.now()
  raf = requestAnimationFrame(frame)
}

function frame(now: number) {
  if (snapTarget === null) return
  let dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const k = DEFAULT_EFFECTS.stiffness
  const c = 2 * DEFAULT_EFFECTS.dampingRatio * Math.sqrt(k)
  while (dt > 0) {
    const h = Math.min(dt, 0.004)
    dt -= h
    vel += (-k * (offset - snapTarget) - c * vel) * h
    offset += vel * h
  }
  if (Math.abs(offset - snapTarget) < 0.5 && Math.abs(vel) < 0.5) {
    offset = snapTarget
    write()
    stopSnap()
    return
  }
  write()
  raf = requestAnimationFrame(frame)
}

function resolveTarget(): HTMLElement | Window | null {
  if (typeof window === 'undefined') return null
  if (!props.scrollTarget) return window
  if (typeof props.scrollTarget === 'string') return document.querySelector<HTMLElement>(props.scrollTarget)
  return props.scrollTarget
}

function attach() {
  detach()
  if (!props.scrollBehavior) return
  target = resolveTarget()
  if (!target) return
  lastScroll = Math.max(0, scrollTop())
  target.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

function detach() {
  target?.removeEventListener('scroll', onScroll)
  target = null
  clearTimeout(settleTimer)
  stopSnap()
  offset = 0
  scrolled.value = false
  write()
}

onMounted(() => {
  write()
  attach()
})
onUnmounted(detach)
watch(() => [props.scrollBehavior, props.scrollTarget], attach)
watch(() => [props.variant, props.flexible, hasSubtitle.value], () => {
  offset = Math.min(0, Math.max(limit(), offset))
  write()
}, { flush: 'post' })

// Single row: elevated, or scrolled under while a scroll behavior is set
const scrolledLook = computed(() => props.elevated || (!twoRow.value && scrolled.value))
</script>

<template>
  <!-- Direct children are the rows (consumers target `header > div > button` for the navigation button) -->
  <header
    ref="barEl"
    class="flex w-full flex-col transition-[background-color,box-shadow]"
    :class="[
      // AppBarTokens: ContainerColor=Surface/Elevation=Level0 at rest, but
      // OnScrollContainerColor=SurfaceContainer/OnScrollContainerElevation=Level2 together once
      // scrolled — `elevated` swaps both, not just the shadow. Scrolling only changes the color, as
      // Compose's TopAppBarColors do.
      scrolledLook ? 'bg-surface-container' : 'bg-surface',
      elevated ? 'shadow-elevation-2' : '',
      bordered ? 'border-b border-outline-variant' : '',
      // Clipped only while it can shrink, so nothing that overflows a static bar today gets cut
      scrollBehavior ? 'overflow-hidden' : '',
      overlay ? 'sticky top-0 z-10' : '',
    ]"
  >
    <!-- Top row — 64dp per M3's TopAppBarSmall/collapsed-Medium/collapsed-Large tokens.
         px-2: TopAppBarHorizontalPadding (4dp) + the 4dp IconButton() gets for free from
         Modifier.minimumInteractiveComponentSize() centering its 40dp visible container inside
         a 48dp touch target — MIconButton doesn't implement that invisible expansion, so it's
         folded into this row padding instead to land the icon glyph at the real 16dp inset.
         A single-row bar's row is capped by the (shrinking) bar, keeping its content centered as it hides. -->
    <div class="flex h-16 shrink-0 items-center gap-1 px-2" :class="twoRow ? '' : 'max-h-full'">
      <!-- Navigation -->
      <slot name="navigation">
        <MIconButton
          v-if="navigationIcon"
          :icon="navigationIcon"
          :label="navigationLabel ?? locale.menu"
          style="color: var(--color-on-surface)"
          @click="$emit('navigation')"
        />
      </slot>

      <!-- Title: center or small variant, with an optional subtitle -->
      <div
        v-if="!twoRow"
        class="flex min-w-0 flex-1 flex-col justify-center px-4"
        :class="variant === 'center' ? 'items-center text-center' : ''"
      >
        <h1 class="w-full truncate text-title-large text-on-surface">
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="hasSubtitle" class="w-full truncate text-label-medium text-on-surface-variant">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>

      <!-- Two-row bars: the small title fades in as the bar collapses (TopTitleAlphaEasing) -->
      <div
        v-else
        ref="smallTitleEl"
        class="flex min-w-0 flex-1 flex-col justify-center px-4"
        :class="titleAlignment === 'center' ? 'items-center text-center' : ''"
        style="opacity: 0"
        :aria-hidden="!collapsedHalf || undefined"
      >
        <span class="w-full truncate text-title-large text-on-surface">
          <slot name="title">{{ title }}</slot>
        </span>
        <span v-if="flexible && hasSubtitle" class="w-full truncate text-label-medium text-on-surface-variant">
          <slot name="subtitle">{{ subtitle }}</slot>
        </span>
      </div>

      <!-- Trailing actions -->
      <div v-if="$slots.actions" class="flex items-center gap-1">
        <slot name="actions" />
      </div>
    </div>

    <!-- Large title row for medium/large variants — total container height
         112dp (medium) / 152dp (large) per M3's AppBarMedium/LargeTokens, 112/136dp and 120/152dp for the
         flexible ones (without/with a subtitle). Bottom padding is MediumTitleBottomPadding=24dp /
         LargeTitleBottomPadding=28dp. It shrinks from the top while collapsing, the title anchored to its
         bottom and clipped as it goes. Its height is only ever written by write(): a reactive :style here
         would be re-applied on every re-render and undo the collapse. -->
    <div
      v-if="twoRow"
      ref="bottomRowEl"
      class="flex shrink-0 items-end overflow-hidden px-4"
      :class="[variant === 'large' ? 'pb-7' : 'pb-6', titleAlignment === 'center' ? 'justify-center text-center' : '']"
    >
      <div ref="bigTitleEl" class="min-w-0" :aria-hidden="collapsedHalf || undefined">
        <h1 class="truncate text-on-surface" :class="titleClass">
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="flexible && hasSubtitle" class="truncate text-on-surface-variant" :class="subtitleClass">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
    </div>
  </header>
</template>
