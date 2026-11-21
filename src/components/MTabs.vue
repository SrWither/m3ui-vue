<script setup lang="ts">
/**
 * Switches between different views or content sections. The indicator animates via two independent springs
 * (offset and width), not a CSS transition — see the component source for details.
 *
 * @event update:modelValue Emitted with the value of the tab you picked.
 */
import { computed, nextTick, onMounted, onUnmounted, onUpdated, ref, watch } from 'vue'
import MIcon from './MIcon.vue'

interface Tab {
  value: string | number
  label: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  /** Active tab value (v-model) */
  modelValue: string | number
  /** Tab definitions */
  tabs: Tab[]
  /**
   * Primary: short sliding underline shorter than the tab with a stretch animation. Secondary: full-width
   * underline spanning the entire tab, text-only.
   */
  variant?: 'primary' | 'secondary'
  /** Fixed (default, M3 `TabRow`): tabs evenly share the available width, no scrolling — use for 2-5 tabs. Scrollable (M3 `ScrollableTabRow`): tabs keep their natural width and the row scrolls horizontally when they overflow — use for many tabs. */
  scrollable?: boolean
  /**
   * Where a tab's icon goes: `top`, stacked above the label in a 64px tab (Compose's `Tab`), or `leading`,
   * beside the label in a 48px tab (Compose's `LeadingIconTab`). Defaults to `top` for primary tabs and
   * `leading` for secondary ones.
   */
  iconPosition?: 'top' | 'leading'
}>(), { variant: 'primary', scrollable: false })

const leading = computed(() => (props.iconPosition ?? (props.variant === 'primary' ? 'top' : 'leading')) === 'leading')

const emit = defineEmits<{ 'update:modelValue': [string | number] }>()

const tabEls = ref<HTMLElement[]>([])
const rowEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)
const indicatorLeft = ref(0)
const indicatorWidth = ref(0)

function getTabRect(index: number) {
  const el = tabEls.value[index]
  if (!el) return null
  return { left: el.offsetLeft, width: el.offsetWidth }
}

// Ported from androidx.compose.material3.TabRow's TabIndicatorOffsetNode: the
// offset and width are two *independent* springs (same spec for both — M3's
// DefaultSpatial motion token: dampingRatio 0.9, stiffness 700), not a single
// choreographed "stretch then snap". The stretch look emerges on its own
// from the two springs covering different distances under identical
// physics, and retargeting mid-flight (rapid tab switching) stays smooth
// since velocity carries over — a real spring simulation, not a CSS
// transition, is what makes that possible.
const DAMPING = 0.9
const STIFFNESS = 700
const DAMPING_COEF = 2 * DAMPING * Math.sqrt(STIFFNESS)

let offsetPos = 0, offsetVel = 0, offsetTarget = 0
let widthPos = 0, widthVel = 0, widthTarget = 0
let rafId = 0
let lastTime = 0

function stepSpring(pos: number, vel: number, target: number, dt: number): [number, number] {
  const accel = -STIFFNESS * (pos - target) - DAMPING_COEF * vel
  const newVel = vel + accel * dt
  return [pos + newVel * dt, newVel]
}

function tick(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30)
  lastTime = now
  ;[offsetPos, offsetVel] = stepSpring(offsetPos, offsetVel, offsetTarget, dt)
  ;[widthPos, widthVel] = stepSpring(widthPos, widthVel, widthTarget, dt)
  indicatorLeft.value = offsetPos
  indicatorWidth.value = widthPos

  const settled =
    Math.abs(offsetPos - offsetTarget) < 0.5 && Math.abs(offsetVel) < 0.5 &&
    Math.abs(widthPos - widthTarget) < 0.5 && Math.abs(widthVel) < 0.5
  if (settled) {
    offsetPos = offsetTarget; widthPos = widthTarget
    indicatorLeft.value = offsetPos; indicatorWidth.value = widthPos
    rafId = 0
    return
  }
  rafId = requestAnimationFrame(tick)
}

function ensureRaf() {
  if (rafId) return
  lastTime = performance.now()
  rafId = requestAnimationFrame(tick)
}

