<script setup lang="ts">
/**
 * A button split into a main action and a dropdown toggle — click the main part for the primary action, the
 * arrow for alternatives.
 *
 * @slot menu Custom dropdown content. Used instead of items. Call close() to dismiss.
 * @event click Emitted when the main (left) button is clicked
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import MIcon from './MIcon.vue'
import { vRipple } from '../directives/vRipple'
import { POPUP_MARGIN, dropdownX, fitPopup } from '../composables/_popupPosition'
import { useLocale } from '../composables/useLocale'

export interface SplitButtonItem {
  label: string
  icon?: string
  disabled?: boolean
  onClick?: () => void
}

const locale = useLocale()
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Main button label */
  label: string
  /** Main button icon */
  icon?: string
  /** Visual style */
  variant?: 'filled' | 'tonal' | 'outlined' | 'elevated'
  /** Color scheme */
  color?: 'primary' | 'secondary' | 'tertiary'
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Disables both parts */
  disabled?: boolean
  /** Dropdown menu items; see `SplitButtonItem` */
  items?: SplitButtonItem[]
  /** Any CSS color for the press ripple; defaults to the button's content color */
  rippleColor?: string
}>(), {
  variant: 'tonal',
  color: 'primary',
  size: 'sm',
  disabled: false,
})

const emit = defineEmits<{ click: [MouseEvent] }>()

const open = ref(false)
const containerEl = ref<HTMLElement>()
const menuEl = ref<HTMLElement>()
const menuStyle = ref<Record<string, string>>({})

