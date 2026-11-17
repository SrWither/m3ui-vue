<script lang="ts">
/** Marked regions of an `MBodyMap`: region id → level (1…levels). Regions not in the record are unmarked. */
export type BodyMapValue = Record<string, number>

/** A region of the body map, as passed to `select` and the `region` slot. */
export interface BodyRegion {
  /** e.g. "head", "shoulder-right", "back-calf-left" */
  id: string
  /** Translated name, e.g. "Shoulder, right" */
  label: string
  view: 'front' | 'back'
}
</script>

<script setup lang="ts">
/**
 * A body silhouette, front and back, with regions to mark: where it hurts, an injury, a rash, a tattoo, the site of
 * an injection. Each tap moves a region one level up (with `levels` > 1, e.g. mild → moderate → severe) and back to
 * unmarked. Sides are the patient's: on the front view their right is on the viewer's left.
 *
 * Region ids: `head`, `neck`, `chest-right`, `abdomen`, `pelvis`, `shoulder-left`, `upper-arm-right`,
 * `forearm-left`, `hand-right`, `thigh-left`, `knee-right`, `leg-left`, `foot-right`; on the back view the same
 * prefixed with `back-` (`back-head`, `back-shoulder-left`…) plus `back-upper-back-right`, `back-lower-back`,
 * `back-glute-left`, `back-calf-right`.
 *
 * @slot legend Replaces the levels legend. Slot props: `{ levels, colors, labels }`
 * @event update:modelValue The marked regions — powers v-model
 * @event select A region changed: `{ id, label, view, level }` (level 0 = cleared)
 */
import { computed } from 'vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Marked regions: id → level (v-model) */
    modelValue?: BodyMapValue
    /** Levels a region cycles through. 1 = a plain on/off selection */
    levels?: number
    /** Color of each level (any CSS color). Defaults to a ramp from the error container to the error color */
    levelColors?: string[]
    /** Names of the levels, shown in the legend, e.g. ['Mild', 'Moderate', 'Severe'] */
    levelLabels?: string[]
    /** Which side(s) of the body to draw */
    view?: 'front' | 'back' | 'both'
    /** Region ids that can't be marked */
    disabledRegions?: string[]
    /** Shows the marks but doesn't change them */
    readonly?: boolean
  }>(),
  {
    modelValue: () => ({}),
    levels: 1,
    view: 'both',
    disabledRegions: () => [],
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [BodyMapValue]
  select: [BodyRegion & { level: number }]
}>()

type Part =
  | 'Head' | 'Neck' | 'Chest' | 'Abdomen' | 'Pelvis' | 'Shoulder' | 'UpperArm' | 'Forearm' | 'Hand'
  | 'Thigh' | 'Knee' | 'Leg' | 'Foot' | 'UpperBack' | 'LowerBack' | 'Glute' | 'Calf'

type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number; r: number } | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

/** Shapes on the viewer's left half (x < 100), mirrored for the other side; `mid` shapes sit on the center line */
interface Piece { front: Part; back: Part; shape: Shape; mid?: boolean }

const R = (x: number, y: number, w: number, h: number, r: number): Shape => ({ kind: 'rect', x, y, w, h, r })
const E = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: 'ellipse', cx, cy, rx, ry })

const PIECES: Piece[] = [
  { front: 'Head', back: 'Head', shape: E(100, 30, 19, 23), mid: true },
  { front: 'Neck', back: 'Neck', shape: R(91, 55, 18, 11, 4), mid: true },
  { front: 'Shoulder', back: 'Shoulder', shape: E(67, 78, 13, 11) },
  { front: 'Chest', back: 'UpperBack', shape: R(79, 68, 20.5, 47, 6) },
  { front: 'Abdomen', back: 'LowerBack', shape: R(79, 117, 42, 46, 6), mid: true },
  { front: 'UpperArm', back: 'UpperArm', shape: R(53, 91, 17, 58, 8) },
  { front: 'Forearm', back: 'Forearm', shape: R(49, 151, 16, 58, 7) },
  { front: 'Hand', back: 'Hand', shape: E(56, 223, 9, 13) },
  { front: 'Thigh', back: 'Thigh', shape: R(80, 197, 19, 86, 8) },
  { front: 'Knee', back: 'Knee', shape: E(89.5, 293, 9, 9) },
  { front: 'Leg', back: 'Calf', shape: R(81, 304, 17, 78, 7) },
  { front: 'Foot', back: 'Foot', shape: E(87, 394, 10, 7) },
]
// The pelvis is one piece on the front and two buttocks on the back
const PELVIS_FRONT: Shape = R(79, 165, 42, 30, 8)
const GLUTE: Shape = R(79, 165, 20.5, 30, 8)

/** Parts that only exist on the back, so their name needs no "(back)" */
const BACK_ONLY: Part[] = ['UpperBack', 'LowerBack', 'Glute', 'Calf']

function mirror(s: Shape): Shape {
  return s.kind === 'rect' ? { ...s, x: 200 - s.x - s.w } : { ...s, cx: 200 - s.cx }
}

const kebab = (p: Part) => p.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

interface Region extends BodyRegion { shape: Shape }

function partLabel(part: Part, side: 'right' | 'left' | null, view: 'front' | 'back') {
  let name = locale[`body${part}` as keyof typeof locale] as string
  if (side) name = (side === 'right' ? locale.bodyRight : locale.bodyLeft).replace('{part}', name)
  if (view === 'back' && !BACK_ONLY.includes(part)) name = locale.bodyRear.replace('{part}', name)
  return name
}

function region(view: 'front' | 'back', part: Part, side: 'right' | 'left' | null, shape: Shape): Region {
  const id = `${view === 'back' ? 'back-' : ''}${kebab(part)}${side ? `-${side}` : ''}`
  return { id, view, shape, label: partLabel(part, side, view) }
}

