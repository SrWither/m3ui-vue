// One canvas over the page shared by the canvas effects (useConfetti, useFireworks): created when the first one
// starts, removed when the last one ends. It never takes pointer events and assistive technology ignores it. Each
// effect is a layer stepped once per frame in one rAF loop, after the canvas has been cleared.

export interface EffectLayer {
  /** Advances and draws one frame (`dt` in seconds, `dpr` the canvas' pixel ratio); false once it has nothing left. */
  step(ctx: CanvasRenderingContext2D, dt: number, dpr: number, now: number): boolean
}

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
const layers = new Set<EffectLayer>()
let raf = 0
let last = 0

function resize() {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
}

function ensureCanvas() {
  if (canvas) return ctx
  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000'
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  if (!ctx) {
    teardown()
    return null
  }
  resize()
  window.addEventListener('resize', resize)
  return ctx
}

function teardown() {
  cancelAnimationFrame(raf)
  raf = 0
  window.removeEventListener('resize', resize)
  canvas?.remove()
  canvas = null
  ctx = null
  layers.clear()
}

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  if (!ctx || !canvas) return teardown()
  const dpr = canvas.width / window.innerWidth
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const layer of layers) {
    ctx.globalAlpha = 1
    if (!layer.step(ctx, dt, dpr, now)) layers.delete(layer)
  }
  if (!layers.size) return teardown()
  raf = requestAnimationFrame(frame)
}

/** Makes sure a layer is drawn (it stays until its `step` returns false). False when there's no 2D canvas. */
export function runLayer(layer: EffectLayer): boolean {
  if (!ensureCanvas()) return false
  layers.add(layer)
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  return true
}

/** Stops every effect and removes the canvas. Internal, for tests. */
export function __resetEffectCanvas() {
  teardown()
}

/** The theme's colors for effects, read at an element (so an MScheme around it gives its scheme's). */
export function themeColors(el: Element, roles: string[]) {
  const style = getComputedStyle(el)
  const colors = roles.map((role) => style.getPropertyValue(`--color-${role}`).trim()).filter(Boolean)
  return colors.length ? colors : ['#6750a4', '#625b71', '#7d5260', '#eaddff', '#ffd8e4']
}

/** Whether the system asks for reduced motion. */
export function reducedMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Where an effect starts: the pointer of an event, an element's center, or a point in viewport pixels */
export type EffectOrigin = MouseEvent | PointerEvent | Element | { x: number; y: number }

/** The point an effect starts from (viewport px) and the element whose theme colors it takes. */
export function originPoint(origin: EffectOrigin | undefined): { x: number; y: number; el: Element } {
  if (origin && 'clientX' in origin) {
    const el = (origin.currentTarget as Element | null) ?? (origin.target as Element | null) ?? document.documentElement
    // A click from the keyboard (Enter, Space) has no pointer position: burst from the element instead
    if (origin.detail === 0 && origin.clientX === 0 && origin.clientY === 0) return originPoint(el)
    return { x: origin.clientX, y: origin.clientY, el }
  }
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: origin }
  }
  if (origin) return { ...origin, el: document.documentElement }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6, el: document.documentElement }
}
