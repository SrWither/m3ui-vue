<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  modelValue: string
  show?: boolean
  presets?: string[]
  title?: string
}>(), {
  show: false,
  presets: () => [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
    '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b',
  ],
})

const locale = useLocale()
const emit = defineEmits<{
  'update:modelValue': [string]
  'update:show': [boolean]
}>()

const satBrightEl = ref<HTMLElement>()
const draggingSB = ref(false)
const hue = ref(0)
const sat = ref(100)
const bright = ref(100)
const hexInput = ref('')

function hexToHsv(hex: string) {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c[0]! + c[0]! + c[1]! + c[1]! + c[2]! + c[2]!
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
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
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

const currentHex = computed(() => hsvToHex(hue.value, sat.value, bright.value))
const hueColor = computed(() => `hsl(${hue.value}, 100%, 50%)`)

watch(() => props.show, (open) => {
  if (open) {
    const hsv = hexToHsv(props.modelValue)
    hue.value = hsv.h
    sat.value = hsv.s
    bright.value = hsv.v
    hexInput.value = props.modelValue
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

function syncHex() {
  hexInput.value = currentHex.value
}

// ── Saturation / Brightness ────────────────────────────────────────
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
  syncHex()
}
function updateSB(e: PointerEvent) {
  if (!satBrightEl.value) return
  const rect = satBrightEl.value.getBoundingClientRect()
  sat.value = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  bright.value = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100))
  syncHex()
}

function onHueInput(e: Event) {
  hue.value = Number((e.target as HTMLInputElement).value)
  syncHex()
}

function selectPreset(color: string) {
  const hsv = hexToHsv(color)
  hue.value = hsv.h
  sat.value = hsv.s
  bright.value = hsv.v
  hexInput.value = color
}

function onHexFieldInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  hexInput.value = v
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    const hsv = hexToHsv(v)
    hue.value = hsv.h
    sat.value = hsv.s
    bright.value = hsv.v
  }
}

// ── Actions ────────────────────────────────────────────────────────
function cancel() { emit('update:show', false) }

function confirm() {
  emit('update:modelValue', currentHex.value)
  emit('update:show', false)
}

function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') cancel() }
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-cp-modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="cancel"
      >
        <div class="cp-box w-[328px] rounded-[28px] bg-surface-container-high px-6 pt-6 pb-4 shadow-elevation-3">
          <!-- Header -->
          <div class="mb-4 flex items-center gap-3">
            <span
              class="h-10 w-10 shrink-0 rounded-full border border-outline-variant"
              :style="{ backgroundColor: currentHex }"
            />
            <div>
              <p class="text-label-medium text-on-surface-variant">
                {{ title || 'Select color' }}
              </p>
              <p class="font-mono text-title-medium text-on-surface">{{ currentHex }}</p>
            </div>
          </div>

          <!-- Saturation / Brightness area -->
          <div
            ref="satBrightEl"
            class="relative mb-3 h-44 w-full cursor-crosshair overflow-hidden rounded-lg"
            :style="{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }"
            @pointerdown="onSBPointerDown"
            @pointermove="onSBPointerMove"
            @pointerup="onSBPointerUp"
          >
            <div
              class="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-elevation-1"
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

          <!-- Hex input -->
          <div class="mb-3">
            <input
              type="text"
              :value="hexInput"
              maxlength="7"
              class="w-full rounded-sm border border-outline bg-transparent px-3 py-2 font-mono text-body-medium text-on-surface outline-none transition-colors focus:border-primary"
              @input="onHexFieldInput"
            />
          </div>

          <!-- Presets -->
          <div class="mb-4 flex flex-wrap gap-1.5">
            <button
              v-for="color in presets"
              :key="color"
              type="button"
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-transform duration-100 hover:scale-110"
              :class="color === currentHex ? 'border-on-surface' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              @click="selectPreset(color)"
            >
              <MIcon v-if="color === currentHex" name="check" :size="14" class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
            </button>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-2">
            <MButton variant="text" @click="cancel">{{ locale.cancel }}</MButton>
            <MButton variant="text" @click="confirm">OK</MButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
.m3-cp-modal-enter-active,
.m3-cp-modal-leave-active {
  transition: opacity 0.15s ease;
}
.m3-cp-modal-enter-from,
.m3-cp-modal-leave-to {
  opacity: 0;
}
.m3-cp-modal-enter-active .cp-box,
.m3-cp-modal-leave-active .cp-box {
  transition: transform 0.15s ease;
}
.m3-cp-modal-enter-from .cp-box,
.m3-cp-modal-leave-to .cp-box {
  transform: scale(0.95);
}
</style>