function build(view: 'front' | 'back'): Region[] {
  const out: Region[] = []
  // Front: the viewer's left is the patient's right. Back: the viewer's left is the patient's left
  const leftSide = view === 'front' ? 'right' : 'left'
  const rightSide = view === 'front' ? 'left' : 'right'
  for (const p of PIECES) {
    const part = view === 'front' ? p.front : p.back
    if (p.mid) out.push(region(view, part, null, p.shape))
    else {
      out.push(region(view, part, leftSide, p.shape))
      out.push(region(view, part, rightSide, mirror(p.shape)))
    }
  }
  if (view === 'front') out.push(region(view, 'Pelvis', null, PELVIS_FRONT))
  else {
    out.push(region(view, 'Glute', leftSide, GLUTE))
    out.push(region(view, 'Glute', rightSide, mirror(GLUTE)))
  }
  return out
}

const views = computed(() => {
  const v: { key: 'front' | 'back'; label: string; regions: Region[] }[] = []
  if (props.view !== 'back') v.push({ key: 'front', label: locale.bodyFront, regions: build('front') })
  if (props.view !== 'front') v.push({ key: 'back', label: locale.bodyBack, regions: build('back') })
  return v
})

const colors = computed(() =>
  Array.from({ length: props.levels }, (_, i) =>
    props.levelColors?.[i] ??
    (props.levels === 1
      ? 'var(--color-error)'
      : // from the error container (mildest) to the error color (worst): far apart in both themes
        `color-mix(in srgb, var(--color-error) ${Math.round((100 * i) / (props.levels - 1))}%, var(--color-error-container))`),
  ),
)

function levelOf(id: string) {
  return Math.min(props.levels, Math.max(0, props.modelValue[id] ?? 0))
}

function disabled(id: string) {
  return props.readonly || props.disabledRegions.includes(id)
}

function setLevel(r: Region, level: number) {
  if (disabled(r.id)) return
  const next = { ...props.modelValue }
  if (level > 0) next[r.id] = level
  else delete next[r.id]
  emit('update:modelValue', next)
  emit('select', { id: r.id, label: r.label, view: r.view, level })
}

function cycle(r: Region) {
  setLevel(r, (levelOf(r.id) + 1) % (props.levels + 1))
}

function onKeydown(e: KeyboardEvent, r: Region) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    cycle(r)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    setLevel(r, 0)
  } else if (/^[0-9]$/.test(e.key) && Number(e.key) <= props.levels) {
    e.preventDefault()
    setLevel(r, Number(e.key))
  }
}

function ariaLabel(r: Region) {
  const l = levelOf(r.id)
  if (!l || props.levels === 1) return r.label
  return `${r.label}: ${props.levelLabels?.[l - 1] ?? l}`
}

const showLegend = computed(() => props.levels > 1 || !!props.levelLabels?.length)
</script>

<template>
  <div class="m3-body-map flex flex-col items-center gap-3 text-on-surface">
    <div class="flex w-full justify-center gap-4">
      <figure v-for="v in views" :key="v.key" class="flex min-w-0 max-w-56 flex-1 flex-col items-center gap-1">
        <svg viewBox="0 0 200 410" class="block w-full" role="group" :aria-label="v.label" :data-view="v.key">
          <template v-for="r in v.regions" :key="r.id">
            <component
              :is="r.shape.kind"
              v-bind="r.shape.kind === 'rect'
                ? { x: r.shape.x, y: r.shape.y, width: r.shape.w, height: r.shape.h, rx: r.shape.r }
                : { cx: r.shape.cx, cy: r.shape.cy, rx: r.shape.rx, ry: r.shape.ry }"
              class="m3-body-map__region"
              :class="{ 'is-disabled': disabled(r.id) }"
              :style="levelOf(r.id) ? { fill: colors[levelOf(r.id) - 1] } : undefined"
              :tabindex="disabled(r.id) ? -1 : 0"
              role="checkbox"
              :aria-checked="levelOf(r.id) > 0"
              :aria-label="ariaLabel(r)"
              :aria-disabled="disabled(r.id) || undefined"
              :data-region="r.id"
              :data-level="levelOf(r.id) || undefined"
              @click="cycle(r)"
              @keydown="onKeydown($event, r)"
            >
              <title>{{ ariaLabel(r) }}</title>
            </component>
          </template>
        </svg>
        <figcaption v-if="view === 'both'" class="text-label-large text-on-surface-variant">{{ v.label }}</figcaption>
      </figure>
    </div>

    <div v-if="showLegend" class="flex flex-wrap justify-center gap-x-4 gap-y-1" data-legend>
      <slot name="legend" :levels="levels" :colors="colors" :labels="levelLabels">
        <span v-for="(c, i) in colors" :key="i" class="flex items-center gap-1.5 text-label-large">
          <span class="h-3 w-3 rounded-full" :style="{ background: c }" />
          {{ levelLabels?.[i] ?? i + 1 }}
        </span>
      </slot>
    </div>
  </div>
</template>

<style>
.m3-body-map__region {
  fill: var(--color-surface-container-highest);
  stroke: var(--color-outline-variant);
  stroke-width: 1;
  cursor: pointer;
  outline: none;
  transition: fill 150ms ease;
}
.m3-body-map__region:not(.is-disabled):not([data-level]):hover {
  fill: color-mix(in srgb, var(--color-on-surface) 12%, var(--color-surface-container-highest));
}
.m3-body-map__region[data-level]:hover {
  filter: brightness(1.08);
}
.m3-body-map__region:focus-visible {
  stroke: var(--color-secondary);
  stroke-width: 3;
}
.m3-body-map__region.is-disabled {
  cursor: default;
  opacity: 0.4;
}
</style>
