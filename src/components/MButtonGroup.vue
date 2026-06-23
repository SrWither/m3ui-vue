<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

export interface ButtonGroupOption {
  value: unknown
  label?: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: unknown
  options: ButtonGroupOption[]
  variant?: 'standard' | 'connected'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  multiSelect?: boolean
  selectionRequired?: boolean
  color?: 'primary' | 'secondary' | 'tertiary'
}>(), {
  variant: 'standard',
  size: 'sm',
  multiSelect: false,
  selectionRequired: false,
  color: 'primary',
})

const emit = defineEmits<{ 'update:modelValue': [unknown] }>()

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function isSelected(value: unknown) {
  if (props.modelValue == null) return false
  if (Array.isArray(props.modelValue)) return props.modelValue.some(v => eq(v, value))
  return eq(props.modelValue, value)
}

function toggle(opt: ButtonGroupOption) {
  if (opt.disabled) return
  if (props.multiSelect) {
    const arr = Array.isArray(props.modelValue) ? [...props.modelValue] : props.modelValue != null ? [props.modelValue] : []
    const idx = arr.findIndex(v => eq(v, opt.value))
    if (idx >= 0) {
      if (props.selectionRequired && arr.length <= 1) return
      arr.splice(idx, 1)
    } else {
      arr.push(opt.value)
    }
    emit('update:modelValue', arr)
  } else {
    if (isSelected(opt.value) && !props.selectionRequired) {
      emit('update:modelValue', null)
    } else {
      emit('update:modelValue', opt.value)
    }
  }
}

const sizeMap = {
  xs: { h: 'h-8', px: 'px-3', text: 'text-label-medium', icon: 16, check: 14 },
  sm: { h: 'h-10', px: 'px-4', text: 'text-label-large', icon: 18, check: 16 },
  md: { h: 'h-14', px: 'px-6', text: 'text-title-medium', icon: 20, check: 18 },
  lg: { h: 'h-16', px: 'px-7', text: 'text-title-large', icon: 22, check: 20 },
  xl: { h: 'h-20', px: 'px-8', text: 'text-headline-small', icon: 24, check: 22 },
}

const s = computed(() => sizeMap[props.size] ?? sizeMap.sm)

const fullRadius = computed(() => {
  const hMap = { xs: '16px', sm: '20px', md: '28px', lg: '32px', xl: '40px' }
  return hMap[props.size] ?? '20px'
})

const transitionMs = computed(() => {
  const msMap = { xs: 350, sm: 300, md: 250, lg: 200, xl: 180 }
  return msMap[props.size] ?? 250
})

const selectedColors = computed(() => {
  const map = {
    primary: 'bg-primary text-on-primary',
    secondary: 'bg-secondary text-on-secondary',
    tertiary: 'bg-tertiary text-on-tertiary',
  }
  return map[props.color] ?? map.primary
})

const unselectedColors = 'bg-surface-container-highest text-on-surface'

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

function btnStyle(i: number, selected: boolean) {
  const count = props.options.length
  const full = fullRadius.value
  const inner = '6px'
  let tl: string, tr: string, br: string, bl: string
  if (props.variant === 'standard' || selected) {
    tl = tr = br = bl = full
  } else {
    tl = bl = i === 0 ? full : inner
    tr = br = i === count - 1 ? full : inner
  }
  return {
    borderTopLeftRadius: tl,
    borderTopRightRadius: tr,
    borderBottomRightRadius: br,
    borderBottomLeftRadius: bl,
    transition: `border-top-left-radius ${transitionMs.value}ms ease, border-top-right-radius ${transitionMs.value}ms ease, border-bottom-right-radius ${transitionMs.value}ms ease, border-bottom-left-radius ${transitionMs.value}ms ease, background-color ${transitionMs.value}ms ease, color ${transitionMs.value}ms ease`,
  }
}
</script>

<template>
  <div
    class="inline-flex"
    :class="variant === 'standard' ? 'gap-1.5' : 'gap-0.5'"
    role="group"
  >
    <button
      v-for="(opt, i) in options"
      :key="String(opt.value)"
      type="button"
      class="btn-group-item relative inline-flex items-center justify-center gap-2 overflow-hidden font-medium"
      :class="[
        s.h, s.px, s.text,
        opt.disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer',
        isSelected(opt.value) ? selectedColors : unselectedColors,
      ]"
      :style="btnStyle(i, isSelected(opt.value))"
      :disabled="opt.disabled"
      :aria-pressed="isSelected(opt.value)"
      @pointerdown="createRipple"
      @click="toggle(opt)"
    >
      <MIcon
        v-if="isSelected(opt.value)"
        name="check"
        :size="s.check"
      />
      <MIcon v-else-if="opt.icon" :name="opt.icon" :size="s.icon" />
      <span v-if="opt.label">{{ opt.label }}</span>
    </button>
  </div>
</template>