// ScrollableTabRow keeps the selected tab in view: on every selection change it
// animates the row's scroll so the tab is centered, clamped to the row's ends
// (Compose's `calculateTabOffset`). Only the row scrolls, never the page, so
// no scrollIntoView.
function scrollToTab(rect: { left: number; width: number }, smooth: boolean) {
  const row = rowEl.value
  if (!props.scrollable || !row) return
  const max = row.scrollWidth - row.clientWidth
  if (max <= 0) return
  const left = Math.round(Math.min(Math.max(rect.left + rect.width / 2 - row.clientWidth / 2, 0), max))
  if (Math.abs(left - row.scrollLeft) < 1) return
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const behavior: ScrollBehavior = smooth && !reduce ? 'smooth' : 'auto'
  if (typeof row.scrollTo === 'function') row.scrollTo({ left, behavior })
  else row.scrollLeft = left
}

// The value whose tab was last brought into view: tabs that arrive after mount
// (loaded async) still get scrolled to once, without a later `:tabs` literal
// re-render pulling the row back from wherever the user scrolled it.
let shownValue: unknown = Symbol('none')

function measureTarget() {
  const idx = props.tabs.findIndex((t) => t.value === props.modelValue)
  const rect = getTabRect(idx)
  if (!rect) return null
  if (props.variant === 'primary') {
    const inset = Math.min(rect.width * 0.2, 16)
    return { rect, offset: rect.left + inset, width: rect.width - inset * 2 }
  }
  return { rect, offset: rect.left, width: rect.width }
}

function snapIndicator() {
  offsetPos = offsetTarget; offsetVel = 0
  widthPos = widthTarget; widthVel = 0
  indicatorLeft.value = offsetPos
  indicatorWidth.value = widthPos
}

function updateIndicator(animate = true, scroll: 'none' | 'instant' | 'smooth' = 'none') {
  nextTick(() => {
    const m = measureTarget()
    if (!m) return
    if (scroll !== 'none') {
      shownValue = props.modelValue
      if (scroll === 'smooth') manualScroll = false
      scrollToTab(m.rect, scroll === 'smooth')
    }
    offsetTarget = m.offset
    widthTarget = m.width
    if (animate) ensureRaf()
    else snapIndicator()
  })
}

// Tabs can change size after mount: a Material Symbols icon is drawn as its
// ligature name ("fact_check") until the font loads, so the tab is far wider
// at first. Re-measure without animation whenever the row or a tab resizes,
// and re-center the active tab unless the user has scrolled the row by hand
// since it was last centered for them.
let manualScroll = false
function markManualScroll() { manualScroll = true }
const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])
function onRowKeydown(e: KeyboardEvent) { if (SCROLL_KEYS.has(e.key)) manualScroll = true }

function relayout() {
  const m = measureTarget()
  if (!m) return
  if (Math.abs(m.offset - offsetTarget) >= 0.5 || Math.abs(m.width - widthTarget) >= 0.5) {
    offsetTarget = m.offset
    widthTarget = m.width
    snapIndicator()
  }
  if (!manualScroll) scrollToTab(m.rect, false)
}

let ro: ResizeObserver | null = null
const observed = new Set<Element>()
const lastSize = new WeakMap<Element, string>()
let listenedRow: HTMLElement | null = null

function onResize(entries: ResizeObserverEntry[]) {
  let changed = false
  for (const e of entries) {
    const key = `${e.contentRect.width}x${e.contentRect.height}`
    // The first notification of every newly observed element only reports
    // its current size: ignore it, so it can't cut short a running animation.
    if (lastSize.has(e.target) && lastSize.get(e.target) !== key) changed = true
    lastSize.set(e.target, key)
  }
  if (changed) relayout()
}

function syncObserved() {
  const row = rowEl.value
  if (row !== listenedRow) {
    listenedRow?.removeEventListener('wheel', markManualScroll)
    listenedRow?.removeEventListener('touchmove', markManualScroll)
    listenedRow?.removeEventListener('keydown', onRowKeydown)
    row?.addEventListener('wheel', markManualScroll, { passive: true })
    row?.addEventListener('touchmove', markManualScroll, { passive: true })
    row?.addEventListener('keydown', onRowKeydown)
    listenedRow = row
  }
  if (!ro) return
  const want = new Set<Element>()
  if (row) want.add(row)
  if (contentEl.value) for (const el of contentEl.value.querySelectorAll(':scope > button')) want.add(el)
  for (const el of observed) if (!want.has(el)) { ro.unobserve(el); observed.delete(el) }
  for (const el of want) if (!observed.has(el)) { ro.observe(el); observed.add(el) }
}

