<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import MIcon from './MIcon.vue'

export interface SpeedDialItem {
  icon: string
  label?: string
  onClick?: () => void
}

const props = withDefaults(
  defineProps<{
    icon: string
    label?: string
    color?: 'primary' | 'secondary' | 'tertiary' | 'surface'
    size?: 'small' | 'regular' | 'large'
    disabled?: boolean
    /** Speed-dial child items. If provided, clicking the FAB toggles them instead of emitting click. */
    items?: SpeedDialItem[]
    /** Direction the speed-dial items expand toward. */
    direction?: 'up' | 'down' | 'left' | 'right' | 'radial'
  }>(),
  {
    color: 'primary',
    size: 'regular',
    disabled: false,
    direction: 'up',
  },
)

const emit = defineEmits<{ click: [MouseEvent] }>()

const open = ref(false)
const containerEl = ref<HTMLElement>()

const hasItems = computed(() => !!props.items?.length)

const colorMap: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  surface: 'bg-surface-container-high text-primary',
}

const fabSizeClasses = computed(() => {
  if (props.label) return 'h-14 rounded-2xl px-4 gap-3'
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

// FAB height in px — used to position items relative to the container
const fabPx = computed(() => {
  if (props.label) return 56
  switch (props.size) {
    case 'small': return 40
    case 'large': return 96
    default: return 56
  }
})

// Item size (always small-FAB-sized): 40px
const ITEM_PX = 40
const ITEM_GAP = 8

function itemStyle(index: number): Record<string, string> {
  const count = props.items?.length ?? 0
  // Stagger delay: open = forward order, close = reverse order
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
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: `${-ITEM_PX / 2}px`,
      marginLeft: `${-ITEM_PX / 2}px`,
      transform: open.value ? `translate(${dx}px, ${dy}px) scale(1)` : 'translate(0,0) scale(0)',
      opacity: open.value ? '1' : '0',
      transition,
      pointerEvents: open.value ? 'auto' : 'none',
    }
  }

  // Linear directions: offset from the container edge
  const step = ITEM_PX + ITEM_GAP
  const base = fabPx.value + ITEM_GAP + index * step

  const offsetMap: Record<string, Record<string, string>> = {
    up:    { bottom: `${base}px`, left: '50%', marginLeft: `${-ITEM_PX / 2}px` },
    down:  { top:    `${base}px`, left: '50%', marginLeft: `${-ITEM_PX / 2}px` },
    left:  { right:  `${base}px`, top:  '50%', marginTop:  `${-ITEM_PX / 2}px` },
    right: { left:   `${base}px`, top:  '50%', marginTop:  `${-ITEM_PX / 2}px` },
  }

  const translateFrom: Record<string, string> = {
    up:    'translateY(12px) scale(0.75)',
    down:  'translateY(-12px) scale(0.75)',
    left:  'translateX(12px) scale(0.75)',
    right: 'translateX(-12px) scale(0.75)',
  }

  return {
    position: 'absolute',
    ...offsetMap[props.direction] ?? offsetMap.up,
    transform: open.value ? 'translate(0,0) scale(1)' : (translateFrom[props.direction] ?? 'scale(0.75)'),
    opacity: open.value ? '1' : '0',
    transition,
    pointerEvents: open.value ? 'auto' : 'none',
  }
}

// Label only makes sense for up/down; placed to the left of the item button
const showLabel = computed(() => props.direction === 'up' || props.direction === 'down')

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

function handleFabClick(e: PointerEvent) {
  if (hasItems.value) {
    open.value = !open.value
  } else {
    emit('click', e)
  }
}

function handleItemClick(e: PointerEvent, item: SpeedDialItem, buttonEl: HTMLElement) {
  createRipple(e, buttonEl)
  open.value = false
  item.onClick?.()
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return
  if (containerEl.value && !containerEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick, true))
onUnmounted(() => document.removeEventListener('click', onDocClick, true))
</script>

<template>
  <div ref="containerEl" class="relative inline-flex items-center justify-center">
    <!-- Speed-dial items (absolutely positioned outside the container) -->
    <template v-if="hasItems">
      <div
        v-for="(item, i) in items"
        :key="i"
        :style="itemStyle(i)"
        class="flex items-center gap-3"
        :class="showLabel ? 'flex-row-reverse' : ''"
      >
        <!-- Label pill (up/down only) -->
        <span
          v-if="item.label && showLabel"
          class="whitespace-nowrap rounded-md bg-surface-container-high px-3 py-1.5 text-label-medium text-on-surface shadow-elevation-1"
        >
          {{ item.label }}
        </span>

        <!-- Mini FAB button -->
        <button
          type="button"
          class="relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg shadow-elevation-1 transition-shadow duration-150 hover:shadow-elevation-2 active:shadow-elevation-1 before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
          :class="colorMap[color]"
          :style="{ width: `${ITEM_PX}px`, height: `${ITEM_PX}px` }"
          @pointerdown="(e) => handleItemClick(e, item, e.currentTarget as HTMLElement)"
        >
          <MIcon :name="item.icon" :size="20" />
        </button>
      </div>
    </template>

    <!-- Main FAB -->
    <button
      type="button"
      class="relative inline-flex cursor-pointer items-center justify-center overflow-hidden shadow-elevation-1 transition-shadow duration-150 hover:shadow-elevation-2 active:shadow-elevation-1 disabled:cursor-not-allowed disabled:opacity-[0.38] before:content-[''] before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
      :class="[colorMap[color], fabSizeClasses]"
      :disabled="disabled"
      @pointerdown="(e) => { createRipple(e); handleFabClick(e) }"
    >
      <MIcon
        :name="icon"
        :size="fabIconSize"
        class="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        :class="hasItems && open ? 'rotate-45' : ''"
      />
      <span v-if="label" class="text-label-large font-medium">{{ label }}</span>
    </button>
  </div>
</template>
