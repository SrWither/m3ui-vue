<script setup lang="ts">
/**
 * A Floating Action Button for the primary action of a screen. Supports extended (icon+label), a speed-dial of
 * small items, or a fully custom expanding panel via the `#content` slot.
 *
 * @slot content A panel anchored to the FAB that opens when you press it, instead of the `items` speed dial.
 *   `close()` closes it.
 * @event click Emitted when the FAB itself is clicked (not a speed-dial item)
 */
import { computed, inject, onMounted, onUnmounted, ref, useSlots } from 'vue'
import MIcon from './MIcon.vue'
import { vRipple } from '../directives/vRipple'
import { FAST_EFFECTS, FAST_SPATIAL, useSpring } from '../composables/_useSpring'

export interface SpeedDialItem {
  icon: string
  label?: string
  to?: string | Record<string, any>
  onClick?: () => void
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Material Symbol icon name */
    icon: string
    /** Extended FAB label text */
    label?: string
    /**
     * Extended FAB only: false collapses it to a plain FAB (the label fades out and the width shrinks to a
     * square), e.g. while the content scrolls. Compose's `expanded`
     */
    expanded?: boolean
    /** Color scheme; defaults to primary, or secondary inside an MBottomAppBar */
    color?: 'primary' | 'secondary' | 'tertiary' | 'surface'
    /**
     * FAB size. With a `label`, small/medium/large are M3 Expressive's extended FABs (56/80/96px, title-medium,
     * title-large and headline-small labels); regular is the baseline extended FAB
     */
    size?: 'small' | 'regular' | 'medium' | 'large'
    /** Disables interaction */
    disabled?: boolean
    /** Speed-dial child items (see `SpeedDialItem`) */
    items?: SpeedDialItem[]
    /** Speed-dial expand direction */
    direction?: 'up' | 'down' | 'left' | 'right' | 'radial'
    /** Vue Router destination — renders as RouterLink instead of button */
    to?: string | Record<string, any>
    /** Keep speed-dial open after clicking an item or clicking outside */
    persistent?: boolean
    /** For the `up`/`down` #content panel only: which edge it anchors to when
     *  it's wider than the FAB itself. 'start' (default) keeps its left edge
     *  aligned with the FAB's left edge (existing behavior); 'end' aligns the
     *  right edges instead, which keeps a wide panel from running off-screen
     *  when the FAB sits in the bottom-right corner, a common placement. */
    align?: 'start' | 'end'
    /** Dims the rest of the screen behind the #content panel while open (has
     *  no effect on the `items` speed dial). A plain sibling with its own
     *  fade transition, independent of the panel's enter/leave transform, so
     *  it doesn't visually shrink/lag along with it. */
    scrim?: boolean
    /** How the #content panel itself animates open/closed. 'scale' (default)
     *  is the original fade+scale. 'fade' drops the scale — use this when the
     *  slot content already animates its own entrance (e.g. a staggered
     *  per-item reveal), so the panel doesn't *also* scale as a group on top
     *  of that; it still gives Vue a real transition to wait for on close, so
     *  the content's own leave animation has time to play instead of just
     *  vanishing. 'none' skips any panel-level transition entirely. */
    contentTransition?: 'scale' | 'fade' | 'none'
    /** Any CSS color for the press ripple; defaults to the FAB's content color */
    rippleColor?: string
  }>(),
  {
    color: undefined,
    size: 'regular',
    expanded: true,
    disabled: false,
    direction: 'up',
    persistent: false,
    align: 'start',
    scrim: false,
    contentTransition: 'scale',
  },
)

const fabTag = computed(() => props.to ? 'RouterLink' : 'button')

const emit = defineEmits<{ click: [MouseEvent] }>()

const slots = useSlots()
const open = ref(false)
const fabEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()

const hasItems = computed(() => !!props.items?.length)
const hasContent = computed(() => !!slots.content)
const isExpandable = computed(() => hasItems.value || hasContent.value)

// Inside an MBottomAppBar: secondary and flat (bottomAppBarFabColor, bottomAppBarFabElevation)
const inBottomAppBar = inject('m-bottom-app-bar', false)
const color = computed(() => props.color ?? (inBottomAppBar ? 'secondary' : 'primary'))

const colorMap: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  surface: 'bg-surface-container-high text-primary',
}

