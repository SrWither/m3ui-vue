import type { Directive } from 'vue'

/**
 * Shared layout of the M3 text-field shell (internal, not exported from the package).
 *
 * Every field draws the same pieces: a 56px box, a label that floats from the middle of the box to its top
 * edge (filled) or onto the border (outlined), an optional leading icon and trailing buttons. The rules that
 * keep long content from running over those pieces live here, so a new field gets them by reusing this:
 *
 * - The label is inset from the right by as much as the box's own right padding (`right`), so it never runs
 *   under a trailing button, floated (filled) or not. Floated on an outlined border, it shrinks to its own
 *   text but stops 12px before the far corner, whatever its left offset (a leading icon moves it to 44px).
 * - A value shown as text in a fixed-height box (`FIELD_VALUE`) stays on one line and ends in "…", and
 *   `vOverflowTitle` puts the whole of it in a tooltip only when it's cut. Screen readers get the full text
 *   either way: the ellipsis is only visual.
 */

export type FieldVariant = 'filled' | 'outlined'

/**
 * Right inset of the label, which must equal the field's right padding: `right-4` with nothing trailing,
 * `right-10` with a dropdown arrow, `right-12` with one trailing button, `right-16` with a clear button and
 * an arrow, `right-24` with two 32px buttons (MNumberField's stepper).
 */
export type FieldRightInset = 'right-4' | 'right-10' | 'right-12' | 'right-16' | 'right-24'

/** Padding matching each inset, for the box itself */
export const FIELD_PADDING_RIGHT: Record<FieldRightInset, string> = {
  'right-4': 'pr-4',
  'right-10': 'pr-10',
  'right-12': 'pr-12',
  'right-16': 'pr-16',
  'right-24': 'pr-24',
}

/** One line, cut with "…", allowed to shrink inside its flex row */
export const FIELD_VALUE = 'block min-w-0 flex-1 truncate'

export interface FieldLabelOptions {
  variant: FieldVariant
  /** There is a leading icon (the label starts after it) */
  leading?: boolean
  right: FieldRightInset
  /**
   * `true`/`false` when the component knows whether the label floats; `'peer'` to float it with CSS from
   * the preceding `.peer` input (focused, or its `placeholder=" "` not shown because it has a value)
   */
  floated: boolean | 'peer'
  /** Color classes (they depend on each component's notion of focus / error / disabled) */
  color: string
}

export function fieldLabelClasses(o: FieldLabelOptions): string {
  const outlined = o.variant === 'outlined'
  const left = o.leading ? (outlined ? 'left-11' : 'left-12') : outlined ? 'left-3' : 'left-4'
  const base = ['pointer-events-none absolute truncate transition-all duration-200', left, o.right]
  const rest = outlined ? 'top-1/2 -translate-y-1/2 text-body-large' : 'top-[53%] -translate-y-1/2 text-body-large'

  if (o.floated === 'peer') {
    // Literal class names (Tailwind only sees complete strings)
    const floatedPeer = outlined
      ? o.leading
        ? 'peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-label-small peer-focus:right-auto peer-focus:max-w-[calc(100%-3.5rem)] peer-focus:bg-[var(--field-bg)] peer-focus:px-1 ' +
          'peer-[&:not(:placeholder-shown)]:-top-2.5 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-label-small peer-[&:not(:placeholder-shown)]:right-auto peer-[&:not(:placeholder-shown)]:max-w-[calc(100%-3.5rem)] peer-[&:not(:placeholder-shown)]:bg-[var(--field-bg)] peer-[&:not(:placeholder-shown)]:px-1'
        : 'peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-label-small peer-focus:right-auto peer-focus:max-w-[calc(100%-1.5rem)] peer-focus:bg-[var(--field-bg)] peer-focus:px-1 ' +
          'peer-[&:not(:placeholder-shown)]:-top-2.5 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-label-small peer-[&:not(:placeholder-shown)]:right-auto peer-[&:not(:placeholder-shown)]:max-w-[calc(100%-1.5rem)] peer-[&:not(:placeholder-shown)]:bg-[var(--field-bg)] peer-[&:not(:placeholder-shown)]:px-1'
      : 'peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-label-small ' +
        'peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-label-small'
    return [...base, rest, floatedPeer, o.color].join(' ')
  }

  const floated = outlined
    ? `-top-2.5 translate-y-0 text-label-small bg-[var(--field-bg)] px-1 right-auto ${o.leading ? 'max-w-[calc(100%-3.5rem)]' : 'max-w-[calc(100%-1.5rem)]'}`
    : 'top-2 translate-y-0 text-label-small'
  return [...base, o.floated ? floated : rest, o.color].join(' ')
}

/** A label always floated on an outlined border (the picker triggers): cut before the far corner */
export const OUTLINED_FLOATED_LABEL =
  'pointer-events-none absolute -top-2.5 left-3 max-w-[calc(100%-1.5rem)] truncate bg-(--field-bg) px-1 text-label-small'

function fullText(el: HTMLElement): string {
  // By tag, not instanceof: the element may come from another realm (an iframe, a test DOM)
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
    ? (el as HTMLInputElement).value
    : (el.textContent ?? '').trim()
}

function updateTitle(el: HTMLElement) {
  const cut = el.scrollWidth > el.clientWidth
  const text = cut ? fullText(el) : ''
  if (text) el.title = text
  else el.removeAttribute('title')
}

const hoverHandlers = new WeakMap<HTMLElement, () => void>()

/**
 * Puts the element's whole text (an input's value, or its text content) in `title` while it's cut by
 * overflow, measured when the pointer comes in, so a value that fits gets no redundant tooltip.
 */
export const vOverflowTitle: Directive<HTMLElement> = {
  mounted(el) {
    const handler = () => updateTitle(el)
    hoverHandlers.set(el, handler)
    el.addEventListener('pointerenter', handler)
  },
  updated(el) {
    // A value changed while hovered: keep the tooltip in step
    if (el.hasAttribute('title')) updateTitle(el)
  },
  beforeUnmount(el) {
    const handler = hoverHandlers.get(el)
    if (handler) el.removeEventListener('pointerenter', handler)
    hoverHandlers.delete(el)
  },
}
