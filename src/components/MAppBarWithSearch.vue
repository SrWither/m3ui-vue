<script setup lang="ts">
/**
 * A top app bar whose title is a search bar (a port of Compose's `AppBarWithSearch`, and with `transparent` its
 * `TopSearchBar`): a navigation icon, the search bar and actions in one 64px row. The search bar expands like
 * MSearchBar (full screen by default). It can darken as content scrolls under it, and hide while scrolling down.
 *
 * @slot navigation Custom leading area (default: an MIconButton built from the navigationIcon prop)
 * @slot actions Trailing action buttons
 * @slot leading Overrides the search bar's leading icon
 * @slot trailing Trailing content inside the search bar (e.g. an avatar)
 * @slot default Results/suggestions, shown below the input while the search is expanded
 * @event update:modelValue Emitted on every input change — powers v-model
 * @event update:expanded Emitted when the search expands or collapses — powers v-model:expanded
 * @event search Emitted when Enter is pressed in the input, with the current query
 * @event navigation Emitted when the default navigation icon button is clicked
 */
import { onMounted, onUnmounted, provide, ref, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import MSearchBar from './MSearchBar.vue'
import { useLocale } from '../composables/useLocale'
import { DEFAULT_EFFECTS } from '../composables/_useSpring'
import { searchAppBarKey } from '../composables/_searchAppBar'

const props = withDefaults(defineProps<{
  /** Search query (v-model) */
  modelValue?: string
  /** Whether the search is expanded (v-model:expanded) */
  expanded?: boolean
  /** Defaults to the locale's "Search..." */
  placeholder?: string
  /** How the search expands: full screen (default), full screen keeping the pill input, or a docked panel */
  searchVariant?: 'fullscreen' | 'fullscreen-contained' | 'docked'
  /** Icon shown in the collapsed search bar */
  leadingIcon?: string
  /** Shows a spinner in the expanded header instead of the clear button */
  loading?: boolean
  /** Shows a clear (×) button once there is a query */
  clearable?: boolean
  /** Leading icon outside the search bar (e.g. menu, arrow_back) */
  navigationIcon?: string
  /** Accessible label for the navigation icon button; defaults to the locale's "Menu" */
  navigationLabel?: string
  /** No app bar container, only the search bar (Compose's TopSearchBar) */
  transparent?: boolean
  /**
   * How the bar reacts to `scrollTarget` scrolling: `pinned` stays and changes color once content is under
   * it; `enter-always` also hides while scrolling down and comes back on any scroll up. With `enter-always`
   * the bar is sticky over the content: put it at the top of the scrolling element (or of the page)
   */
  scrollBehavior?: 'pinned' | 'enter-always'
  /** What `scrollBehavior` follows: an element or a CSS selector for it. Defaults to the window */
  scrollTarget?: HTMLElement | string | null
}>(), {
  modelValue: '',
  expanded: undefined,
  searchVariant: 'fullscreen',
  leadingIcon: 'search',
  loading: false,
  clearable: true,
  transparent: false,
  scrollTarget: null,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  'update:expanded': [boolean]
  search: [string]
  navigation: []
}>()

const locale = useLocale()

// AppBarWithSearchColors: the app bar goes surface → surface-container (animated, DefaultEffects) and the
// search bar surface-container-high → surface-container-highest once content is under it. A transparent bar
// (TopSearchBar) keeps both.
const scrolled = ref(false)
const searchScrolled = ref(false)
provide(searchAppBarKey, { scrolled: searchScrolled })

// ── enter-always (EnterAlwaysSearchBarScrollBehavior) ───────────────────────────────────────────
// scrollOffset from 0 to -height: the row slides up and the bar's height shrinks with it. As in MTopAppBar
// the bar is sticky and grows its bottom margin as it shrinks, so content scrolls one to one under it.
const barEl = ref<HTMLElement>()
const rowEl = ref<HTMLElement>()
const HEIGHT = 64
let offset = 0
let vel = 0
let snapTarget: number | null = null
let raf = 0
let last = 0
let settleTimer = 0
let lastScroll = 0
let target: HTMLElement | Window | null = null

function write() {
  if (barEl.value) {
    barEl.value.style.height = offset ? `${HEIGHT + offset}px` : ''
    barEl.value.style.marginBottom = offset ? `${-offset}px` : ''
  }
  if (rowEl.value) rowEl.value.style.transform = offset ? `translateY(${offset}px)` : ''
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
  scrolled.value = y > 0 && !props.transparent
  searchScrolled.value = scrolled.value
  if (props.scrollBehavior !== 'enter-always' || !dy) return
  stopSnap()
  offset = Math.min(0, Math.max(-HEIGHT, offset - dy))
  write()
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(settle, 150)
}

// settleSearchBar: half-way snaps to the closer end on DefaultEffects
function settle() {
  if (offset === 0 || offset === -HEIGHT) return
  snapTarget = offset / -HEIGHT < 0.5 ? 0 : -HEIGHT
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
  searchScrolled.value = false
  write()
}

onMounted(attach)
onUnmounted(detach)
watch(() => [props.scrollBehavior, props.scrollTarget, props.transparent], attach)
</script>

<template>
  <header
    ref="barEl"
    class="w-full transition-[background-color] duration-200"
    :class="[
      transparent ? 'bg-transparent' : scrolled ? 'bg-surface-container' : 'bg-surface',
      scrollBehavior ? 'overflow-hidden' : '',
      scrollBehavior === 'enter-always' ? 'sticky top-0 z-10' : '',
    ]"
  >
    <!-- AppBarWithSearch: 4dp outside the navigation icon and the actions; the search bar 8dp from them and
         4dp from the top and bottom (SearchBarAsTopBarPadding, AppBarWithSearchVerticalPadding), at most
         720dp wide and centered -->
    <div ref="rowEl" class="flex h-16 items-center px-1">
      <slot name="navigation">
        <MIconButton
          v-if="navigationIcon"
          :icon="navigationIcon"
          :label="navigationLabel ?? locale.menu"
          style="color: var(--color-on-surface)"
          @click="emit('navigation')"
        />
      </slot>
      <div class="flex min-w-0 flex-1 justify-center px-2 py-1">
        <MSearchBar
          class="max-w-[720px]"
          :model-value="modelValue"
          :expanded="expanded"
          :placeholder="placeholder"
          :variant="searchVariant"
          :leading-icon="leadingIcon"
          :loading="loading"
          :clearable="clearable"
          @update:model-value="emit('update:modelValue', $event)"
          @update:expanded="emit('update:expanded', $event)"
          @search="emit('search', $event)"
        >
          <template v-if="$slots.leading" #leading><slot name="leading" /></template>
          <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
          <slot />
        </MSearchBar>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1" style="color: var(--color-on-surface-variant)">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
