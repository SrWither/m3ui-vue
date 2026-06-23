<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  modelValue: string | null
  show?: boolean
  use24h?: boolean
  minuteStep?: number
  title?: string
}>(), {
  modelValue: null,
  show: false,
  use24h: false,
  minuteStep: 5,
})

const locale = useLocale()
const emit = defineEmits<{
  'update:modelValue': [string | null]
  'update:show': [boolean]
}>()

const step = ref<'hour' | 'minute'>('hour')
const inputMode = ref<'dial' | 'input'>('dial')
const period = ref<'AM' | 'PM'>('AM')
const selectedHour = ref(12)
const selectedMinute = ref(0)
const dialEl = ref<HTMLElement | null>(null)
const inputHourEl = ref<HTMLInputElement | null>(null)
const inputMinuteEl = ref<HTMLInputElement | null>(null)

function pad(n: number) { return String(n).padStart(2, '0') }

function parseTime(t: string | null | undefined) {
  if (!t) return { h: 12, m: 0 }
  const [hh, mm] = t.split(':').map(Number)
  return { h: hh ?? 12, m: mm ?? 0 }
}

watch(() => props.show, (open) => {
  if (open) {
    const { h, m } = parseTime(props.modelValue)
    if (props.use24h) {
      selectedHour.value = h
    } else {
      period.value = h >= 12 ? 'PM' : 'AM'
      selectedHour.value = h % 12 || 12
    }
    selectedMinute.value = m
    step.value = 'hour'
    inputMode.value = 'dial'
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

// ── Dial geometry ──────────────────────────────────────────────────
const SIZE = 256
const CX = SIZE / 2
const OUTER_R = 100
const INNER_R = 64
const NUM_R = 20

function posAt(idx: number, of: number, r: number) {
  const a = (idx / of) * Math.PI * 2 - Math.PI / 2
  return { x: CX + Math.cos(a) * r, y: CX + Math.sin(a) * r }
}

const hourItems = computed(() => {
  const items: { value: number; label: string; x: number; y: number }[] = []
  for (let i = 0; i < 12; i++) {
    const h = i === 0 ? 12 : i
    const p = posAt(i, 12, OUTER_R)
    items.push({ value: h, label: String(h), ...p })
  }
  if (props.use24h) {
    for (let i = 0; i < 12; i++) {
      const h = i === 0 ? 0 : i + 12
      const p = posAt(i, 12, INNER_R)
      items.push({ value: h, label: pad(h), ...p })
    }
  }
  return items
})

const minuteItems = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const m = i * 5
    const p = posAt(i, 12, OUTER_R)
    return { value: m, label: pad(m), ...p }
  }),
)

const handEnd = computed(() => {
  if (step.value === 'hour') {
    const h = selectedHour.value
    const isInner = props.use24h && (h === 0 || h > 12)
    const r = isInner ? INNER_R : OUTER_R
    const a = ((h % 12) / 12) * Math.PI * 2 - Math.PI / 2
    return { x: CX + Math.cos(a) * r, y: CX + Math.sin(a) * r }
  }
  const m = selectedMinute.value
  const a = (m / 60) * Math.PI * 2 - Math.PI / 2
  return { x: CX + Math.cos(a) * OUTER_R, y: CX + Math.sin(a) * OUTER_R }
})

// ── Dial pointer interaction ───────────────────────────────────────
function getDialAngle(e: MouseEvent | Touch) {
  if (!dialEl.value) return null
  const rect = dialEl.value.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  let deg = Math.atan2(x, -y) * (180 / Math.PI)
  if (deg < 0) deg += 360
  const dist = Math.sqrt(x * x + y * y) / (rect.width / 2)
  return { deg, dist }
}

function applyAngle(deg: number, dist: number) {
  if (step.value === 'hour') {
    let h = Math.round(deg / 30) % 12
    if (props.use24h) {
      const isInner = dist < 0.6
      h = isInner ? (h === 0 ? 0 : h + 12) : (h === 0 ? 12 : h)
    } else {
      h = h === 0 ? 12 : h
    }
    selectedHour.value = h
  } else {
    let m = Math.round(deg / 6) % 60
    m = Math.round(m / props.minuteStep) * props.minuteStep
    if (m >= 60) m = 0
    selectedMinute.value = m
  }
}

