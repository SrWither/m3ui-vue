<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  presets?: string[]
  disabled?: boolean
  error?: string
  hint?: string
  fieldBg?: string
}>(), {
  presets: () => [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
    '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b',
  ],
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const dropPos = ref({ top: '0px', left: '0px' })
const { resolvedFieldBg } = useFieldBg(triggerEl, () => props.fieldBg)

const satBrightEl = ref<HTMLElement>()
const draggingSB = ref(false)

// HSV state
const hue = ref(0)
const sat = ref(100)
const bright = ref(100)

function hexToHsv(hex: string) {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c[0]!+c[0]!+c[1]!+c[1]!+c[2]!+c[2]!
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100
  return { h, s, v }
}

function hsvToHex(h: number, s: number, v: number) {
  s /= 100; v /= 100
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function syncFromProp() {
  const hsv = hexToHsv(props.modelValue)
  hue.value = hsv.h
  sat.value = hsv.s
  bright.value = hsv.v
}
syncFromProp()

watch(() => props.modelValue, syncFromProp)

function emitColor() {
  emit('update:modelValue', hsvToHex(hue.value, sat.value, bright.value))
}

const currentHex = computed(() => hsvToHex(hue.value, sat.value, bright.value))
const hueColor = computed(() => `hsl(${hue.value}, 100%, 50%)`)

function onSBPointerDown(e: PointerEvent) {
  draggingSB.value = true
  updateSB(e)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onSBPointerMove(e: PointerEvent) {
  if (!draggingSB.value) return
  updateSB(e)
}
function onSBPointerUp() {
  draggingSB.value = false
  emitColor()
}
function updateSB(e: PointerEvent) {
  if (!satBrightEl.value) return
  const rect = satBrightEl.value.getBoundingClientRect()
  sat.value = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  bright.value = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100))
}

function onHueInput(e: Event) {
  hue.value = Number((e.target as HTMLInputElement).value)
  emitColor()
}

function selectPreset(color: string) {
  emit('update:modelValue', color)
}

function onHexInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    emit('update:modelValue', v)
  }
}

function computeDropPos() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  const panelH = 380
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
  open.value = false
}

watch(open, (v) => {
  if (v) {
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
        class="flex h-14 w-full items-center gap-3 rounded-sm border bg-transparent px-4 text-left text-body-large transition-[border-color,border-width] duration-150"
        :class="[
          disabled ? 'pointer-events-none opacity-[0.38]' : 'cursor-pointer',
          open
            ? error ? 'border-2 border-error' : 'border-2 border-primary'
            : error ? 'border-error' : 'border-outline hover:border-on-surface',
        ]"
        @click="!disabled && (open = !open)"
      >
        <span
          class="h-6 w-6 shrink-0 rounded-full border border-outline-variant"
          :style="{ backgroundColor: modelValue }"
        />
        <span class="flex-1 font-mono text-on-surface">{{ modelValue }}</span>
        <MIcon name="palette" :size="20" class="shrink-0 text-on-surface-variant" />
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
          class="fixed z-500 w-[280px] rounded-lg bg-surface-container p-4 shadow-elevation-3"
          :style="dropPos"
        >
          <!-- Saturation / Brightness area -->
          <div
            ref="satBrightEl"
            class="relative mb-3 h-40 w-full cursor-crosshair overflow-hidden rounded-lg"
            :style="{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`, touchAction: 'none' }"
            @pointerdown="onSBPointerDown"
            @pointermove="onSBPointerMove"
            @pointerup="onSBPointerUp"
          >
            <div
              class="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-elevation-1"
              :style="{
                left: `${sat}%`,
                top: `${100 - bright}%`,
                backgroundColor: currentHex,
              }"
            />
          </div>

          <!-- Hue slider -->
          <div class="mb-3">
            <input
              type="range"
              min="0"
              max="360"
              :value="hue"
              class="hue-slider h-3 w-full cursor-pointer appearance-none rounded-full outline-none"
              @input="onHueInput"
            />
          </div>

          <!-- Preview + hex input -->
          <div class="mb-3 flex items-center gap-3">
            <span
              class="h-9 w-9 shrink-0 rounded-full border border-outline-variant"
              :style="{ backgroundColor: currentHex }"
            />
            <input
              type="text"
              :value="modelValue"
              maxlength="7"
              class="flex-1 rounded-sm border border-outline bg-transparent px-3 py-2 font-mono text-body-medium text-on-surface outline-none transition-colors focus:border-primary"
              @input="onHexInput"
            />
          </div>

          <!-- Presets -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="color in presets"
              :key="color"
              type="button"
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-transform duration-100 hover:scale-110"
              :class="color === modelValue ? 'border-on-surface' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              @click="selectPreset(color)"
            >
              <MIcon v-if="color === modelValue" name="check" :size="14" class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.hue-slider {
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
}
.hue-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  cursor: pointer;
}
.hue-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  border: none;
  cursor: pointer;
}
</style>
