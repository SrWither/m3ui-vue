<script lang="ts">
export type ToothSurface = 'mesial' | 'distal' | 'buccal' | 'lingual' | 'occlusal'

/** The chart of one tooth: a condition per surface, and conditions of the whole tooth. */
export interface ToothState {
  surfaces?: Partial<Record<ToothSurface, string>>
  conditions?: string[]
}

/** Teeth by number (in the chosen numbering) → their state. */
export type OdontogramValue = Record<string, ToothState>

/**
 * Something to chart. `surface` conditions paint one face (caries, a filling); `tooth` conditions mark the whole
 * tooth. The built-in tooth keys `missing`, `extraction`, `crown`, `rootCanal` and `implant` get their own drawing;
 * any other tooth key outlines the tooth in its color.
 */
export interface OdontogramCondition {
  key: string
  label: string
  color: string
  scope: 'surface' | 'tooth'
}
</script>

<script setup lang="ts">
/**
 * A dental chart: every tooth with its five surfaces (mesial, distal, buccal, lingual, occlusal) and whole-tooth
 * conditions (missing, to extract, crown, root canal, implant). Pick a condition in the toolbar, then tap a surface
 * or a tooth number to chart it; tapping again removes it. FDI or Universal numbering, permanent or primary teeth.
 *
 * Keyboard: each tooth is one tab stop; arrows move between teeth, M / D / B / L / O chart that surface with a
 * surface condition, Enter charts a tooth condition, Delete clears the tooth.
 *
 * @slot toolbar Replaces the condition picker. Slot props: `{ conditions, tool, setTool }`
 * @event update:modelValue The chart — powers v-model
 * @event update:tool The condition picked — powers v-model:tool
 * @event change A tooth changed: `{ tooth, surface?, condition }` (condition null = cleared)
 */
import { computed, nextTick, ref } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { vRipple } from '../directives/vRipple'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** The chart (v-model) */
    modelValue?: OdontogramValue
    /** Condition picked in the toolbar, or "eraser" (v-model:tool) */
    tool?: string
    /** Conditions offered. Defaults to caries, filling, sealant, crown, root canal, implant, missing and to extract */
    conditions?: OdontogramCondition[]
    /** Tooth numbering: FDI two-digit (11–48) or Universal (1–32, A–T for primary teeth) */
    numbering?: 'fdi' | 'universal'
    /** Adult (32) or primary (20) teeth */
    dentition?: 'permanent' | 'primary'
    /** Hides the condition picker (e.g. when the app draws its own) */
    hideToolbar?: boolean
    /** Shows the chart but doesn't change it */
    readonly?: boolean
  }>(),
  {
    modelValue: () => ({}),
    tool: undefined,
    numbering: 'fdi',
    dentition: 'permanent',
    hideToolbar: false,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [OdontogramValue]
  'update:tool': [string]
  change: [{ tooth: string; surface?: ToothSurface; condition: string | null }]
}>()

const defaultConditions = computed<OdontogramCondition[]>(() => [
  { key: 'caries', label: locale.odontoCaries, color: 'var(--color-error)', scope: 'surface' },
  { key: 'filling', label: locale.odontoFilling, color: 'var(--color-primary)', scope: 'surface' },
  { key: 'sealant', label: locale.odontoSealant, color: 'var(--color-tertiary)', scope: 'surface' },
  { key: 'crown', label: locale.odontoCrown, color: 'var(--color-primary)', scope: 'tooth' },
  { key: 'rootCanal', label: locale.odontoRootCanal, color: 'var(--color-secondary)', scope: 'tooth' },
  { key: 'implant', label: locale.odontoImplant, color: 'var(--color-tertiary)', scope: 'tooth' },
  { key: 'missing', label: locale.odontoMissing, color: 'var(--color-on-surface-variant)', scope: 'tooth' },
  { key: 'extraction', label: locale.odontoExtraction, color: 'var(--color-error)', scope: 'tooth' },
])
const conds = computed(() => props.conditions ?? defaultConditions.value)
const condMap = computed(() => new Map(conds.value.map((c) => [c.key, c])))