function onDialDown(e: MouseEvent) {
  e.preventDefault()
  const info = getDialAngle(e)
  if (!info) return
  applyAngle(info.deg, info.dist)

  const onMove = (ev: MouseEvent) => {
    const i = getDialAngle(ev)
    if (i) applyAngle(i.deg, i.dist)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (step.value === 'hour') step.value = 'minute'
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onDialTouch(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  const info = getDialAngle(touch)
  if (!info) return
  applyAngle(info.deg, info.dist)

  const svg = e.currentTarget as Element
  const onMove = (ev: TouchEvent) => {
    const t = ev.touches[0]
    if (!t) return
    const i = getDialAngle(t)
    if (i) applyAngle(i.deg, i.dist)
  }
  const onEnd = () => {
    svg.removeEventListener('touchmove', onMove as EventListener)
    svg.removeEventListener('touchend', onEnd)
    if (step.value === 'hour') step.value = 'minute'
  }
  svg.addEventListener('touchmove', onMove as EventListener, { passive: true })
  svg.addEventListener('touchend', onEnd)
}

function selectHour(h: number) {
  selectedHour.value = h
  step.value = 'minute'
}

// ── Input mode ─────────────────────────────────────────────────────
const inputHour = ref('')
const inputMinute = ref('')

watch(inputMode, (mode) => {
  if (mode === 'input') {
    inputHour.value = pad(selectedHour.value)
    inputMinute.value = pad(selectedMinute.value)
  }
})

function clampInput() {
  let h = parseInt(inputHour.value) || 0
  let m = parseInt(inputMinute.value) || 0
  if (props.use24h) {
    h = Math.max(0, Math.min(23, h))
  } else {
    h = Math.max(1, Math.min(12, h))
  }
  m = Math.max(0, Math.min(59, m))
  m = Math.round(m / props.minuteStep) * props.minuteStep
  if (m >= 60) m = 0
  selectedHour.value = h
  selectedMinute.value = m
  inputHour.value = pad(h)
  inputMinute.value = pad(m)
}

// ── Actions ────────────────────────────────────────────────────────
function cancel() { emit('update:show', false) }

function confirm() {
  if (inputMode.value === 'input') clampInput()
  let h = selectedHour.value
  if (!props.use24h) {
    if (period.value === 'AM') h = h === 12 ? 0 : h
    else h = h === 12 ? 12 : h + 12
  }
  emit('update:modelValue', `${pad(h)}:${pad(selectedMinute.value)}`)
  emit('update:show', false)
}

function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') cancel() }
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-tp-modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="cancel"
      >
        <div class="tp-box w-[328px] rounded-[28px] bg-surface-container-high px-6 pt-6 pb-4 shadow-elevation-3">
          <!-- Title -->
          <p class="mb-5 text-label-medium text-on-surface-variant">
            {{ title || locale.selectTime }}
          </p>

          <!-- ── Dial mode ───────────────────────────────────── -->
          <template v-if="inputMode === 'dial'">
            <!-- Time display + AM/PM -->
            <div class="mb-5 flex items-center justify-center gap-2">
              <button
                type="button"
                class="flex h-[72px] min-w-[96px] items-center justify-center rounded-lg text-display-medium transition-colors"
                :class="
                  step === 'hour'
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-highest text-on-surface cursor-pointer hover:bg-on-surface/8'
                "
                @click="step = 'hour'"
              >
                {{ pad(selectedHour) }}
              </button>

              <span class="text-display-medium text-on-surface">:</span>

              <button
                type="button"
                class="flex h-[72px] min-w-[96px] items-center justify-center rounded-lg text-display-medium transition-colors"
                :class="
                  step === 'minute'
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-highest text-on-surface cursor-pointer hover:bg-on-surface/8'
                "
                @click="step = 'minute'"
              >
                {{ pad(selectedMinute) }}
              </button>

              <!-- AM / PM toggle -->
              <div
                v-if="!use24h"
                class="ml-2 flex h-[72px] flex-col overflow-hidden rounded-lg border border-outline"
              >
                <button
                  type="button"
                  class="flex flex-1 items-center justify-center px-3 text-label-large transition-colors"
                  :class="
                    period === 'AM'
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'text-on-surface-variant hover:bg-on-surface/8'
                  "
                  @click="period = 'AM'"
                >AM</button>
                <div class="h-px bg-outline" />
                <button
                  type="button"
                  class="flex flex-1 items-center justify-center px-3 text-label-large transition-colors"
                  :class="
                    period === 'PM'
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'text-on-surface-variant hover:bg-on-surface/8'
                  "
                  @click="period = 'PM'"
                >PM</button>
              </div>
            </div>

            <!-- Clock dial -->
            <div
              ref="dialEl"
              class="relative mx-auto h-[256px] w-[256px] select-none"
              @mousedown="onDialDown"
              @touchstart.prevent="onDialTouch"
            >
              <div class="absolute inset-0 rounded-full bg-surface-container-highest" />

              <svg class="pointer-events-none absolute inset-0" viewBox="0 0 256 256">
                <line
                  :x1="CX" :y1="CX"
                  :x2="handEnd.x" :y2="handEnd.y"
                  stroke="var(--color-primary)" stroke-width="2"
                />
                <circle :cx="CX" :cy="CX" r="4" fill="var(--color-primary)" />
                <circle :cx="handEnd.x" :cy="handEnd.y" :r="NUM_R" fill="var(--color-primary)" />
              </svg>

              <template v-if="step === 'hour'">
                <button
                  v-for="item in hourItems"
                  :key="'h' + item.value"
                  type="button"
                  class="pointer-events-auto absolute flex h-10 w-10 items-center justify-center rounded-full text-body-medium transition-colors"
                  :class="
                    item.value === selectedHour
                      ? 'text-on-primary font-medium'
                      : 'text-on-surface cursor-pointer'
                  "
                  :style="{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }"
                  @click.stop="selectHour(item.value)"
                >
                  {{ item.label }}
                </button>
              </template>

              <template v-else>
                <button
                  v-for="item in minuteItems"
                  :key="'m' + item.value"
                  type="button"
                  class="pointer-events-auto absolute flex h-10 w-10 items-center justify-center rounded-full text-body-medium transition-colors"
                  :class="
                    item.value === selectedMinute
                      ? 'text-on-primary font-medium'
                      : 'text-on-surface cursor-pointer'
                  "
                  :style="{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }"
                  @click.stop="selectedMinute = item.value"
                >
                  {{ item.label }}
                </button>
              </template>
            </div>
          </template>

          <!-- ── Input mode ──────────────────────────────────── -->
          <div v-else class="mx-auto flex items-center justify-center gap-2 py-8">
            <input
              ref="inputHourEl"
              v-model="inputHour"
              type="text"
              maxlength="2"
              class="h-[72px] w-[96px] rounded-lg border border-outline bg-surface-container-highest text-center text-display-medium text-on-surface outline-none transition-colors focus:border-2 focus:border-primary"
              @blur="clampInput"
            />
            <span class="text-display-medium text-on-surface">:</span>
            <input
              ref="inputMinuteEl"
              v-model="inputMinute"
              type="text"
              maxlength="2"
              class="h-[72px] w-[96px] rounded-lg border border-outline bg-surface-container-highest text-center text-display-medium text-on-surface outline-none transition-colors focus:border-2 focus:border-primary"
              @blur="clampInput"
            />
            <!-- AM / PM toggle -->
            <div
              v-if="!use24h"
              class="ml-2 flex h-[72px] flex-col overflow-hidden rounded-lg border border-outline"
            >
              <button
                type="button"
                class="flex flex-1 items-center justify-center px-3 text-label-large transition-colors"
                :class="
                  period === 'AM'
                    ? 'bg-tertiary-container text-on-tertiary-container'
                    : 'text-on-surface-variant hover:bg-on-surface/8'
                "
                @click="period = 'AM'"
              >AM</button>
              <div class="h-px bg-outline" />
              <button
                type="button"
                class="flex flex-1 items-center justify-center px-3 text-label-large transition-colors"
                :class="
                  period === 'PM'
                    ? 'bg-tertiary-container text-on-tertiary-container'
                    : 'text-on-surface-variant hover:bg-on-surface/8'
                "
                @click="period = 'PM'"
              >PM</button>
            </div>
          </div>

          <!-- Footer -->
          <div class="mt-2 flex items-center justify-between">
            <MIconButton
              :icon="inputMode === 'dial' ? 'keyboard' : 'schedule'"
              :label="inputMode === 'dial' ? 'Switch to keyboard' : 'Switch to dial'"
              @click="inputMode = inputMode === 'dial' ? 'input' : 'dial'"
            />
            <div class="flex gap-2">
              <MButton variant="text" @click="cancel">{{ locale.cancel }}</MButton>
              <MButton variant="text" @click="confirm">OK</MButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-tp-modal-enter-active,
.m3-tp-modal-leave-active {
  transition: opacity 0.15s ease;
}
.m3-tp-modal-enter-from,
.m3-tp-modal-leave-to {
  opacity: 0;
}
.m3-tp-modal-enter-active .tp-box,
.m3-tp-modal-leave-active .tp-box {
  transition: transform 0.15s ease;
}
.m3-tp-modal-enter-from .tp-box,
.m3-tp-modal-leave-to .tp-box {
  transform: scale(0.95);
}
</style>
