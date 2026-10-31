// The time axis MGantt and MResourceTimeline share: a scroller whose content is a list (sticky, `listWidth` wide)
// beside a timeline. Holds the zoom (px per day, sprung on a log scale, anchored where it zooms), the origin
// (which moves left, keeping the view in place, when something is dragged before it), the header's cells, the days
// off, today, and Ctrl + wheel / pinch zooming.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { DAY, SCALE_PX_PER_DAY, addDays, isWorkingDay, nearestScale, nextUnit, parseDate, startOfDay, unitLabel, unitStarts, unitsFor, type TimeUnit } from './_ganttTime'
import { prefersReducedMotion } from './_springAnimation'

export interface TimeAxisOptions {
  scroller: Ref<HTMLElement | undefined>
  listWidth: ComputedRef<number>
  headerHeight: number
  /** Earliest and latest ms the content spans */
  extent: ComputedRef<{ min: number; max: number }>
  scale: () => TimeUnit
  pxPerDay: () => number | undefined
  minPxPerDay: () => number
  maxPxPerDay: () => number
  weekStartsOn: () => 0 | 1
  lang: ComputedRef<string | undefined>
  quarterLabel: () => string
  today: () => string | null | undefined
  calendar: () => { workingDays?: number[]; holidays?: string[] } | undefined
  /** Working hours shaded as such on hour scales, e.g. [9, 18] */
  workHours?: () => [number, number] | undefined
  onScale: (s: TimeUnit) => void
  /** A pinch began: drop whatever drag was going on */
  onPinch?: () => void
}