const innerTool = ref(props.tool ?? conds.value[0]?.key ?? 'eraser')
const tool = computed(() => props.tool ?? innerTool.value)
function setTool(k: string) {
  innerTool.value = k
  emit('update:tool', k)
}
const toolCond = computed(() => condMap.value.get(tool.value))

// ── teeth, in chart order (viewer's left to right) ──
interface Tooth { fdi: number; label: string; upper: boolean; /** patient's right = viewer's left */ right: boolean }

const UNIVERSAL_PRIMARY = 'ABCDEFGHIJKLMNOPQRST'

function universal(fdi: number) {
  const q = Math.floor(fdi / 10)
  const n = fdi % 10
  if (q <= 4) {
    // 1 = upper right third molar … 16 = upper left; 17 = lower left third molar … 32 = lower right
    if (q === 1) return String(9 - n)
    if (q === 2) return String(8 + n)
    if (q === 3) return String(25 - n)
    return String(24 + n)
  }
  if (q === 5) return UNIVERSAL_PRIMARY[5 - n]!
  if (q === 6) return UNIVERSAL_PRIMARY[4 + n]!
  if (q === 7) return UNIVERSAL_PRIMARY[15 - n]!
  return UNIVERSAL_PRIMARY[14 + n]!
}

const rows = computed(() => {
  const count = props.dentition === 'primary' ? 5 : 8
  const [qUR, qUL, qLL, qLR] = props.dentition === 'primary' ? [5, 6, 7, 8] : [1, 2, 3, 4]
  const make = (q: number, n: number, upper: boolean, right: boolean): Tooth => {
    const fdi = q * 10 + n
    return { fdi, label: props.numbering === 'fdi' ? String(fdi) : universal(fdi), upper, right }
  }
  const seq = (from: number) => Array.from({ length: count }, (_, i) => from - i)
  const upper = [
    ...seq(count).map((n) => make(qUR!, n, true, true)),
    ...seq(count).reverse().map((n) => make(qUL!, n, true, false)),
  ]
  const lower = [
    ...seq(count).map((n) => make(qLR!, n, false, true)),
    ...seq(count).reverse().map((n) => make(qLL!, n, false, false)),
  ]
  return [upper, lower]
})
const allTeeth = computed(() => rows.value.flat())

// ── geometry: a 40×40 box per tooth, 4 trapezoids around a center square ──
const BOX = 40
const GAP = 6
const MID = 14
const ROOT = 16
const LABEL = 16
type Side = 'top' | 'bottom' | 'left' | 'right' | 'center'
const POLY: Record<Exclude<Side, 'center'>, string> = {
  top: '0,0 40,0 28,12 12,12',
  bottom: '0,40 40,40 28,28 12,28',
  left: '0,0 12,12 12,28 0,40',
  right: '40,0 28,12 28,28 40,40',
}

/** Which surface each side of the box is, for this tooth */
function surfaceAt(t: Tooth, side: Side): ToothSurface {
  if (side === 'center') return 'occlusal'
  if (side === 'top') return t.upper ? 'buccal' : 'lingual'
  if (side === 'bottom') return t.upper ? 'lingual' : 'buccal'
  // Mesial faces the midline
  const towardMid = t.right ? 'right' : 'left'
  return side === towardMid ? 'mesial' : 'distal'
}

const perRow = computed(() => rows.value[0]!.length)
const width = computed(() => perRow.value * (BOX + GAP) - GAP + MID)
const rowH = BOX + ROOT + LABEL
const height = rowH * 2 + 20

function xOf(i: number) {
  return i * (BOX + GAP) + (i >= perRow.value / 2 ? MID : 0)
}
/** Box top for a row: upper roots go up (above the box), lower roots go down */
function yOf(upper: boolean) {
  return upper ? ROOT + LABEL : rowH + 20
}

const surfaceLabels = computed<Record<ToothSurface, string>>(() => ({
  mesial: locale.odontoMesial,
  distal: locale.odontoDistal,
  buccal: locale.odontoBuccal,
  lingual: locale.odontoLingual,
  occlusal: locale.odontoOcclusal,
}))

