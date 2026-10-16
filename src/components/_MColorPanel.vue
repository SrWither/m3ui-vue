<script setup lang="ts">
/**
 * Internal: the picking UI shared by MColorPicker (in its dropdown) and MColorPickerModal (in its dialog).
 * Saturation/brightness area, hue and opacity sliders, eyedropper, HEX/RGB/HSL fields, recent and preset
 * swatches. Emits on every change; the parent decides when that becomes the real value.
 */
import { computed, onMounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'
import {
  hslToHsv, hsvToHsl, hsvToRgb, inkFor, normalizeHex, parseHex, recentColors, rgbToHsv, toHex, type Rgba,
} from '../composables/_colorUtils'

const props = defineProps<{
  modelValue: string
  presets: string[]
  alpha: boolean
  recent: boolean
  eyedropper: boolean
  /** Shown as the left half of the preview, click to restore */
  original?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()
const t = useLocale()

// ── State: HSV + alpha, kept here so hue survives grays and black ──────────────────────────
const h = ref(0)
const s = ref(100)
const v = ref(100)
const a = ref(1)

const hex = computed(() => toHex(hsvToRgb({ h: h.value, s: s.value, v: v.value }, props.alpha ? a.value : 1)))
const opaqueHex = computed(() => toHex(hsvToRgb({ h: h.value, s: s.value, v: v.value })))
const hueColor = computed(() => `hsl(${h.value}, 100%, 50%)`)

function setFromRgb(c: Rgba) {
  const hsv = rgbToHsv(c)
  // A gray has no hue and black no saturation: keep the ones we had, so the thumbs don't jump
  if (hsv.v > 0 && hsv.s > 0) h.value = hsv.h
  if (hsv.v > 0) s.value = hsv.s
  v.value = hsv.v
  a.value = props.alpha ? c.a : 1
}

let lastEmitted = ''
function commit() {
  lastEmitted = hex.value
  if (hex.value !== normalizeHex(props.modelValue)) emit('update:modelValue', hex.value)
}

watch(() => props.modelValue, (val) => {
  const n = normalizeHex(val)
  if (!n || n === lastEmitted) return
  setFromRgb(parseHex(n)!)
  lastEmitted = n
}, { immediate: true })

function pick(color: string) {
  const c = parseHex(color)
  if (!c) return
  setFromRgb(c)
  commit()
}

// ── Pointer: area and sliders ──────────────────────────────────────────────────────────────
type Target = 'area' | 'hue' | 'alpha'
const areaEl = ref<HTMLElement>()
const hueEl = ref<HTMLElement>()
const alphaEl = ref<HTMLElement>()
const dragging = ref<Target | null>(null)
// The slider handles travel between the centers of the track's round ends (24px track)
const THUMB_INSET = 12

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function update(target: Target, e: PointerEvent) {
  const el = target === 'area' ? areaEl.value : target === 'hue' ? hueEl.value : alphaEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (target === 'area') {
    s.value = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)
    v.value = clamp((1 - (e.clientY - r.top) / r.height) * 100, 0, 100)
  } else {
    const p = clamp((e.clientX - r.left - THUMB_INSET) / (r.width - THUMB_INSET * 2), 0, 1)
    if (target === 'hue') h.value = p * 360
    else a.value = Math.round(p * 100) / 100
  }
  commit()
}

function onPointerDown(target: Target, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).focus({ preventScroll: true })
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  dragging.value = target
  update(target, e)
}
function onPointerMove(target: Target, e: PointerEvent) {
  if (dragging.value === target) update(target, e)
}
function onPointerUp() {
  dragging.value = null
}

// ── Keyboard ───────────────────────────────────────────────────────────────────────────────
function onKeydown(target: Target, e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 1
  const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
  const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0
  if (target === 'area') {
    if (!dx && !dy) return
    s.value = clamp(s.value + dx, 0, 100)
    v.value = clamp(v.value + dy, 0, 100)
  } else {
    const max = target === 'hue' ? 360 : 100
    const cur = target === 'hue' ? h.value : a.value * 100
    let next: number
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = max
    else if (dx || dy) next = clamp(cur + (dx || dy), 0, max)
    else return
    if (target === 'hue') h.value = next
    else a.value = Math.round(next) / 100
  }
  e.preventDefault()
  commit()
}