// Extended FABs (androidx FloatingActionButton.kt). Baseline (`regular`): 16dp start, 12dp icon-to-label,
// 20dp end, 80dp minimum width, labelLarge. Small/Medium/Large (ExtendedFab*Tokens): leading = trailing space,
// minimum width = height, MediumExtendedFabIconPadding/LargeExtendedFabIconPadding (12/16dp, the tokens'
// IconLabelSpace is marked incorrect there).
const EXTENDED = {
  // lead: the box's start padding (its pl-/px- class)
  regular: { px: 56, icon: 24, lead: 16, gap: 'pl-3', box: 'h-14 min-w-20 rounded-2xl pl-4 pr-5', text: 'text-label-large font-medium' },
  small: { px: 56, icon: 24, lead: 16, gap: 'pl-2', box: 'h-14 min-w-14 rounded-2xl px-4', text: 'text-title-medium font-medium' },
  medium: { px: 80, icon: 28, lead: 26, gap: 'pl-3', box: 'h-20 min-w-20 rounded-lg-increased px-[26px]', text: 'text-title-large' },
  large: { px: 96, icon: 32, lead: 28, gap: 'pl-4', box: 'h-24 min-w-24 rounded-xl px-7', text: 'text-headline-small' },
} as const
const extended = computed(() => (props.label ? EXTENDED[props.size] : null))

const fabSizeClasses = computed(() => {
  if (extended.value) return extended.value.box
  switch (props.size) {
    case 'small': return 'h-10 w-10 rounded-md'
    case 'medium': return 'h-20 w-20 rounded-lg-increased'
    case 'large': return 'h-24 w-24 rounded-[28px]'
    default: return 'h-14 w-14 rounded-2xl'
  }
})

const fabIconSize = computed(() => {
  if (extended.value) return extended.value.icon
  switch (props.size) {
    case 'small': return 24
    case 'medium': return 28
    case 'large': return 32
    default: return 24
  }
})

const fabPx = computed(() => {
  if (extended.value) return extended.value.px
  switch (props.size) {
    case 'small': return 40
    case 'medium': return 80
    case 'large': return 96
    default: return 56
  }
})

// Collapsing an extended FAB: the width lerps from the square (the minimum width) to the full width on
// FastSpatial, the label fades on FastEffects, and it leaves the layout once fully collapsed.
// Collapsed, the icon sits centered like a plain FAB's. Compose keeps the start padding instead, which only centers it
// where padding + icon + padding fills the square: the large size's 28 + 32 + 28 leaves it 4dp off center (a
// deliberate departure), so the start padding lerps to the centered one with the width.
const collapsedLead = (e: (typeof EXTENDED)[keyof typeof EXTENDED]) => (e.px - e.icon) / 2
const fabButton = ref<HTMLElement | { $el: HTMLElement }>()
// An extended FAB that starts collapsed renders collapsed (server-side rendering: before the springs below run).
// Constant objects: Vue applies a binding again only when its value changes, so these never undo the springs'
// writes on a later render
const startCollapsed = !!extended.value && !props.expanded
const initialButtonStyle = startCollapsed
  ? {
      width: `${extended.value!.px}px`,
      minWidth: '0',
      ...(collapsedLead(extended.value!) !== extended.value!.lead && { paddingLeft: `${collapsedLead(extended.value!)}px` }),
    }
  : undefined
const initialLabelStyle = startCollapsed ? { display: 'none', opacity: '0' } : undefined
const labelEl = ref<HTMLElement>()
const buttonEl = () => (fabButton.value instanceof HTMLElement ? fabButton.value : fabButton.value?.$el)

useSpring(
  () => (extended.value ? [props.expanded ? 1 : 0] : []),
  ([p]) => {
    const el = buttonEl()
    if (!el || p === undefined || !extended.value) return
    if (labelEl.value) labelEl.value.style.display = p <= 0 && !props.expanded ? 'none' : ''
    el.style.width = ''
    el.style.minWidth = ''
    el.style.paddingLeft = ''
    if (p >= 1 && props.expanded) return
    const full = el.offsetWidth
    const { px: min, lead } = extended.value
    const t = Math.min(1, Math.max(0, p))
    el.style.minWidth = '0'
    el.style.width = `${min + (full - min) * Math.max(0, p)}px`
    const centered = collapsedLead(extended.value)
    if (centered !== lead) el.style.paddingLeft = `${centered + (lead - centered) * t}px`
  },
  FAST_SPATIAL,
)
useSpring(
  () => (extended.value ? [props.expanded ? 1 : 0] : []),
  ([alpha]) => { if (labelEl.value && alpha !== undefined) labelEl.value.style.opacity = String(Math.min(1, Math.max(0, alpha))) },
  FAST_EFFECTS,
)