// ── state ──
function state(t: Tooth): ToothState {
  return props.modelValue[t.label] ?? {}
}
function surfaceColor(t: Tooth, s: ToothSurface) {
  const k = state(t).surfaces?.[s]
  return k ? condMap.value.get(k)?.color : undefined
}
function has(t: Tooth, k: string) {
  return state(t).conditions?.includes(k) ?? false
}
const customToothConds = (t: Tooth) =>
  (state(t).conditions ?? []).filter((k) => !['missing', 'extraction', 'crown', 'rootCanal', 'implant'].includes(k))

function commit(t: Tooth, next: ToothState) {
  const v = { ...props.modelValue }
  const clean: ToothState = {}
  if (next.surfaces && Object.keys(next.surfaces).length) clean.surfaces = next.surfaces
  if (next.conditions?.length) clean.conditions = next.conditions
  if (clean.surfaces || clean.conditions) v[t.label] = clean
  else delete v[t.label]
  emit('update:modelValue', v)
}

function applySurface(t: Tooth, s: ToothSurface) {
  if (props.readonly) return
  const cur = state(t)
  const surfaces = { ...cur.surfaces }
  let condition: string | null
  if (tool.value === 'eraser' || surfaces[s] === tool.value) {
    delete surfaces[s]
    condition = null
  } else if (toolCond.value?.scope === 'surface') {
    surfaces[s] = tool.value
    condition = tool.value
  } else {
    // A whole-tooth tool clicked on a surface charts the tooth
    return applyTooth(t)
  }
  commit(t, { ...cur, surfaces })
  emit('change', { tooth: t.label, surface: s, condition })
}

function applyTooth(t: Tooth) {
  if (props.readonly) return
  const cur = state(t)
  if (tool.value === 'eraser') {
    commit(t, {})
    emit('change', { tooth: t.label, condition: null })
    return
  }
  if (toolCond.value?.scope !== 'tooth') return
  const list = cur.conditions ?? []
  const on = list.includes(tool.value)
  commit(t, { ...cur, conditions: on ? list.filter((k) => k !== tool.value) : [...list, tool.value] })
  emit('change', { tooth: t.label, condition: on ? null : tool.value })
}

// ── keyboard ──
const focusIdx = ref(0)
const rootEl = ref<HTMLElement | null>(null)
const KEY_SURFACE: Record<string, ToothSurface> = { m: 'mesial', d: 'distal', b: 'buccal', v: 'buccal', l: 'lingual', p: 'lingual', o: 'occlusal', i: 'occlusal' }

async function onKeydown(e: KeyboardEvent, idx: number) {
  const t = allTeeth.value[idx]!
  const n = perRow.value
  let next: number | null = null
  if (e.key === 'ArrowRight') next = Math.min(allTeeth.value.length - 1, idx + 1)
  else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1)
  else if (e.key === 'ArrowDown') next = idx < n ? idx + n : idx
  else if (e.key === 'ArrowUp') next = idx >= n ? idx - n : idx
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    applyTooth(t)
    return
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    if (!props.readonly) {
      commit(t, {})
      emit('change', { tooth: t.label, condition: null })
    }
    return
  } else if (KEY_SURFACE[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    applySurface(t, KEY_SURFACE[e.key.toLowerCase()]!)
    return
  }
  if (next === null) return
  e.preventDefault()
  focusIdx.value = next
  await nextTick()
  rootEl.value?.querySelector<SVGElement>(`[data-tooth-index="${next}"]`)?.focus()
}

function toothLabel(t: Tooth) {
  const st = state(t)
  const parts = [locale.odontoTooth.replace('{n}', t.label)]
  for (const k of st.conditions ?? []) parts.push(condMap.value.get(k)?.label ?? k)
  for (const [s, k] of Object.entries(st.surfaces ?? {})) parts.push(`${surfaceLabels.value[s as ToothSurface]}: ${condMap.value.get(k!)?.label ?? k}`)
  return parts.join(', ')
}