// ── Eyedropper (Chromium only; the button isn't shown elsewhere) ─────────────────────────────
const canEyedrop = ref(false)
onMounted(() => { canEyedrop.value = 'EyeDropper' in window })

async function pickFromScreen() {
  try {
    const Ctor = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
    const { sRGBHex } = await new Ctor().open()
    const c = parseHex(sRGBHex)
    if (c) { setFromRgb({ ...c, a: a.value }); commit() }
  } catch { /* cancelled */ }
}

// ── Text fields ─────────────────────────────────────────────────────────────────────────────
type Format = 'hex' | 'rgb' | 'hsl'
const formats: { id: Format; label: string }[] = [
  { id: 'hex', label: 'HEX' }, { id: 'rgb', label: 'RGB' }, { id: 'hsl', label: 'HSL' },
]
const format = ref<Format>('hex')
const formatLabel = computed(() => formats.find((f) => f.id === format.value)!.label)
function cycleFormat() {
  format.value = formats[(formats.findIndex((f) => f.id === format.value) + 1) % formats.length]!.id
  editing.value = null
}

interface Field { key: string; label: string; display: string; max: number; apply: (n: number) => void }

function setHsv(next: { h: number; s: number; v: number }) {
  h.value = next.h; s.value = next.s; v.value = next.v
}

const alphaField = computed<Field>(() => ({
  key: 'a', label: 'A', display: String(Math.round(a.value * 100)), max: 100,
  apply: (n) => { a.value = n / 100 },
}))

const fields = computed<Field[]>(() => {
  const list: Field[] = []
  if (format.value === 'rgb') {
    const rgb = hsvToRgb({ h: h.value, s: s.value, v: v.value })
    const round = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b), a: a.value }
    for (const ch of ['r', 'g', 'b'] as const) {
      list.push({
        key: ch, label: ch.toUpperCase(), display: String(round[ch]), max: 255,
        apply: (n) => setFromRgb({ ...round, [ch]: n }),
      })
    }
  } else if (format.value === 'hsl') {
    const hsl = hsvToHsl({ h: h.value, s: s.value, v: v.value })
    const round = { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) }
    for (const ch of ['h', 's', 'l'] as const) {
      list.push({
        key: ch, label: ch.toUpperCase(), display: String(round[ch]), max: ch === 'h' ? 360 : 100,
        // Straight from HSL to HSV, so a hue typed on a gray isn't lost
        apply: (n) => setHsv(hslToHsv({ ...round, [ch]: n })),
      })
    }
  }
  if (props.alpha && format.value !== 'hex') list.push(alphaField.value)
  return list
})

// While a field is focused it shows what the user typed, not the reformatted value
const editing = ref<{ key: string; text: string } | null>(null)
const shown = (key: string, display: string) => (editing.value?.key === key ? editing.value.text : display)

function onHexInput(e: Event) {
  const text = (e.target as HTMLInputElement).value
  editing.value = { key: 'hex', text }
  const c = parseHex(text)
  if (c) { setFromRgb(c); commit() }
}

function onFieldInput(f: Field, e: Event) {
  const text = (e.target as HTMLInputElement).value
  editing.value = { key: f.key, text }
  if (!/^\d+$/.test(text.trim())) return
  const n = Number(text)
  if (n > f.max) return
  f.apply(n)
  commit()
}

function onFieldKeydown(f: Field, e: KeyboardEvent) {
  if (e.key === 'Enter') { editing.value = null; return }
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
  f.apply(clamp(Number(f.display) + step, 0, f.max))
  editing.value = null
  commit()
}

// ── Swatches ────────────────────────────────────────────────────────────────────────────────
const recents = computed(() => (props.recent ? recentColors.value : []))
const isSelected = (color: string) => normalizeHex(color) === hex.value
// Swatches and preview segments paint the color over a checkerboard in one background, so a translucent color
// shows it and the edge is a single antialiased shape (nested clipped layers looked jagged in Firefox)
const CHECKER = 'repeating-conic-gradient(#d4d4d4 0 25%, #fff 0 50%) 0 0 / 8px 8px'
const fill = (color: string) => `linear-gradient(${color}, ${color}), ${CHECKER}`
// Over a mostly transparent color the checkerboard (light) is what's behind the text
const previewInk = computed(() => (a.value < 0.5 ? '#000000' : inkFor(opaqueHex.value)))
const showOriginal = computed(() => !!props.original && !!normalizeHex(props.original) && normalizeHex(props.original) !== hex.value)