const colorStyles = computed(() => {
  const map: Record<string, Record<string, { bg: string; text: string; hover: string; divider: string }>> = {
    filled: {
      primary: { bg: 'bg-primary', text: 'text-on-primary', hover: 'hover:brightness-110', divider: 'bg-on-primary/20' },
      secondary: { bg: 'bg-secondary', text: 'text-on-secondary', hover: 'hover:brightness-110', divider: 'bg-on-secondary/20' },
      tertiary: { bg: 'bg-tertiary', text: 'text-on-tertiary', hover: 'hover:brightness-110', divider: 'bg-on-tertiary/20' },
    },
    tonal: {
      primary: { bg: 'bg-primary-container', text: 'text-on-primary-container', hover: 'hover:bg-primary-container/80', divider: 'bg-on-primary-container/20' },
      secondary: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', hover: 'hover:bg-secondary-container/80', divider: 'bg-on-secondary-container/20' },
      tertiary: { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', hover: 'hover:bg-tertiary-container/80', divider: 'bg-on-tertiary-container/20' },
    },
    outlined: {
      primary: { bg: 'bg-transparent', text: 'text-primary', hover: 'hover:bg-primary/8', divider: 'bg-outline' },
      secondary: { bg: 'bg-transparent', text: 'text-secondary', hover: 'hover:bg-secondary/8', divider: 'bg-outline' },
      tertiary: { bg: 'bg-transparent', text: 'text-tertiary', hover: 'hover:bg-tertiary/8', divider: 'bg-outline' },
    },
    elevated: {
      primary: { bg: 'bg-surface-container-low', text: 'text-primary', hover: 'hover:bg-surface-container', divider: 'bg-outline-variant' },
      secondary: { bg: 'bg-surface-container-low', text: 'text-secondary', hover: 'hover:bg-surface-container', divider: 'bg-outline-variant' },
      tertiary: { bg: 'bg-surface-container-low', text: 'text-tertiary', hover: 'hover:bg-surface-container', divider: 'bg-outline-variant' },
    },
  }
  return map[props.variant]?.[props.color] ?? map.tonal!.primary!
})

const containerClasses = computed(() => {
  return 'inline-flex items-center gap-0.5'
})

// Dimensions matched to SplitButton{XSmall,Small,Medium,Large,XLarge}Tokens.kt: ContainerHeight,
// TrailingIconSize, LeadingButton*Space (symmetric padding here vs the real tokens' slightly
// asymmetric leading/trailing split — simplification, not worth separate left/right padding
// classes), and resting InnerCorner*CornerSize (`ri`). `r` is always height/2 to keep the outer
// shape a true pill (ContainerShape = CornerFull) regardless of tier.
const sizeConfig = computed(() => {
  const map = {
    xs: { h: 'h-8', w: 'w-8', px: 'px-3', text: 'text-label-medium', icon: 20, arrow: 22, r: 16, ri: 4 },
    sm: { h: 'h-10', w: 'w-10', px: 'px-4', text: 'text-label-large', icon: 20, arrow: 22, r: 20, ri: 4 },
    md: { h: 'h-14', w: 'w-14', px: 'px-6', text: 'text-title-medium', icon: 24, arrow: 26, r: 28, ri: 4 },
    lg: { h: 'h-24', w: 'w-24', px: 'px-12', text: 'text-title-large', icon: 32, arrow: 38, r: 48, ri: 8 },
    xl: { h: 'h-[136px]', w: 'w-[136px]', px: 'px-16', text: 'text-headline-small', icon: 40, arrow: 50, r: 68, ri: 12 },
  }
  return map[props.size] ?? map.sm
})

// M3 disabled tokens: content at 38% on-surface opacity, container at 10% (same split already
// established for MButton) — replaces a blanket 38% opacity that was applied to the whole button.
const buttonStateClasses = computed(() => {
  if (props.disabled) {
    return [
      'text-on-surface/38',
      props.variant === 'outlined' ? 'border border-outline-variant/10' : 'bg-on-surface/10',
    ]
  }
  return [
    colorStyles.value.bg,
    colorStyles.value.text,
    colorStyles.value.hover,
    props.variant === 'outlined' ? 'border border-outline' : '',
    props.variant === 'elevated' ? 'shadow-elevation-1' : '',
  ]
})

// At least as wide as the button, at the window's left edge until placeMenu() can measure it (once it's in the
// DOM, before it paints) and keep it on screen (see _popupPosition.ts): under the button, aligned with its start
// edge, else its end edge or the window edge; above it when it doesn't fit below
let anchorRect: DOMRect | null = null
function computeMenuPos() {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  anchorRect = rect
  menuStyle.value = {
    position: 'fixed',
    zIndex: '500',
    left: '0px',
    top: `${rect.bottom + 4}px`,
    minWidth: `${rect.width}px`,
    maxWidth: `${window.innerWidth - 2 * POPUP_MARGIN}px`,
  }
}

function placeMenu(el: Element) {
  if (!anchorRect) return
  const menu = el as HTMLElement
  const w = menu.offsetWidth
  const h = menu.offsetHeight
  const left = dropdownX(anchorRect, w, window.innerWidth, 'start')
  const top = fitPopup([anchorRect.bottom + 4, anchorRect.top - 4 - h], h, window.innerHeight)
  menuStyle.value = { ...menuStyle.value, left: `${left}px`, top: `${top}px` }
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
}

function toggleMenu() {
  if (props.disabled) return
  if (!open.value) computeMenuPos()
  open.value = !open.value
}


function selectItem(item: SplitButtonItem) {
  if (item.disabled) return
  item.onClick?.()
  open.value = false
}

function onOutside(e: MouseEvent) {
  const t = e.target as Node
  if (containerEl.value?.contains(t)) return
  if (menuEl.value?.contains(t)) return
  open.value = false
}

function onScroll(e: Event) {
  if (!open.value) return
  if (menuEl.value?.contains(e.target as Node)) return
  open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onOutside)
  window.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutside)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div ref="containerEl" v-bind="$attrs" :class="containerClasses">
    <!-- Main action -->
    <button
      type="button"
      class="relative flex cursor-pointer items-center gap-2 overflow-hidden font-medium transition-colors"
      :class="[
        sizeConfig.h, sizeConfig.px, sizeConfig.text,
        buttonStateClasses,
        disabled ? 'pointer-events-none' : '',
      ]"
      :style="{ borderRadius: `${sizeConfig.r}px ${sizeConfig.ri}px ${sizeConfig.ri}px ${sizeConfig.r}px` }"
      :disabled="disabled"
      v-ripple="rippleColor"
      @click="emit('click', $event)"
    >
      <MIcon v-if="icon" :name="icon" :size="sizeConfig.icon" />
      {{ label }}
    </button>

    <!-- Toggle -->
    <button
      :aria-label="locale.menu" aria-haspopup="menu" :aria-expanded="open"
      type="button"
      class="toggle-btn relative flex cursor-pointer items-center justify-center overflow-hidden"
      :class="[
        sizeConfig.h, sizeConfig.w,
        buttonStateClasses,
        disabled ? 'pointer-events-none' : '',
      ]"
      :style="{ borderRadius: open ? `${sizeConfig.r}px` : `${sizeConfig.ri}px ${sizeConfig.r}px ${sizeConfig.r}px ${sizeConfig.ri}px` }"
      :disabled="disabled"
      v-ripple="rippleColor"
      @click="toggleMenu"
    >
      <MIcon
        name="arrow_drop_down"
        :size="sizeConfig.arrow"
        class="transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      />
    </button>
  </div>

  <!-- Dropdown menu -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-[opacity,transform] duration-150"
      enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
      leave-active-class="transition-[opacity,transform] duration-100"
      leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      @enter="placeMenu"
    >
      <div
        v-if="open && items?.length"
        ref="menuEl"
        class="overflow-hidden rounded-xl bg-surface-container py-2 shadow-elevation-2"
        :style="menuStyle"
      >
        <button
          v-for="(item, i) in items"
          :key="i"
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-body-medium transition-colors"
          :class="item.disabled ? 'cursor-not-allowed opacity-[0.38] text-on-surface' : 'text-on-surface hover:bg-on-surface/8'"
          :disabled="item.disabled"
          @click="selectItem(item)"
        >
          <MIcon v-if="item.icon" :name="item.icon" :size="18" class="shrink-0 text-on-surface-variant" />
          {{ item.label }}
        </button>
      </div>
    </Transition>

    <!-- Custom content -->
    <Transition
      enter-active-class="transition-[opacity,transform] duration-150"
      enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
      leave-active-class="transition-[opacity,transform] duration-100"
      leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      @enter="placeMenu"
    >
      <div
        v-if="open && !items?.length && $slots.menu"
        ref="menuEl"
        :style="menuStyle"
      >
        <slot name="menu" :close="() => open = false" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toggle-btn {
  transition: border-radius 250ms ease, background-color 150ms ease;
}
</style>