const SIDES: Exclude<Side, 'center'>[] = ['top', 'bottom', 'left', 'right']
</script>

<template>
  <div ref="rootEl" class="m3-odontogram flex flex-col gap-3 text-on-surface">
    <div v-if="!hideToolbar" class="flex flex-wrap gap-2" role="radiogroup" data-toolbar>
      <slot name="toolbar" :conditions="conds" :tool="tool" :set-tool="setTool">
        <button
          v-for="c in conds"
          :key="c.key"
          v-ripple
          type="button"
          role="radio"
          :aria-checked="tool === c.key"
          class="relative flex h-8 items-center gap-2 overflow-hidden rounded-sm border px-3 text-label-large transition-colors"
          :class="tool === c.key ? 'border-transparent bg-secondary-container text-on-secondary-container' : 'border-outline-variant text-on-surface-variant'"
          :disabled="readonly"
          :data-tool="c.key"
          @click="setTool(c.key)"
        >
          <span class="h-3 w-3 shrink-0" :class="c.scope === 'surface' ? 'rounded-[2px]' : 'rounded-full border-2 bg-transparent'" :style="c.scope === 'surface' ? { background: c.color } : { borderColor: c.color }" />
          {{ c.label }}
        </button>
        <button
          v-ripple
          type="button"
          role="radio"
          :aria-checked="tool === 'eraser'"
          class="relative flex h-8 items-center gap-1 overflow-hidden rounded-sm border px-3 text-label-large transition-colors"
          :class="tool === 'eraser' ? 'border-transparent bg-secondary-container text-on-secondary-container' : 'border-outline-variant text-on-surface-variant'"
          :disabled="readonly"
          data-tool="eraser"
          @click="setTool('eraser')"
        >
          <MIcon name="ink_eraser" :size="18" />{{ locale.odontoEraser }}
        </button>
      </slot>
    </div>

    <div class="overflow-x-auto">
      <svg :viewBox="`-2 0 ${width + 4} ${height}`" class="block w-full min-w-[34rem]" role="grid">
        <line :x1="width / 2" :x2="width / 2" y1="0" :y2="height" class="stroke-outline-variant" stroke-dasharray="4 4" />
        <line x1="0" :x2="width" :y1="rowH + 10" :y2="rowH + 10" class="stroke-outline-variant" stroke-dasharray="4 4" />

        <g v-for="(row, ri) in rows" :key="ri" role="row" :aria-label="ri === 0 ? locale.odontoUpper : locale.odontoLower">
          <g
            v-for="(t, ti) in row"
            :key="t.fdi"
            role="gridcell"
            class="m3-odontogram__tooth"
            :class="{ 'is-missing': has(t, 'missing') }"
            :transform="`translate(${xOf(ti)} ${yOf(t.upper)})`"
            :tabindex="ri * row.length + ti === focusIdx ? 0 : -1"
            :aria-label="toothLabel(t)"
            :data-tooth="t.label"
            :data-tooth-index="ri * row.length + ti"
            @focus="focusIdx = ri * row.length + ti"
            @keydown="onKeydown($event, ri * row.length + ti)"
          >
            <!-- root: drawn when a root condition is charted -->
            <g :transform="t.upper ? `translate(0 ${-ROOT})` : `translate(0 ${BOX})`">
              <path
                v-if="has(t, 'implant')"
                :d="t.upper ? 'M14 16 L16 2 H24 L26 16 Z' : 'M14 0 L16 14 H24 L26 0 Z'"
                :fill="condMap.get('implant')?.color"
                data-mark="implant"
              />
              <g v-if="has(t, 'implant')" class="stroke-surface" stroke-width="1.5">
                <line x1="15" x2="25" :y1="t.upper ? 6 : 4" :y2="t.upper ? 6 : 4" />
                <line x1="15" x2="25" :y1="t.upper ? 10 : 8" :y2="t.upper ? 10 : 8" />
                <line x1="15" x2="25" :y1="t.upper ? 14 : 12" :y2="t.upper ? 14 : 12" />
              </g>
              <line
                v-if="has(t, 'rootCanal')"
                x1="20"
                x2="20"
                :y1="t.upper ? 1 : 0"
                :y2="t.upper ? 16 : 15"
                :stroke="condMap.get('rootCanal')?.color"
                stroke-width="4"
                stroke-linecap="round"
                data-mark="rootCanal"
              />
            </g>

            <polygon
              v-for="s in SIDES"
              :key="s"
              :points="POLY[s]"
              class="m3-odontogram__surface"
              :style="surfaceColor(t, surfaceAt(t, s)) ? { fill: surfaceColor(t, surfaceAt(t, s)) } : undefined"
              :data-surface="surfaceAt(t, s)"
              @click="applySurface(t, surfaceAt(t, s))"
            >
              <title>{{ locale.odontoTooth.replace('{n}', t.label) }} · {{ surfaceLabels[surfaceAt(t, s)] }}</title>
            </polygon>
            <rect
              x="12"
              y="12"
              width="16"
              height="16"
              class="m3-odontogram__surface"
              :style="surfaceColor(t, 'occlusal') ? { fill: surfaceColor(t, 'occlusal') } : undefined"
              data-surface="occlusal"
              @click="applySurface(t, 'occlusal')"
            >
              <title>{{ locale.odontoTooth.replace('{n}', t.label) }} · {{ surfaceLabels.occlusal }}</title>
            </rect>

            <circle v-if="has(t, 'crown')" cx="20" cy="20" r="23" fill="none" :stroke="condMap.get('crown')?.color" stroke-width="2.5" pointer-events="none" data-mark="crown" />
            <rect
              v-for="(k, ki) in customToothConds(t)"
              :key="k"
              :x="-2 - ki * 3"
              :y="-2 - ki * 3"
              :width="44 + ki * 6"
              :height="44 + ki * 6"
              rx="3"
              fill="none"
              :stroke="condMap.get(k)?.color"
              stroke-width="2"
              pointer-events="none"
            />
            <g v-if="has(t, 'missing') || has(t, 'extraction')" pointer-events="none" stroke-width="3" stroke-linecap="round" :data-mark="has(t, 'extraction') ? 'extraction' : 'missing'">
              <line x1="2" y1="2" x2="38" y2="38" :stroke="condMap.get(has(t, 'extraction') ? 'extraction' : 'missing')?.color" />
              <line x1="38" y1="2" x2="2" y2="38" :stroke="condMap.get(has(t, 'extraction') ? 'extraction' : 'missing')?.color" />
            </g>

            <!-- number: a button for whole-tooth conditions -->
            <g
              class="m3-odontogram__number cursor-pointer"
              :transform="t.upper ? `translate(0 ${-ROOT - LABEL})` : `translate(0 ${BOX + ROOT})`"
              data-number
              @click="applyTooth(t)"
            >
              <rect x="4" y="1" width="32" height="14" rx="7" class="m3-odontogram__number-bg" />
              <text x="20" y="12" text-anchor="middle" class="fill-on-surface-variant text-[10px] font-medium">{{ t.label }}</text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<style>
.m3-odontogram__surface {
  fill: var(--color-surface-container-lowest);
  stroke: var(--color-outline);
  stroke-width: 1;
  cursor: pointer;
  transition: fill 120ms ease;
}
.m3-odontogram__surface:hover {
  fill: color-mix(in srgb, var(--color-on-surface) 10%, var(--color-surface-container-lowest));
}
.m3-odontogram__tooth {
  outline: none;
}
.m3-odontogram__tooth.is-missing .m3-odontogram__surface {
  opacity: 0.35;
}
.m3-odontogram__tooth:focus-visible .m3-odontogram__number-bg {
  fill: var(--color-secondary-container);
  stroke: var(--color-secondary);
  stroke-width: 2;
}
.m3-odontogram__number-bg {
  fill: transparent;
}
.m3-odontogram__number:hover .m3-odontogram__number-bg {
  fill: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}
</style>
