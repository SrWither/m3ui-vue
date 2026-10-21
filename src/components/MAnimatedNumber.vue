<script setup lang="ts">
/**
 * A number, time or duration whose digits roll to their new value on a spring when it changes, like an odometer:
 * each digit rolls on its own (up when the value grows, down when it shrinks) and digits that appear or go away open
 * and close. Numbers are formatted with `Intl.NumberFormat` (currency, percent, units, compact), times with
 * `Intl.DateTimeFormat`, both in the app's language; durations as `h:mm:ss`. Tabular figures. Assistive technology
 * reads the formatted value, not the rolling digits. Not an M3 spec component.
 */
import { computed, onMounted, onUnmounted, onUpdated, watch } from 'vue'
import { useLocale } from '../composables/useLocale'
import { motionSprings, type SpringSpec } from '../composables/motion'

const props = withDefaults(
  defineProps<{
    /** The value: a number, a `Date` for times, or seconds for a duration */
    value: number | Date
    /**
     * `number` (Intl.NumberFormat), `datetime` (Intl.DateTimeFormat; a `Date` or a timestamp) or `duration`
     * (seconds as `h:mm:ss`, hours only when there are some). Defaults to `datetime` for a `Date`, `number` otherwise
     */
    type?: 'number' | 'datetime' | 'duration'
    /**
     * Intl options for the type: `{ style: 'currency', currency: 'EUR' }`, `{ style: 'percent' }`,
     * `{ style: 'unit', unit: 'kilometer-per-hour' }`, `{ notation: 'compact' }` for numbers; `{ timeStyle: 'medium' }`
     * (the default), `{ hour: '2-digit', minute: '2-digit' }`, `{ dateStyle: 'short' }` for times. Unused for durations
     */
    format?: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions
    /** BCP-47 language for the format (`es-AR` for Argentine pesos and separators); defaults to the app's locale */
    locale?: string
    /** The rolling spring; Standard SlowSpatial by default (an unhurried landing, no visible bounce) */
    spring?: SpringSpec
    /** Roll to new values; false (or the system's reduced motion) jumps to them */
    animate?: boolean
  }>(),
  { animate: true },
)

const t = useLocale()
const lang = computed(() => props.locale ?? t.lang)
const kind = computed(() => props.type ?? (props.value instanceof Date ? 'datetime' : 'number'))
const numeric = computed(() => (props.value instanceof Date ? props.value.getTime() : props.value))

type Part = { type: string; value: string }

function durationParts(total: number): Part[] {
  const sign = total < 0 ? '-' : ''
  const s = Math.floor(Math.abs(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const parts: Part[] = []
  if (sign) parts.push({ type: 'minusSign', value: sign })
  if (h) parts.push({ type: 'hour', value: String(h) }, { type: 'literal', value: ':' })
  parts.push(
    { type: 'minute', value: h ? String(m).padStart(2, '0') : String(m) },
    { type: 'literal', value: ':' },
    { type: 'second', value: String(s % 60).padStart(2, '0') },
  )
  return parts
}

const parts = computed<Part[]>(() => {
  if (kind.value === 'duration') return durationParts(numeric.value)
  if (kind.value === 'datetime') {
    const options = (props.format as Intl.DateTimeFormatOptions | undefined) ?? { timeStyle: 'medium' }
    return new Intl.DateTimeFormat(lang.value, options).formatToParts(numeric.value)
  }
  return new Intl.NumberFormat(lang.value, props.format as Intl.NumberFormatOptions | undefined).formatToParts(numeric.value)
})
const text = computed(() => parts.value.map((p) => p.value).join(''))

interface Cell {
  key: string
  char: string
  digit?: number
  /** Digits a column cycles through: 10, or 6 for the tens of minutes and seconds */
  base: number
  /** Roll the short way (hours: 12 → 1 is one step back, not nine forward) */
  shortest: boolean
}

const DATE_DIGITS = new Set(['hour', 'minute', 'second', 'day', 'month', 'year', 'fractionalSecond', 'relatedYear'])

// Number digits are keyed by their place (ones, tens, tenths...), time digits by their field and place within it, so
// each keeps its column, and its spring, as the value changes; everything else by its type and where it sits.
const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  const push = (key: string, ch: string, base = 10, shortest = false) => {
    const digit = Number(ch)
    out.push(ch.trim() && !Number.isNaN(digit) ? { key, char: ch, digit, base, shortest } : { key: `${key}-${ch}`, char: ch, base, shortest })
  }
  if (kind.value === 'number') {
    let place = parts.value.filter((p) => p.type === 'integer').reduce((n, p) => n + p.value.length, 0)
    let fraction = 0
    for (const part of parts.value) {
      if (part.type === 'integer' || part.type === 'fraction') {
        for (const ch of part.value) push(part.type === 'integer' ? `i${--place}` : `f${++fraction}`, ch)
      } else {
        const at = part.type === 'group' ? place : part.type === 'decimal' ? 'd' : out.length
        out.push({ key: `${part.type}-${at}`, char: part.value, base: 10, shortest: false })
      }
    }
    return out
  }
  parts.value.forEach((part, index) => {
    if (!DATE_DIGITS.has(part.type)) {
      out.push({ key: `${part.type}-${index}`, char: part.value, base: 10, shortest: false })
      return
    }
    const chars = [...part.value]
    chars.forEach((ch, i) => {
      const fromRight = chars.length - 1 - i
      const sixty = (part.type === 'minute' || part.type === 'second') && fromRight === 1
      push(`${part.type}-${fromRight}`, ch, sixty ? 6 : 10, part.type === 'hour')
    })
  })
  return out
})

