/*
 * Internal (not exported from index.ts): where the caret of a textarea or input is on screen, to hang a popup from
 * it (MMentionField). A hidden mirror element copies the field's box and text styles and the text up to the caret;
 * a marker span at the end lands where the caret is. Measured afresh on each call, so it follows the field's scroll.
 */

// What decides where text wraps and how big it is
const PROPS = [
  'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
  'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize',
] as const

/** The caret's box in viewport coordinates: `{ left, top, height }`. */
export function caretRect(el: HTMLTextAreaElement | HTMLInputElement, position = el.selectionStart ?? el.value.length) {
  const mirror = document.createElement('div')
  const style = getComputedStyle(el)
  const s = mirror.style
  for (const p of PROPS) s[p] = style[p]
  s.position = 'absolute'
  s.visibility = 'hidden'
  s.top = '0'
  s.left = '-9999px'
  s.whiteSpace = el instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre'
  s.overflowWrap = el instanceof HTMLTextAreaElement ? 'break-word' : 'normal'
  mirror.textContent = el.value.slice(0, position)
  const marker = document.createElement('span')
  // Something with a height even at the end of a line
  marker.textContent = el.value.slice(position) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const box = el.getBoundingClientRect()
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
  // offsetLeft/Top count from inside the mirror's border, and fields may keep room in theirs (MTextField's label)
  const rect = {
    left: box.left + (parseFloat(style.borderLeftWidth) || 0) + marker.offsetLeft - el.scrollLeft,
    top: box.top + (parseFloat(style.borderTopWidth) || 0) + marker.offsetTop - el.scrollTop,
    height: lineHeight,
  }
  mirror.remove()
  return rect
}