export function useTimeAxis(o: TimeAxisOptions) {
  const clamp = (z: number) => Math.min(o.maxPxPerDay(), Math.max(o.minPxPerDay(), z))
  const ppd = ref(clamp(o.pxPerDay() ?? SCALE_PX_PER_DAY[o.scale()]))
  const scaleNow = computed(() => nearestScale(ppd.value))
  let emitted: TimeUnit = scaleNow.value
  watch(scaleNow, (s) => {
    if (s === emitted) return
    emitted = s
    o.onScale(s)
  })
  watch(o.scale, (s) => {
    if (s === emitted) return
    emitted = s
    zoomTo(SCALE_PX_PER_DAY[s])
  })

  const view = ref({ left: 0, top: 0, width: 0, height: 0 })
  const timelineView = computed(() => Math.max(0, view.value.width - o.listWidth.value))

  const nowTick = ref(Date.now())
  let nowTimer: ReturnType<typeof setInterval> | undefined
  const todayMs = computed(() => {
    const t = o.today()
    return t === null ? null : t ? parseDate(t) : nowTick.value
  })

  const padDays = computed(() => Math.max(14, (timelineView.value || 800) / ppd.value))
  const origin = ref(0)
  const span = computed(() => Math.max((o.extent.value.max - origin.value) / DAY + padDays.value, timelineView.value / ppd.value))
  const timelineWidth = computed(() => span.value * ppd.value)
  function updateOrigin() {
    const want = startOfDay(addDays(o.extent.value.min, -Math.ceil(padDays.value)))
    if (!origin.value) { origin.value = want; return }
    // The view keeps its place when the origin moves
    const tooFar = want - origin.value > 3 * padDays.value * DAY
    if (want < origin.value || tooFar) {
      const shift = ((origin.value - want) / DAY) * ppd.value
      origin.value = want
      const el = o.scroller.value
      if (el) {
        el.scrollLeft += shift
        view.value.left = el.scrollLeft
      }
    }
  }
  watch([o.extent, padDays], updateOrigin, { immediate: true })
  const xOf = (ms: number) => ((ms - origin.value) / DAY) * ppd.value
  const timeAt = (x: number) => origin.value + (x / ppd.value) * DAY

  // Zoom around a point of the view (px from the timeline's left edge), sprung on a log scale
  let zoomRaf = 0
  let zoomState: { z: number; v: number; target: number; anchor: number; at: number } | null = null
  function zoomTo(target: number, anchor?: number, animate = true) {
    target = clamp(target)
    const a = anchor ?? timelineView.value / 2
    const at = timeAt(view.value.left + a)
    if (!animate || prefersReducedMotion() || !o.scroller.value) {
      cancelAnimationFrame(zoomRaf)
      zoomRaf = 0
      zoomState = null
      applyZoom(target, a, at)
      return
    }
    zoomState = { z: Math.log(ppd.value), v: zoomState?.v ?? 0, target: Math.log(target), anchor: a, at }
    if (zoomRaf) return
    let last = performance.now()
    const step = (now: number) => {
      const s = zoomState!
      let dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      // Standard DefaultSpatial
      while (dt > 0) {
        const h = Math.min(dt, 0.004)
        s.v += (-700 * (s.z - s.target) - 2 * 0.9 * Math.sqrt(700) * s.v) * h
        s.z += s.v * h
        dt -= h
      }
      const done = Math.abs(s.z - s.target) < 0.001 && Math.abs(s.v) < 0.01
      applyZoom(Math.exp(done ? s.target : s.z), s.anchor, s.at)
      if (done) { zoomRaf = 0; zoomState = null; return }
      zoomRaf = requestAnimationFrame(step)
    }
    zoomRaf = requestAnimationFrame(step)
  }
  function applyZoom(z: number, anchor: number, at: number) {
    ppd.value = z
    updateOrigin()
    const left = Math.max(0, xOf(at) - anchor)
    view.value.left = left
    // After the timeline has its new width
    nextTick(() => { if (o.scroller.value) o.scroller.value.scrollLeft = left })
  }
  const zoomTarget = () => (zoomState ? Math.exp(zoomState.target) : ppd.value)
  const zoomIn = () => zoomTo(zoomTarget() * 1.6)
  const zoomOut = () => zoomTo(zoomTarget() / 1.6)
  const setScale = (s: TimeUnit) => zoomTo(SCALE_PX_PER_DAY[s])
  function scrollToDate(date?: string, opts: { align?: 'start' | 'center'; animate?: boolean } = {}) {
    const ms = date ? parseDate(date) : Date.now()
    const x = xOf(ms) - (opts.align === 'start' ? 24 : timelineView.value / 2)
    o.scroller.value?.scrollTo({ left: Math.max(0, x), behavior: opts.animate === false || prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  // ── Header cells and the background ─────────────────────────────────────────────────────────────────────
  const units = computed(() => unitsFor(ppd.value))
  const visibleFrom = computed(() => timeAt(view.value.left - 200))
  const visibleTo = computed(() => timeAt(view.value.left + timelineView.value + 200))
  function cells(unit: TimeUnit, top: boolean) {
    const step = top ? 1 : units.value.step
    return unitStarts(visibleFrom.value, visibleTo.value, unit, o.weekStartsOn(), step).map((t) => {
      const x = xOf(t)
      const w = xOf(nextUnit(t, unit, step)) - x
      return { key: t, x, w, label: unitLabel(t, unit, w, o.lang.value, o.quarterLabel(), top) }
    })
  }
  const bottomCells = computed(() => cells(units.value.bottom, false))
  const topCells = computed(() => {
    if (!units.value.top) return []
    // Labels stay in view while their cell is partly scrolled away
    return cells(units.value.top, true).map((c) => ({ ...c, labelX: Math.max(0, Math.min(view.value.left - c.x, c.w - 80)) }))
  })
  const calendar = computed(() => ({ days: o.calendar()?.workingDays ?? [1, 2, 3, 4, 5], holidays: new Set(o.calendar()?.holidays ?? []) }))
  /** Shaded spans: days off, and the hours outside `workHours` when zoomed in that far */
  const offTimes = computed(() => {
    const out: { x: number; w: number }[] = []
    if (ppd.value < 6) return out
    const hours = o.workHours?.()
    for (let d = startOfDay(visibleFrom.value); d < visibleTo.value; d = addDays(d, 1)) {
      const next = addDays(d, 1)
      if (!isWorkingDay(d, calendar.value.days, calendar.value.holidays)) out.push({ x: xOf(d), w: xOf(next) - xOf(d) })
      else if (hours && ppd.value >= 120) {
        const a = d + hours[0] * 3_600_000
        const b = d + hours[1] * 3_600_000
        if (hours[0] > 0) out.push({ x: xOf(d), w: xOf(a) - xOf(d) })
        if (hours[1] < 24) out.push({ x: xOf(b), w: xOf(next) - xOf(b) })
      }
    }
    return out
  })

  // ── Wheel and pinch ─────────────────────────────────────────────────────────────────────────────────────
  function onWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const r = o.scroller.value!.getBoundingClientRect()
    const anchor = e.clientX - r.left - o.listWidth.value
    if (anchor < 0) return
    zoomTo(ppd.value * Math.exp(-e.deltaY * 0.002 * (e.deltaMode === 1 ? 16 : 1)), anchor, false)
  }
  let pinch: { dist: number; z: number; anchor: number } | null = null
  const pinching = () => !!pinch
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 2) return
    o.onPinch?.()
    const [a, b] = [e.touches[0]!, e.touches[1]!]
    const r = o.scroller.value!.getBoundingClientRect()
    pinch = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, z: ppd.value, anchor: (a.clientX + b.clientX) / 2 - r.left - o.listWidth.value }
  }
  function pinchMove(e: TouchEvent) {
    if (!pinch || e.touches.length !== 2) return false
    if (e.cancelable) e.preventDefault()
    const [a, b] = [e.touches[0]!, e.touches[1]!]
    zoomTo(pinch.z * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.dist), pinch.anchor, false)
    return true
  }
  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) pinch = null
  }
  function readView() {
    const el = o.scroller.value
    if (el) view.value = { left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, height: el.clientHeight }
  }

  let ro: ResizeObserver | undefined
  onMounted(() => {
    const el = o.scroller.value!
    el.addEventListener('wheel', onWheel, { passive: false })
    readView()
    ro = new ResizeObserver(readView)
    ro.observe(el)
    if (o.today() !== null) nowTimer = setInterval(() => { nowTick.value = Date.now() }, 60_000)
  })
  onBeforeUnmount(() => {
    o.scroller.value?.removeEventListener('wheel', onWheel)
    ro?.disconnect()
    cancelAnimationFrame(zoomRaf)
    clearInterval(nowTimer)
  })

  return {
    ppd, scaleNow, view, timelineView, origin, timelineWidth, todayMs, xOf, timeAt,
    zoomTo, zoomIn, zoomOut, setScale, scrollToDate, units, topCells, bottomCells, offTimes,
    onTouchStart, pinchMove, onTouchEnd, pinching, readView,
  }
}
