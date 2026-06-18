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

// Primary tab: refs for indicator position
const tabEls = ref<HTMLElement[]>([])
const indicatorLeft = ref(0)
const indicatorWidth = ref(0)

function updateIndicator() {
  nextTick(() => {
    const idx = props.tabs.findIndex((t) => t.value === props.modelValue)
    const el = tabEls.value[idx]
    if (!el) return
    indicatorLeft.value = el.offsetLeft
    indicatorWidth.value = el.offsetWidth
  })
}

onMounted(updateIndicator)
watch(() => props.modelValue, updateIndicator)
watch(() => props.tabs, updateIndicator, { deep: true })

function select(tab: Tab) {
  if (!tab.disabled) emit('update:modelValue', tab.value)
}
</script>

<template>
  <!-- ── Primary: underline with sliding indicator ──────────────────────── -->
  <div v-if="variant === 'primary'" class="relative border-b border-outline-variant">
    <div class="flex overflow-x-auto" style="scrollbar-width: none">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :ref="(el) => { if (el) tabEls[tabs.indexOf(tab)] = el as HTMLElement }"
        type="button"
        class="relative flex h-12 shrink-0 flex-col items-center justify-center gap-0.5 px-6 text-label-large transition-colors duration-150 focus-visible:outline-none"
        :class="[
          tab.value === modelValue
            ? 'text-primary'
            : tab.disabled
              ? 'cursor-not-allowed text-on-surface/38'
              : 'cursor-pointer text-on-surface-variant hover:text-on-surface',
          tab.icon ? 'pt-2 pb-1' : '',
        ]"
        :disabled="tab.disabled"
        @click="select(tab)"
      >
        <MIcon v-if="tab.icon" :name="tab.icon" :size="20" />
        <span>{{ tab.label }}</span>
      </button>
    </div>
    <!-- Sliding indicator -->
    <div
      class="absolute bottom-0 h-[3px] rounded-t-sm bg-primary transition-[left,width] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
      :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
    />
  </div>

  <!-- ── Secondary: pill style ──────────────────────────────────────────── -->
  <div v-else class="flex flex-wrap gap-1 rounded-full bg-surface-container p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="flex h-8 items-center gap-2 rounded-full px-4 text-label-large transition-all duration-150 focus-visible:outline-none"
      :class="
        tab.value === modelValue
          ? 'bg-secondary-container text-on-secondary-container shadow-elevation-1'
          : tab.disabled
            ? 'cursor-not-allowed text-on-surface/38'
            : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface'
      "
      :disabled="tab.disabled"
      @click="select(tab)"
    >
      <MIcon v-if="tab.icon" :name="tab.icon" :size="16" />
      {{ tab.label }}
    </button>
  </div>
</template>
