<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useSlots } from 'vue'
import MIcon from './MIcon.vue'

export interface SpeedDialItem {
  icon: string
  label?: string
  to?: string | Record<string, any>
  onClick?: () => void
}

const props = withDefaults(
  defineProps<{
    icon: string
    label?: string
    color?: 'primary' | 'secondary' | 'tertiary' | 'surface'
    size?: 'small' | 'regular' | 'large'
    disabled?: boolean
    items?: SpeedDialItem[]
    direction?: 'up' | 'down' | 'left' | 'right' | 'radial'
    to?: string | Record<string, any>
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
  }>(),
  {
    color: 'primary',
    size: 'regular',
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

const colorMap: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  surface: 'bg-surface-container-high text-primary',
}

const fabSizeClasses = computed(() => {
  // Extended FAB (androidx FloatingActionButton.kt): 16dp start padding, 12dp
  // icon-to-label gap, 20dp end padding, 80dp minimum width.
  if (props.label) return 'h-14 min-w-20 rounded-2xl pl-4 pr-5 gap-3'
  switch (props.size) {
    case 'small': return 'h-10 w-10 rounded-lg'
    case 'large': return 'h-24 w-24 rounded-[28px]'
    default: return 'h-14 w-14 rounded-2xl'
  }
})

const fabIconSize = computed(() => {
  if (props.label) return 24
  switch (props.size) {
    case 'small': return 20
    case 'large': return 36
    default: return 24
  }
})

const fabPx = computed(() => {
  if (props.label) return 56
  switch (props.size) {
    case 'small': return 40
    case 'large': return 96
    default: return 56
  }
})

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

function createRipple(event: PointerEvent | MouseEvent, target?: HTMLElement) {
  const button = (target ?? event.currentTarget) as HTMLElement
  const rect = button.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const el = document.createElement('span')
  el.className = 'm3-ripple'
  el.style.cssText = `width:${d}px;height:${d}px;top:${event.clientY - rect.top - d / 2}px;left:${event.clientX - rect.left - d / 2}px`
  button.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
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

function handleItemClick(e: PointerEvent, item: SpeedDialItem, buttonEl: HTMLElement) {
  createRipple(e, buttonEl)
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
  <div ref="fabEl" class="relative inline-flex items-center justify-center">
    <component
      :is="fabTag"
      :to="to || undefined"
      :type="to ? undefined : 'button'"
      class="relative inline-flex cursor-pointer items-center justify-center overflow-hidden shadow-elevation-1 transition-shadow duration-150 hover:shadow-elevation-2 active:shadow-elevation-1 disabled:cursor-not-allowed disabled:opacity-[0.38] before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
      :class="[colorMap[color], fabSizeClasses]"
      :disabled="disabled"
      @pointerdown="createRipple"
      @click="handleFabClick"
    >
      <MIcon
        :name="icon"
        :size="fabIconSize"
        class="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        :class="isExpandable && open ? 'rotate-45' : ''"
      />
      <span v-if="label" class="text-label-large font-medium">{{ label }}</span>
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
          class="relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg shadow-elevation-1 transition-shadow duration-150 hover:shadow-elevation-2 active:shadow-elevation-1 before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
          :class="colorMap[color]"
          :style="{ width: `${ITEM_PX}px`, height: `${ITEM_PX}px` }"
          @pointerdown="(e: PointerEvent) => handleItemClick(e, item, e.currentTarget as HTMLElement)"
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
      <div v-if="scrim && hasContent && open" class="fixed inset-0 bg-scrim/40" style="z-index: 999" />
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