let mounted = false
onMounted(() => {
  mounted = true
  updateIndicator(false, 'instant')
  if (typeof ResizeObserver !== 'undefined') ro = new ResizeObserver(onResize)
  syncObserved()
  // Fallback for browsers or layouts where the font swap doesn't resize an
  // observed box (and for the first paint before the observer reports).
  document.fonts?.ready.then(() => { if (mounted) relayout() })
})
onUpdated(syncObserved)
onUnmounted(() => {
  mounted = false
  if (rafId) cancelAnimationFrame(rafId)
  ro?.disconnect(); ro = null; observed.clear()
  listenedRow?.removeEventListener('wheel', markManualScroll)
  listenedRow?.removeEventListener('touchmove', markManualScroll)
  listenedRow?.removeEventListener('keydown', onRowKeydown)
  listenedRow = null
})
watch(() => props.modelValue, () => updateIndicator(true, 'smooth'))
// Animated (not a hard snap) here too: a consumer passing an inline `:tabs="[...]"`
// literal gets a brand-new array reference on every unrelated parent re-render,
// which would otherwise race with — and instantly override — an in-flight
// modelValue-triggered animation. Re-running the same animated update is a
// no-op when the target hasn't actually moved, so this is safe either way.
watch(() => props.tabs, () => updateIndicator(true, shownValue === props.modelValue ? 'none' : 'instant'), { deep: true })
watch(leading, () => updateIndicator(true))

function select(tab: Tab) {
  if (!tab.disabled) emit('update:modelValue', tab.value)
}
</script>

<template>
  <!-- ── Primary: sliding short indicator with stretch ──────────────── -->
  <div v-if="variant === 'primary'" class="border-b border-outline-variant">
    <div ref="rowEl" :class="scrollable ? 'overflow-x-auto' : 'overflow-x-hidden'" style="scrollbar-width: none">
      <!-- Content-width box: clips the indicator so it never widens the scroll area -->
      <div ref="contentEl" class="relative flex overflow-hidden" :class="scrollable ? 'w-max min-w-full' : 'w-full'">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :ref="(el) => { if (el) tabEls[tabs.indexOf(tab)] = el as HTMLElement }"
          type="button"
          class="relative flex items-center justify-center pb-1.5 text-title-small transition-colors duration-150 focus-visible:outline-none"
          :class="[
            scrollable ? 'shrink-0' : 'flex-1 min-w-0',
            // LeadingIconTab: 48dp row, 16dp side padding, 8dp from the icon to the label
            leading ? 'h-12 flex-row gap-2 px-4' : ['flex-col gap-1 px-6', tab.icon ? 'h-16' : 'h-12'],
            tab.value === modelValue
              ? 'text-primary'
              : tab.disabled
                ? 'cursor-not-allowed text-on-surface/38'
                : 'cursor-pointer text-on-surface-variant hover:text-on-surface',
          ]"
          :disabled="tab.disabled"
          @click="select(tab)"
        >
          <MIcon v-if="tab.icon" :name="tab.icon" :size="24" />
          <span>{{ tab.label }}</span>
        </button>
        <div
          class="absolute bottom-0 h-[3px] rounded-t-full bg-primary"
          :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
        />
      </div>
    </div>
  </div>

  <!-- ── Secondary: full-width underline indicator ─────────────────── -->
  <div v-else class="border-b border-outline-variant">
    <div ref="rowEl" :class="scrollable ? 'overflow-x-auto' : 'overflow-x-hidden'" style="scrollbar-width: none">
      <!-- Content-width box: clips the indicator so it never widens the scroll area -->
      <div ref="contentEl" class="relative flex overflow-hidden" :class="scrollable ? 'w-max min-w-full' : 'w-full'">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :ref="(el) => { if (el) tabEls[tabs.indexOf(tab)] = el as HTMLElement }"
          type="button"
          class="relative flex items-center justify-center text-title-small transition-colors duration-150 focus-visible:outline-none"
          :class="[
            scrollable ? 'shrink-0' : 'flex-1 min-w-0',
            leading ? 'h-12 flex-row gap-2 px-4' : ['flex-col gap-1 px-6', tab.icon ? 'h-16' : 'h-12'],
            tab.value === modelValue
              ? 'text-on-surface'
              : tab.disabled
                ? 'cursor-not-allowed text-on-surface/38'
                : 'cursor-pointer text-on-surface-variant hover:text-on-surface',
          ]"
          :disabled="tab.disabled"
          @click="select(tab)"
        >
          <MIcon v-if="tab.icon" :name="tab.icon" :size="24" />
          <span>{{ tab.label }}</span>
        </button>
        <div
          class="absolute bottom-0 h-[3px] bg-primary"
          :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
        />
      </div>
    </div>
  </div>
</template>