// ── Rolling: one spring per digit column, stepped in a rAF loop and written to its strip's transform ─────────
interface Column { pos: number; vel: number; target: number; base: number; el?: HTMLElement }
const columns = new Map<string, Column>()
let mounted = false
let raf = 0
let last = 0
let direction = 1
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const mod = (n: number, base: number) => ((n % base) + base) % base
const write = (c: Column) => {
  if (!c.el) return
  c.el.style.transform = `translateY(${-mod(c.pos, c.base)}lh)`
  // Unmasked a little before landing, so the mask eases out with the last of the roll
  c.el.parentElement?.toggleAttribute('data-rolling', Math.abs(c.pos - c.target) > 0.15)
}

// The strip's starting transform, set once per column, so the server renders the right digits. Vue may write it
// again when it patches the list (a digit added before it), so onUpdated puts every column back where it is.
const initialStyles = new Map<string, Record<string, string>>()
function initialStyle(cell: Cell) {
  let style = initialStyles.get(cell.key)
  if (!style) {
    // A column that appears after mount rolls in from 0; the first render shows the digits as they are
    const start = mounted && props.animate ? 0 : cell.digit!
    columns.set(cell.key, { pos: start, vel: 0, target: cell.digit!, base: cell.base })
    style = { transform: `translateY(${-start}lh)` }
    initialStyles.set(cell.key, style)
  }
  return style
}
const setStrip = (key: string) => (el: unknown) => {
  const c = columns.get(key)
  if (c) c.el = (el as HTMLElement | null) ?? undefined
}
// Two runs of the column's digits, so a digit rolling past the last shows the first coming in below it seamlessly
const strip = (base: number) => Array.from({ length: base * 2 }, (_, i) => i % base)

function frame(now: number) {
  let dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const { stiffness: k, dampingRatio } = props.spring ?? motionSprings.standard.slowSpatial
  const c = 2 * dampingRatio * Math.sqrt(k)
  let moving = false
  while (dt > 0) {
    const h = Math.min(dt, 0.004)
    dt -= h
    for (const col of columns.values()) {
      col.vel += (-k * (col.pos - col.target) - c * col.vel) * h
      col.pos += col.vel * h
    }
  }
  for (const col of columns.values()) {
    if (Math.abs(col.pos - col.target) < 0.002 && Math.abs(col.vel) < 0.01) {
      col.pos = col.target
      col.vel = 0
    } else moving = true
    write(col)
  }
  raf = moving ? requestAnimationFrame(frame) : 0
}

watch(numeric, (next, prev) => (direction = next >= (prev ?? next) ? 1 : -1))

watch(cells, (next) => {
  const keys = new Set(next.map((c) => c.key))
  for (const key of [...columns.keys()]) {
    if (!keys.has(key)) {
      columns.delete(key)
      initialStyles.delete(key)
    }
  }
  const instant = !props.animate || reduceMotion()
  for (const cell of next) {
    const col = cell.digit === undefined ? undefined : columns.get(cell.key)
    if (!col) continue
    const base = col.base
    const from = mod(Math.round(col.target), base)
    const forward = mod(cell.digit! - from, base)
    const backward = mod(from - cell.digit!, base)
    // Forward through the last digit → 0 when the value grows, backward when it shrinks; hours the short way
    col.target += cell.shortest ? (forward <= backward ? forward : -backward) : direction > 0 ? forward : -backward
    if (instant) {
      col.pos = col.target
      col.vel = 0
      write(col)
    }
  }
  if (!instant && !raf && mounted) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
}, { flush: 'post' })

onMounted(() => {
  mounted = true
  for (const col of columns.values()) write(col)
})
onUpdated(() => {
  for (const col of columns.values()) write(col)
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <span class="m3-animated-number">
    <span class="m3-anum-sr">{{ text }}</span>
    <TransitionGroup name="m3-anum" tag="span" class="m3-anum-cells" aria-hidden="true">
      <span v-for="cell in cells" :key="cell.key" class="m3-anum-cell" :class="cell.digit !== undefined && 'm3-anum-digit'">
        <span v-if="cell.digit !== undefined" :ref="setStrip(cell.key)" class="m3-anum-strip" :style="initialStyle(cell)">
          <span v-for="(d, i) in strip(cell.base)" :key="i">{{ d }}</span>
        </span>
        <template v-else>{{ cell.char }}</template>
      </span>
    </TransitionGroup>
  </span>
</template>

<style>
/* Defaults in the base layer so the consumer's classes on the root win (see MShape). */
@layer base {
  .m3-animated-number {
    display: inline-flex;
    position: relative;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
.m3-anum-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.m3-anum-cells {
  display: inline-flex;
}
.m3-anum-cell {
  display: inline-block;
  white-space: pre;
}
.m3-anum-digit {
  height: 1lh;
  width: 1ch;
  overflow: hidden;
  /* Rolling digits fade at the column's edges. At rest the mask is stretched so its fades fall outside the
     column; it eases in and out instead of switching, which read as an abrupt stop. */
  mask-image: linear-gradient(transparent, #000 20%, #000 80%, transparent);
  mask-size: 100% 180%;
  mask-position: center;
  mask-repeat: no-repeat;
  transition: mask-size 350ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-anum-digit[data-rolling] {
  mask-size: 100% 100%;
  transition-duration: 120ms;
}
.m3-anum-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.m3-anum-strip > span {
  height: 1lh;
}
.m3-anum-enter-active,
.m3-anum-leave-active {
  transition: width 300ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease;
}
.m3-anum-enter-from,
.m3-anum-leave-to {
  width: 0;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .m3-anum-enter-active,
  .m3-anum-leave-active {
    transition: none;
  }
}
</style>
