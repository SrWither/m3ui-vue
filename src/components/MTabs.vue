<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'

interface Tab {
  value: string | number
  label: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string | number
  tabs: Tab[]
  variant?: 'primary' | 'secondary'
}>(), { variant: 'primary' })

const emit = defineEmits<{ 'update:modelValue': [string | number] }>()

const tabEls = ref<HTMLElement[]>([])
const indicatorLeft = ref(0)
const indicatorWidth = ref(0)
const stretching = ref(false)
let stretchTimer: ReturnType<typeof setTimeout> | null = null

function getTabRect(index: number) {
  const el = tabEls.value[index]
  if (!el) return null
  return { left: el.offsetLeft, width: el.offsetWidth }
}

function updateIndicator(animate = true) {
  nextTick(() => {
    const idx = props.tabs.findIndex((t) => t.value === props.modelValue)
    const rect = getTabRect(idx)
    if (!rect) return

    if (props.variant === 'primary') {
      const inset = Math.min(rect.width * 0.2, 16)
      if (animate && indicatorWidth.value > 0) {
        const oldLeft = indicatorLeft.value
        const oldRight = oldLeft + indicatorWidth.value
        const newLeft = rect.left + inset
        const newRight = rect.left + rect.width - inset
        stretching.value = true
        indicatorLeft.value = Math.min(oldLeft, newLeft)
        indicatorWidth.value = Math.max(oldRight, newRight) - indicatorLeft.value
        if (stretchTimer) clearTimeout(stretchTimer)
        stretchTimer = setTimeout(() => {
          stretching.value = false
          indicatorLeft.value = newLeft
          indicatorWidth.value = newRight - newLeft
        }, 150)
      } else {
        const insetLeft = rect.left + inset
        indicatorLeft.value = insetLeft
        indicatorWidth.value = rect.width - inset * 2
      }
    } else {
      indicatorLeft.value = rect.left
      indicatorWidth.value = rect.width
    }
  })
}

onMounted(() => updateIndicator(false))
watch(() => props.modelValue, () => updateIndicator(true))
watch(() => props.tabs, () => updateIndicator(false), { deep: true })

function select(tab: Tab) {
  if (!tab.disabled) emit('update:modelValue', tab.value)
}
</script>

<template>
  <!-- ── Primary: sliding short indicator with stretch ──────────────── -->
  <div v-if="variant === 'primary'" class="border-b border-outline-variant">
    <div class="relative flex overflow-x-auto" style="scrollbar-width: none">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :ref="(el) => { if (el) tabEls[tabs.indexOf(tab)] = el as HTMLElement }"
        type="button"
        class="relative flex shrink-0 flex-col items-center justify-center gap-1 px-6 text-label-large transition-colors duration-150 focus-visible:outline-none"
        :class="[
          tab.icon ? 'h-14 pb-1.5' : 'h-12 pb-1.5',
          tab.value === modelValue
            ? 'text-primary'
            : tab.disabled
              ? 'cursor-not-allowed text-on-surface/38'
              : 'cursor-pointer text-on-surface-variant hover:text-on-surface',
        ]"
        :disabled="tab.disabled"
        @click="select(tab)"
      >
        <MIcon v-if="tab.icon" :name="tab.icon" :size="20" />
        <span>{{ tab.label }}</span>
      </button>
      <div
        class="absolute bottom-0 h-[3px] rounded-t-full bg-primary"
        :style="{
          left: `${indicatorLeft}px`,
          width: `${indicatorWidth}px`,
          transition: stretching
            ? 'left 150ms cubic-bezier(0.4, 0, 0.2, 1), width 150ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'left 180ms cubic-bezier(0.34, 1.4, 0.64, 1), width 180ms cubic-bezier(0.34, 1.4, 0.64, 1)',
        }"
      />
    </div>
  </div>

  <!-- ── Secondary: full-width underline indicator ─────────────────── -->
  <div v-else class="border-b border-outline-variant">
    <div class="relative flex overflow-x-auto" style="scrollbar-width: none">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :ref="(el) => { if (el) tabEls[tabs.indexOf(tab)] = el as HTMLElement }"
        type="button"
        class="relative flex h-12 shrink-0 items-center justify-center gap-2 px-6 text-label-large transition-colors duration-150 focus-visible:outline-none"
        :class="
          tab.value === modelValue
            ? 'text-on-surface'
            : tab.disabled
              ? 'cursor-not-allowed text-on-surface/38'
              : 'cursor-pointer text-on-surface-variant hover:text-on-surface'
        "
        :disabled="tab.disabled"
        @click="select(tab)"
      >
        <MIcon v-if="tab.icon" :name="tab.icon" :size="18" />
        {{ tab.label }}
      </button>
      <div
        class="absolute bottom-0 h-[2px] bg-primary transition-[left,width] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
      />
    </div>
  </div>
</template>
