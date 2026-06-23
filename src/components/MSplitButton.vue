<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import MIcon from './MIcon.vue'

export interface SplitButtonItem {
  label: string
  icon?: string
  disabled?: boolean
  onClick?: () => void
}

const props = withDefaults(defineProps<{
  label: string
  icon?: string
  variant?: 'filled' | 'tonal' | 'outlined' | 'elevated'
  color?: 'primary' | 'secondary' | 'tertiary'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  items?: SplitButtonItem[]
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

const sizeConfig = computed(() => {
  const map = {
    xs: { h: 'h-8', w: 'w-8', px: 'px-3', text: 'text-label-medium', icon: 16, arrow: 16, r: 16, ri: 4 },
    sm: { h: 'h-10', w: 'w-10', px: 'px-4', text: 'text-label-large', icon: 18, arrow: 18, r: 20, ri: 6 },
    md: { h: 'h-14', w: 'w-14', px: 'px-5', text: 'text-title-medium', icon: 20, arrow: 20, r: 28, ri: 6 },
    lg: { h: 'h-16', w: 'w-16', px: 'px-6', text: 'text-title-large', icon: 22, arrow: 22, r: 32, ri: 7 },
    xl: { h: 'h-20', w: 'w-20', px: 'px-7', text: 'text-headline-small', icon: 24, arrow: 24, r: 40, ri: 8 },
  }
  return map[props.size] ?? map.sm
})

function computeMenuPos() {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  const menuH = (props.items?.length ?? 0) * 44 + 16
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const above = spaceBelow < menuH && rect.top > menuH
  menuStyle.value = {
    position: 'fixed',
    zIndex: '500',
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
    ...(above
      ? { bottom: `${window.innerHeight - rect.top + 4}px` }
      : { top: `${rect.bottom + 4}px` }),
  }
}

function toggleMenu() {
  if (props.disabled) return
  if (!open.value) computeMenuPos()
  open.value = !open.value
}

function createRipple(event: PointerEvent) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const el = document.createElement('span')
  el.className = 'm3-ripple'
  el.style.cssText = `width:${d}px;height:${d}px;top:${event.clientY - rect.top - d / 2}px;left:${event.clientX - rect.left - d / 2}px`
  button.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
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
  <div ref="containerEl" :class="containerClasses">
    <!-- Main action -->
    <button
      type="button"
      class="relative flex cursor-pointer items-center gap-2 overflow-hidden font-medium transition-colors"
      :class="[
        sizeConfig.h, sizeConfig.px, sizeConfig.text,
        colorStyles.bg,
        colorStyles.text,
        colorStyles.hover,
        variant === 'outlined' ? 'border border-outline' : '',
        variant === 'elevated' ? 'shadow-elevation-1' : '',
        disabled ? 'pointer-events-none opacity-[0.38]' : '',
      ]"
      :style="{ borderRadius: `${sizeConfig.r}px ${sizeConfig.ri}px ${sizeConfig.ri}px ${sizeConfig.r}px` }"
      :disabled="disabled"
      @pointerdown="createRipple"
      @click="emit('click', $event)"
    >
      <MIcon v-if="icon" :name="icon" :size="sizeConfig.icon" />
      {{ label }}
    </button>

    <!-- Toggle -->
    <button
      type="button"
      class="toggle-btn relative flex cursor-pointer items-center justify-center overflow-hidden"
      :class="[
        sizeConfig.h, sizeConfig.w,
        colorStyles.bg,
        colorStyles.text,
        colorStyles.hover,
        variant === 'outlined' ? 'border border-outline' : '',
        variant === 'elevated' ? 'shadow-elevation-1' : '',
        disabled ? 'pointer-events-none opacity-[0.38]' : '',
      ]"
      :style="{ borderRadius: open ? `${sizeConfig.r}px` : `${sizeConfig.ri}px ${sizeConfig.r}px ${sizeConfig.r}px ${sizeConfig.ri}px` }"
      :disabled="disabled"
      @pointerdown="createRipple"
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