defineExpose({ focus: () => areaEl.value?.focus({ preventScroll: true }) })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Saturation (x) / brightness (y) -->
    <div
      ref="areaEl"
      role="slider"
      tabindex="0"
      :aria-label="`${t.colorSaturation}, ${t.colorBrightness}`"
      :aria-valuenow="Math.round(s)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${t.colorSaturation} ${Math.round(s)}%, ${t.colorBrightness} ${Math.round(v)}%`"
      class="relative h-40 w-full shrink-0 cursor-crosshair touch-none rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :style="{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }"
      @pointerdown="onPointerDown('area', $event)"
      @pointermove="onPointerMove('area', $event)"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeydown('area', $event)"
    >
      <span
        class="m3-cp-area-thumb pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-[scale] duration-150"
        :class="dragging === 'area' ? 'scale-125' : ''"
        :style="{ left: `${s}%`, top: `${100 - v}%`, backgroundColor: opaqueHex }"
      />
    </div>

    <!-- Hue / opacity: thick tracks with M3 Expressive's bar handle -->
    <div class="flex flex-col gap-1">
      <div
        ref="hueEl"
        role="slider"
        tabindex="0"
        :aria-label="t.colorHue"
        :aria-valuenow="Math.round(h)"
        aria-valuemin="0"
        aria-valuemax="360"
        class="m3-cp-slider group"
        @pointerdown="onPointerDown('hue', $event)"
        @pointermove="onPointerMove('hue', $event)"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown('hue', $event)"
      >
        <span class="m3-cp-track m3-cp-hue" />
        <span
          class="m3-cp-handle"
          :class="{ 'm3-cp-handle-pressed': dragging === 'hue' }"
          :style="{ left: `calc(${THUMB_INSET}px + ${h / 360} * (100% - ${THUMB_INSET * 2}px))` }"
        />
      </div>
      <div
        v-if="alpha"
        ref="alphaEl"
        role="slider"
        tabindex="0"
        :aria-label="t.colorAlpha"
        :aria-valuenow="Math.round(a * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuetext="`${Math.round(a * 100)}%`"
        class="m3-cp-slider group"
        @pointerdown="onPointerDown('alpha', $event)"
        @pointermove="onPointerMove('alpha', $event)"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown('alpha', $event)"
      >
        <span class="m3-cp-track" :style="{ background: `linear-gradient(to right, transparent, ${opaqueHex}), ${CHECKER}` }" />
        <span
          class="m3-cp-handle"
          :class="{ 'm3-cp-handle-pressed': dragging === 'alpha' }"
          :style="{ left: `calc(${THUMB_INSET}px + ${a} * (100% - ${THUMB_INSET * 2}px))` }"
        />
      </div>
    </div>

    <!-- Preview (original | new) and eyedropper -->
    <div class="flex items-center gap-2">
      <div class="flex h-10 min-w-0 flex-1">
        <button
          v-if="showOriginal"
          type="button"
          class="m3-cp-swatch flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-l-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :style="{ background: fill(original!) }"
          :aria-label="t.colorOriginal"
          :title="t.colorOriginal"
          @click="pick(original!)"
        >
          <MIcon name="undo" :size="18" :style="{ color: inkFor(original!) }" />
        </button>
        <span
          class="m3-cp-swatch flex min-w-0 flex-1 items-center px-4 font-mono text-label-large transition-[border-radius] duration-200"
          :class="showOriginal ? 'rounded-r-full' : 'rounded-full'"
          :style="{ background: fill(hex), color: previewInk }"
        >{{ hex }}</span>
      </div>
      <MIconButton v-if="eyedropper && canEyedrop" icon="colorize" variant="tonal" :label="t.colorEyedropper" @click="pickFromScreen" />
    </div>

    <!-- Format + fields -->
    <div class="flex items-start gap-2">
      <button
        type="button"
        class="flex h-10 shrink-0 cursor-pointer items-center gap-0.5 rounded-full bg-secondary-container pr-2 pl-3 text-label-large text-on-secondary-container outline-none transition-[background-color] duration-150 hover:bg-[color-mix(in_srgb,var(--color-secondary-container),var(--color-on-secondary-container)_8%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="`${t.colorFormat}: ${formatLabel}`"
        @click="cycleFormat"
      >
        {{ formatLabel }}
        <MIcon name="unfold_more" :size="18" />
      </button>
      <input
        v-if="format === 'hex'"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :maxlength="alpha ? 9 : 7"
        aria-label="HEX"
        :value="shown('hex', hex)"
        class="m3-cp-field min-w-0 flex-1 font-mono text-body-medium"
        @input="onHexInput"
        @blur="editing = null"
        @keydown.enter="editing = null"
      />
      <label v-for="f in fields" :key="f.key" class="flex min-w-0 flex-1 flex-col items-center gap-1">
        <input
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :maxlength="3"
          :aria-label="f.label"
          :value="shown(f.key, f.display)"
          class="m3-cp-field w-full font-mono text-body-medium"
          @input="onFieldInput(f, $event)"
          @keydown="onFieldKeydown(f, $event)"
          @blur="editing = null"
        />
        <span class="text-label-small text-on-surface-variant">{{ f.label }}</span>
      </label>
    </div>

    <!-- Swatches: rounded squares that morph into a circle when selected -->
    <template v-for="group in [{ id: 'recent', label: t.colorRecent, colors: recents }, { id: 'presets', label: t.colorPresets, colors: presets }]" :key="group.id">
      <div v-if="group.colors.length" role="group" :aria-label="group.label" class="flex flex-col gap-2">
        <span v-if="recents.length" class="text-label-medium text-on-surface-variant">{{ group.label }}</span>
        <div class="grid grid-cols-7 gap-2">
          <button
            v-for="color in group.colors"
            :key="color"
            type="button"
            class="m3-cp-swatch m3-cp-morph flex aspect-square cursor-pointer items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="{ 'm3-cp-morph-selected': isSelected(color) }"
            :style="{ background: fill(color) }"
            :aria-label="color"
            :aria-pressed="isSelected(color)"
            @click="pick(color)"
          >
            <MIcon v-if="isSelected(color)" name="check" :size="18" :style="{ color: inkFor(color) }" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.m3-cp-hue {
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
}
/* Hairline so white swatches show on light surfaces and black ones on dark */
.m3-cp-swatch {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-on-surface) 12%, transparent);
}
.m3-cp-morph {
  border-radius: 30%;
  transition: border-radius 250ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-cp-morph:hover {
  border-radius: 40%;
}
.m3-cp-morph-selected,
.m3-cp-morph-selected:hover {
  border-radius: 50%;
}
.m3-cp-area-thumb {
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.2), 0 1px 3px 1px rgb(0 0 0 / 0.25);
}
.m3-cp-slider {
  position: relative;
  height: 32px;
  cursor: pointer;
  touch-action: none;
  outline: none;
}
.m3-cp-track {
  position: absolute;
  inset: 4px 0;
  border-radius: 9999px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-on-surface) 12%, transparent);
}
/* After M3 Expressive's slider handle: a bar taller than the track that narrows while pressed */
.m3-cp-handle {
  position: absolute;
  top: 0;
  width: 6px;
  height: 32px;
  translate: -50% 0;
  border-radius: 9999px;
  background: #fff;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.2), 0 1px 3px rgb(0 0 0 / 0.3);
  pointer-events: none;
  transition: width 150ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-cp-handle-pressed {
  width: 4px;
}
.group:focus-visible .m3-cp-handle {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.m3-cp-field {
  height: 40px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-surface-container-highest);
  padding: 0 8px;
  text-align: center;
  color: var(--color-on-surface);
  caret-color: var(--color-primary);
  outline: 2px solid transparent;
  outline-offset: -2px;
  transition: outline-color 150ms;
}
.m3-cp-field:hover {
  outline-color: color-mix(in srgb, var(--color-on-surface) 12%, transparent);
}
.m3-cp-field:focus {
  outline-color: var(--color-primary);
}
</style>
