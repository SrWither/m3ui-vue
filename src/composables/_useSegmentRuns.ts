/**
 * Internal (not exported from index.ts): where each item of a segmented list sits in its run, for
 * SegmentedListItem's segmentedShapes(index, count). A run is consecutive `role="listitem"` children of `el`;
 * anything else (a subheader, an MListGroup) ends it. Used by MList and by MListGroup for its own items.
 */
import { onMounted, onUnmounted, shallowRef, type Ref } from 'vue'

export type SegmentPosition = 'single' | 'first' | 'middle' | 'last'

export function useSegmentRuns(el: Ref<HTMLElement | undefined>) {
  const positions = shallowRef(new Map<Element, SegmentPosition>())

  function measure() {
    const map = new Map<Element, SegmentPosition>()
    let run: Element[] = []
    const flush = () => {
      run.forEach((item, i) => map.set(item, run.length === 1 ? 'single' : i === 0 ? 'first' : i === run.length - 1 ? 'last' : 'middle'))
      run = []
    }
    for (const child of el.value?.children ?? []) {
      if (child.getAttribute('role') === 'listitem') run.push(child)
      else flush()
    }
    flush()
    positions.value = map
  }

  let observer: MutationObserver | undefined
  onMounted(() => {
    measure()
    if (el.value) {
      observer = new MutationObserver(measure)
      observer.observe(el.value, { childList: true })
    }
  })
  onUnmounted(() => observer?.disconnect())

  return (item: Element | null | undefined) => (item ? positions.value.get(item) : undefined)
}
