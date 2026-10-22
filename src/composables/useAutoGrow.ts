import { getCurrentInstance, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter, type WatchSource } from 'vue'

export interface AutoGrowOptions {
  /** Fewest rows it shrinks to (default 1) */
  minRows?: MaybeRefOrGetter<number | undefined>
  /** Most rows it grows to; past them it scrolls. Unset grows without limit */
  maxRows?: MaybeRefOrGetter<number | undefined>
  /**
   * The text, when it can change without typing (cleared after sending, an emoji inserted…): a ref or getter, so the
   * height follows. Typing is followed on its own
   */
  value?: WatchSource<unknown>
}

/**
 * Makes a `<textarea>` grow with its text, between `minRows` and `maxRows` rows, scrolling past the last one: a chat
 * composer, a comment box. Works on any textarea, styled however you like (rows are measured from its computed line
 * height, padding and border). It also follows width changes, which rewrap the text. Returns `resize()` for anything
 * else that changes the text.
 */
export function useAutoGrow(target: MaybeRefOrGetter<HTMLTextAreaElement | null | undefined>, options: AutoGrowOptions = {}) {
  let el: HTMLTextAreaElement | null = null
  let observer: ResizeObserver | null = null
  let lastWidth = 0

  function resize() {
    if (!el) return
    const cs = getComputedStyle(el)
    const px = (v: string) => parseFloat(v) || 0
    // `normal` line height has no number: about 1.5× the font size
    const lineHeight = px(cs.lineHeight) || px(cs.fontSize) * 1.5 || 24
    const padding = px(cs.paddingTop) + px(cs.paddingBottom)
    const border = cs.boxSizing === 'border-box' ? px(cs.borderTopWidth) + px(cs.borderBottomWidth) : 0
    const extra = (cs.boxSizing === 'border-box' ? padding : 0) + border
    const min = (toValue(options.minRows) ?? 1) * lineHeight + extra
    const maxRows = toValue(options.maxRows)
    const max = maxRows ? maxRows * lineHeight + extra : Infinity

    // Collapse first so scrollHeight measures the text, not the current height
    el.style.height = 'auto'
    const content = el.scrollHeight + border + (cs.boxSizing === 'border-box' ? 0 : -padding)
    const height = Math.min(max, Math.max(min, content))
    el.style.height = `${height}px`
    el.style.overflowY = content > max ? 'auto' : 'hidden'
  }

  function attach(next: HTMLTextAreaElement | null | undefined) {
    if (el) {
      el.removeEventListener('input', resize)
      observer?.disconnect()
      // Released (autoGrow turned off, another element): back to its own height
      el.style.height = ''
      el.style.overflowY = ''
    }
    el = next ?? null
    if (!el) return
    el.addEventListener('input', resize)
    if (typeof ResizeObserver !== 'undefined') {
      // Only width changes rewrap the text; our own height writes would otherwise loop
      observer ??= new ResizeObserver(([entry]) => {
        const w = entry!.contentRect.width
        if (w !== lastWidth) {
          lastWidth = w
          resize()
        }
      })
      observer.observe(el)
    }
    resize()
  }

  watch(() => toValue(target), attach, { immediate: true, flush: 'post' })
  watch([() => toValue(options.minRows), () => toValue(options.maxRows)], () => resize(), { flush: 'post' })
  if (options.value) watch(options.value, () => resize(), { flush: 'post' })
  if (getCurrentInstance()) onBeforeUnmount(() => attach(null))

  return { resize }
}
