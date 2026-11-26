/*
 * The layout behind MDashboardGrid, as pure functions: items on a grid of `columns`, in whole cells. Moving or
 * resizing one pushes whatever it lands on downward, then everything floats up to fill gaps (vertical compaction).
 * Static items never move and others flow around them. Usable on their own (server-side layouts, tests).
 */

/** A widget's place on the grid, in cells. */
export interface DashboardItem {
  id: string | number
  /** Column, from 0 */
  x: number
  /** Row, from 0 */
  y: number
  /** Width in columns */
  w: number
  /** Height in rows */
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  /** Never moves or resizes, and others flow around it */
  static?: boolean
}

const overlaps = (a: DashboardItem, b: DashboardItem) =>
  a.id !== b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const clone = (layout: DashboardItem[]) => layout.map((i) => ({ ...i }))

/** Keeps an item inside the columns and its size limits. */
export function clampItem(item: DashboardItem, columns: number): DashboardItem {
  const w = Math.max(item.minW ?? 1, Math.min(item.maxW ?? columns, columns, Math.round(item.w)))
  const h = Math.max(item.minH ?? 1, Math.min(item.maxH ?? Infinity, Math.round(item.h)))
  return { ...item, w, h, x: Math.max(0, Math.min(columns - w, Math.round(item.x))), y: Math.max(0, Math.round(item.y)) }
}

/** Floats every movable item up as far as it goes, top to bottom (static ones stay). */
export function compactLayout(layout: DashboardItem[]): DashboardItem[] {
  const out = clone(layout)
  const placed: DashboardItem[] = out.filter((i) => i.static)
  const order = out.filter((i) => !i.static).sort((a, b) => a.y - b.y || a.x - b.x)
  for (const item of order) {
    item.y = 0
    // Down until it fits
    while (placed.some((p) => overlaps(item, p))) item.y++
    placed.push(item)
  }
  return out
}

/** Pushes items overlapping `moved` down below it, recursively (the moved one keeps its place). */
function pushDown(layout: DashboardItem[], moved: DashboardItem) {
  for (const other of layout) {
    if (other.id === moved.id || !overlaps(moved, other)) continue
    if (other.static) {
      // A static item can't move: the moved one goes below it instead
      moved.y = other.y + other.h
      pushDown(layout, moved)
      return
    }
    other.y = moved.y + moved.h
    pushDown(layout, other)
  }
}

/** The layout with one item moved and/or resized, the rest pushed out of the way and compacted. */
export function moveItem(layout: DashboardItem[], id: DashboardItem['id'], next: Partial<Pick<DashboardItem, 'x' | 'y' | 'w' | 'h'>>, columns: number): DashboardItem[] {
  const out = clone(layout)
  const item = out.find((i) => i.id === id)
  if (!item || item.static) return compactLayout(out)
  Object.assign(item, clampItem({ ...item, ...next }, columns))
  // Others in its way go below it, in reading order so the result is stable
  out.sort((a, b) => a.y - b.y || a.x - b.x)
  pushDown(out, item)
  // Compact, but keep the moved item where it was dropped if nothing is above it to fill
  const compacted = compactLayout(out)
  return layout.map((orig) => compacted.find((i) => i.id === orig.id)!)
}

/** A layout made valid: clamped to the columns, no overlaps, compacted. */
export function normalizeLayout(layout: DashboardItem[], columns: number): DashboardItem[] {
  let out = layout.map((i) => clampItem(i, columns))
  for (const item of [...out].sort((a, b) => a.y - b.y || a.x - b.x)) {
    out = out.map((i) => (i.id === item.id ? item : i))
    const current = out.find((i) => i.id === item.id)!
    const fixed = out.filter((i) => i.id !== item.id)
    while (fixed.some((o) => overlaps(current, o) && (o.y < current.y || (o.y === current.y && o.x < current.x) || o.static))) current.y++
  }
  return layout.map((orig) => compactLayout(out).find((i) => i.id === orig.id)!)
}

/** How many rows the layout takes. */
export const layoutRows = (layout: DashboardItem[]) => layout.reduce((n, i) => Math.max(n, i.y + i.h), 0)
