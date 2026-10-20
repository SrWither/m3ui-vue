/*
 * Internal (not exported from index.ts): keeps a popup on screen along one axis, after Compose's
 * DropdownMenuPositionProvider (material3/internal/MenuPosition.kt). The candidates are tried in order and the
 * first that fits inside the window, MARGIN in from its edges (MenuHorizontalMargin), wins; when none does, a
 * popup wider than the window minus the margins is centered, anything else is clamped inside them.
 *
 * Measure the popup with nothing constraining its width (no `right`, no narrow `left`) before calling this:
 * a fixed element anchored on its right shrinks to the space on its left, which is the very overflow to avoid.
 */

/** Compose's MenuHorizontalMargin (8dp). */
export const POPUP_MARGIN = 8

/** The first candidate start position that keeps `size` inside `viewport`, else centered or clamped. */
export function fitPopup(candidates: number[], size: number, viewport: number, margin = POPUP_MARGIN): number {
  for (const x of candidates) {
    if (x >= margin && x + size <= viewport - margin) return x
  }
  if (size >= viewport - 2 * margin) return (viewport - size) / 2
  const last = candidates[candidates.length - 1] ?? margin
  return Math.min(viewport - margin - size, Math.max(margin, last))
}

/**
 * A dropdown's left edge: aligned with the anchor's start or end edge (`align` picks which is tried first), else
 * against the window edge on the anchor's side (MenuAnchorPosition.Below's xCandidates).
 */
export function dropdownX(
  anchor: { left: number; right: number },
  width: number,
  viewport: number,
  align: 'start' | 'end',
  margin = POPUP_MARGIN,
): number {
  const start = anchor.left
  const end = anchor.right - width
  const windowSide = (anchor.left + anchor.right) / 2 < viewport / 2 ? margin : viewport - margin - width
  return fitPopup(align === 'start' ? [start, end, windowSide] : [end, start, windowSide], width, viewport, margin)
}