const ITEM_PX = 40
const ITEM_GAP = 8

function getRect(): DOMRect | null {
  return fabEl.value?.getBoundingClientRect() ?? null
}

function itemStyle(index: number): Record<string, string> {
  const rect = getRect()
  if (!rect) return { position: 'fixed', opacity: '0', pointerEvents: 'none' }

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const count = props.items?.length ?? 0

  const delay = open.value
    ? `${index * 35}ms`
    : `${(count - 1 - index) * 35}ms`
  const transition = `transform 220ms cubic-bezier(0.2,0,0,1) ${delay}, opacity 180ms ease ${delay}`

  if (props.direction === 'radial') {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2
    const r = 80
    const dx = (Math.cos(angle) * r).toFixed(1)
    const dy = (Math.sin(angle) * r).toFixed(1)
    return {
      position: 'fixed',
      top: `${cy - ITEM_PX / 2}px`,
      left: `${cx - ITEM_PX / 2}px`,
      transform: open.value ? `translate(${dx}px, ${dy}px) scale(1)` : 'translate(0,0) scale(0)',
      opacity: open.value ? '1' : '0',
      transition,
      pointerEvents: open.value ? 'auto' : 'none',
      zIndex: '1000',
    }
  }

  const step = ITEM_PX + ITEM_GAP
  const offset = fabPx.value / 2 + ITEM_GAP + ITEM_PX / 2 + index * step

  const posMap: Record<string, { top: string; left: string }> = {
    up:    { top: `${cy - offset - ITEM_PX / 2}px`, left: `${cx - ITEM_PX / 2}px` },
    down:  { top: `${cy + offset - ITEM_PX / 2}px`, left: `${cx - ITEM_PX / 2}px` },
    left:  { top: `${cy - ITEM_PX / 2}px`, left: `${cx - offset - ITEM_PX / 2}px` },
    right: { top: `${cy - ITEM_PX / 2}px`, left: `${cx + offset - ITEM_PX / 2}px` },
  }

  const translateFrom: Record<string, string> = {
    up:    'translateY(12px) scale(0.75)',
    down:  'translateY(-12px) scale(0.75)',
    left:  'translateX(12px) scale(0.75)',
    right: 'translateX(-12px) scale(0.75)',
  }

  const pos = posMap[props.direction] ?? posMap.up

  return {
    position: 'fixed',
    ...pos,
    transform: open.value ? 'translate(0,0) scale(1)' : (translateFrom[props.direction] ?? 'scale(0.75)'),
    opacity: open.value ? '1' : '0',
    transition,
    pointerEvents: open.value ? 'auto' : 'none',
    zIndex: '1000',
  }
}

const showLabel = computed(() => props.direction === 'up' || props.direction === 'down')

function onScroll() {
  if (!open.value) return
  open.value = false
}


const contentStyle = ref<Record<string, string>>({})

function computeContentPos() {
  const rect = fabEl.value?.getBoundingClientRect()
  if (!rect) return
  const gap = 8
  const base: Record<string, string> = { position: 'fixed', zIndex: '1000' }
  switch (props.direction) {
    case 'up':
      base.bottom = `${window.innerHeight - rect.top + gap}px`
      if (props.align === 'end') base.right = `${window.innerWidth - rect.right}px`
      else base.left = `${rect.left}px`
      base.minWidth = `${rect.width}px`
      break
    case 'down':
      base.top = `${rect.bottom + gap}px`
      if (props.align === 'end') base.right = `${window.innerWidth - rect.right}px`
      else base.left = `${rect.left}px`
      base.minWidth = `${rect.width}px`
      break
    case 'left':
      base.top = `${rect.top}px`
      base.right = `${window.innerWidth - rect.left + gap}px`
      break
    case 'right':
      base.top = `${rect.top}px`
      base.left = `${rect.right + gap}px`
      break
  }
  contentStyle.value = base
}

const contentTransformOrigin = computed(() => {
  const side = props.align === 'end' ? 'right' : 'center'
  switch (props.direction) {
    case 'up': return `bottom ${side}`
    case 'down': return `top ${side}`
    case 'left': return 'center right'
    case 'right': return 'center left'
    default: return `bottom ${side}`
  }
})

function handleFabClick(e: PointerEvent) {
  if (isExpandable.value) {
    if (!open.value) computeContentPos()
    open.value = !open.value
  } else {
    emit('click', e)
  }
}

function handleItemClick(item: SpeedDialItem) {
  if (!props.persistent) open.value = false
  item.onClick?.()
}

