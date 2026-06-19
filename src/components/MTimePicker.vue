<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  disabled?: boolean
  error?: string
  hint?: string
  minuteStep?: number
  use24h?: boolean
  fieldBg?: string
}>(), { minuteStep: 5, use24h: true })

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const mode = ref<'hour' | 'minute'>('hour')
const dropPos = ref({ top: '0px', left: '0px' })
const { resolvedFieldBg } = useFieldBg(triggerEl, () => props.fieldBg)

const parsed = computed(() => {
  if (!props.modelValue) return { h: 12, m: 0 }
  const parts = props.modelValue.split(':').map(Number)
  return { h: parts[0] ?? 12, m: parts[1] ?? 0 }
})

const selectedHour = ref(parsed.value.h)
const selectedMinute = ref(parsed.value.m)
watch(() => props.modelValue, () => {
  selectedHour.value = parsed.value.h
  selectedMinute.value = parsed.value.m
})

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = computed(() => {
  const arr: number[] = []
  for (let m = 0; m < 60; m += props.minuteStep) arr.push(m)
  return arr
})

function pad(n: number) { return String(n).padStart(2, '0') }

function selectHour(h: number) {
  selectedHour.value = h
  mode.value = 'minute'
}

function selectMinute(m: number) {
  selectedMinute.value = m
  emit('update:modelValue', `${pad(selectedHour.value)}:${pad(m)}`)
  open.value = false
  mode.value = 'hour'
}

function clear() {
  emit('update:modelValue', null)
}

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  return `${pad(parsed.value.h)}:${pad(parsed.value.m)}`
})

function computeDropPos() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  const panelH = 320
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const above = spaceBelow < panelH && rect.top > panelH
  dropPos.value = {
    top: above ? `${rect.top - 4 - panelH}px` : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
}

function onOut(e: MouseEvent) {
  const t = e.target as Node
  if (triggerEl.value?.contains(t)) return
  if (panelEl.value?.contains(t)) return
  open.value = false
}

function onScroll(e: Event) {
  if (!open.value) return
  if (panelEl.value?.contains(e.target as Node)) return
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) { open.value = false; return }
  computeDropPos()
}

watch(open, (v) => {
  if (v) {
    mode.value = 'hour'
    selectedHour.value = parsed.value.h
    selectedMinute.value = parsed.value.m
    computeDropPos()
    setTimeout(() => document.addEventListener('mousedown', onOut), 0)
  } else {
    document.removeEventListener('mousedown', onOut)
  }
})

onMounted(() => window.addEventListener('scroll', onScroll, true))
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  document.removeEventListener('mousedown', onOut)
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div ref="triggerEl" class="relative mt-2" :style="{ '--field-bg': resolvedFieldBg }">
      <button
        type="button"
        class="flex h-14 w-full items-center gap-2 rounded-sm border bg-transparent px-4 text-left text-body-large transition-[border-color,border-width] duration-150"
        :class="[
          disabled ? 'pointer-events-none opacity-[0.38]' : 'cursor-pointer',
          open
            ? error ? 'border-2 border-error' : 'border-2 border-primary'
            : error ? 'border-error' : 'border-outline hover:border-on-surface',
        ]"
        @click="!disabled && (open = !open)"
      >
        <MIcon name="schedule" :size="20" class="shrink-0 text-on-surface-variant" />
        <span v-if="displayValue" class="flex-1 font-mono text-on-surface">{{ displayValue }}</span>
        <span v-else class="flex-1 text-on-surface-variant">{{ label || 'Seleccionar hora' }}</span>
        <MIcon
          v-if="modelValue"
          name="close"
          :size="18"
          class="shrink-0 cursor-pointer text-on-surface-variant hover:text-on-surface"
          @click.stop="clear"
        />
      </button>
      <label
        v-if="label"
        class="pointer-events-none absolute -top-2.5 left-3 bg-(--field-bg) px-1 text-label-small transition-colors"
        :class="open ? (error ? 'text-error' : 'text-primary') : error ? 'text-error' : 'text-on-surface-variant'"
      >
        {{ label }}
      </label>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-150"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
        leave-active-class="transition-[opacity,transform] duration-100"
        leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      >
        <div
          v-if="open"
          ref="panelEl"
          class="fixed z-500 w-[280px] rounded-lg bg-surface-container shadow-elevation-3"
          :style="dropPos"
        >
          <!-- Display -->
          <div class="flex items-center justify-center gap-1 border-b border-outline-variant px-4 py-4">
            <button
              type="button"
              class="rounded-lg px-3 py-2 font-mono text-headline-medium transition-colors"
              :class="mode === 'hour' ? 'bg-primary-container text-on-primary-container cursor-default' : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8'"
              @click="mode = 'hour'"
            >
              {{ pad(selectedHour) }}
            </button>
            <span class="text-headline-medium text-on-surface-variant">:</span>
            <button
              type="button"
              class="rounded-lg px-3 py-2 font-mono text-headline-medium transition-colors"
              :class="mode === 'minute' ? 'bg-primary-container text-on-primary-container cursor-default' : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8'"
              @click="mode = 'minute'"
            >
              {{ pad(selectedMinute) }}
            </button>
          </div>

          <!-- Grid -->
          <div class="p-3">
            <div v-if="mode === 'hour'" class="grid grid-cols-6 gap-1">
              <button
                v-for="h in hours"
                :key="h"
                type="button"
                class="flex h-9 cursor-pointer items-center justify-center rounded-full text-body-medium transition-colors duration-100"
                :class="
                  h === selectedHour
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-on-surface/8'
                "
                @click="selectHour(h)"
              >
                {{ pad(h) }}
              </button>
            </div>

            <div v-else class="grid grid-cols-6 gap-1">
              <button
                v-for="m in minutes"
                :key="m"
                type="button"
                class="flex h-9 cursor-pointer items-center justify-center rounded-full text-body-medium transition-colors duration-100"
                :class="
                  m === selectedMinute
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-on-surface/8'
                "
                @click="selectMinute(m)"
              >
                {{ pad(m) }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