function onDocClick(e: MouseEvent) {
  if (!open.value || props.persistent) return
  const t = e.target as Node
  if (fabEl.value?.contains(t)) return
  if (contentEl.value?.contains(t)) return
  open.value = false
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  document.addEventListener('click', onDocClick, true)
  window.addEventListener('scroll', onScroll, true)
  if (fabEl.value) {
    observer = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting && open.value) open.value = false
    }, { threshold: 0 })
    observer.observe(fabEl.value)
  }
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true)
  window.removeEventListener('scroll', onScroll, true)
  observer?.disconnect()
})
</script>

<template>
  <div ref="fabEl" v-bind="$attrs" class="relative inline-flex items-center justify-center">
    <component
      :is="fabTag"
      ref="fabButton"
      :to="to || undefined"
      :type="to ? undefined : 'button'"
      class="relative inline-flex cursor-pointer items-center overflow-hidden transition-shadow duration-150 disabled:cursor-not-allowed disabled:opacity-[0.38] before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
      :class="[colorMap[color], fabSizeClasses, extended ? 'justify-start' : 'justify-center', inBottomAppBar ? '' : 'shadow-elevation-3 hover:shadow-elevation-4 active:shadow-elevation-3']"
      :disabled="disabled"
      :aria-label="label && !expanded ? label : undefined"
      :style="initialButtonStyle"
      v-ripple="{ disabled, color: rippleColor }"
      @click="handleFabClick"
    >
      <MIcon
        :name="icon"
        :size="fabIconSize"
        class="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        :class="isExpandable && open ? 'rotate-45' : ''"
      />
      <!-- The icon-to-label space belongs to the label, so it goes when the label does -->
      <span
        v-if="extended"
        ref="labelEl"
        class="shrink-0 whitespace-nowrap"
        :class="[extended.text, extended.gap]"
        :style="initialLabelStyle"
      >{{ label }}</span>
    </component>
  </div>

  <Teleport to="body">
    <template v-if="hasItems">
      <div
        v-for="(item, i) in items"
        :key="i"
        :style="itemStyle(i)"
        class="flex items-center gap-3"
        :class="showLabel ? 'flex-row-reverse' : ''"
      >
        <span
          v-if="item.label && showLabel"
          class="whitespace-nowrap rounded-md bg-surface-container-high px-3 py-1.5 text-label-medium text-on-surface shadow-elevation-1"
        >
          {{ item.label }}
        </span>

        <component
          :is="item.to ? 'RouterLink' : 'button'"
          :to="item.to || undefined"
          :type="item.to ? undefined : 'button'"
          class="relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg shadow-elevation-3 transition-shadow duration-150 hover:shadow-elevation-4 active:shadow-elevation-3 before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
          :class="colorMap[color]"
          :style="{ width: `${ITEM_PX}px`, height: `${ITEM_PX}px` }"
          v-ripple="rippleColor"
          @pointerdown="handleItemClick(item)"
        >
          <MIcon :name="item.icon" :size="20" />
        </component>
      </div>
    </template>

    <!-- Scrim — a plain sibling of the content panel below, never nested
         inside it, so its own opacity fade never inherits the panel's
         enter/leave transform (which would otherwise make it look like it
         shrinks/lags instead of just covering the screen). -->
    <Transition name="m3-fab-scrim">
      <div v-if="scrim && hasContent && open" class="fixed inset-0 bg-scrim/32" style="z-index: 999" />
    </Transition>

    <!-- Custom content panel -->
    <Transition
      :name="contentTransition === 'none' ? undefined : `m3-fab-content-${contentTransition}`"
    >
      <div
        v-if="hasContent && open"
        ref="contentEl"
        class=""
        :style="{ ...contentStyle, transformOrigin: contentTransformOrigin }"
      >
        <slot name="content" :close="() => open = false" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-fab-content-scale-enter-active {
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-fab-content-scale-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.m3-fab-content-scale-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.m3-fab-content-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.m3-fab-content-fade-enter-active,
.m3-fab-content-fade-leave-active {
  /* Long enough to cover MFabMenu's own item-level close animation, which
     plays inside this panel and needs it to still be mounted while it runs. */
  transition: opacity 220ms ease;
}
.m3-fab-content-fade-enter-from,
.m3-fab-content-fade-leave-to {
  opacity: 0;
}
.m3-fab-scrim-enter-active,
.m3-fab-scrim-leave-active {
  transition: opacity 200ms ease;
}
.m3-fab-scrim-enter-from,
.m3-fab-scrim-leave-to {
  opacity: 0;
}
</style>
