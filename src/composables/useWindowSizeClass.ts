import { computed, onMounted, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { isHydrating } from './_hydration'

/*
 * M3 window size classes, with the breakpoints from androidx `WindowSizeClass`
 * (window-core: WIDTH_DP_MEDIUM_LOWER_BOUND 600, EXPANDED 840, LARGE 1200, EXTRA_LARGE 1600;
 * HEIGHT_DP_MEDIUM_LOWER_BOUND 480, EXPANDED 900). CSS px stand in for dp.
 */
export type WidthSizeClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extra-large'
export type HeightSizeClass = 'compact' | 'medium' | 'expanded'

export function widthSizeClass(width: number): WidthSizeClass {
  if (width < 600) return 'compact'
  if (width < 840) return 'medium'
  if (width < 1200) return 'expanded'
  if (width < 1600) return 'large'
  return 'extra-large'
}

export function heightSizeClass(height: number): HeightSizeClass {
  if (height < 480) return 'compact'
  if (height < 900) return 'medium'
  return 'expanded'
}

export interface WindowSizeClassInfo {
  width: Ref<number>
  height: Ref<number>
  widthClass: Ref<WidthSizeClass>
  heightClass: Ref<HeightSizeClass>
}

// Window mode shares one `resize` listener across every caller (same ref-counting as useDevice).
const winWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth)
const winHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight)
let winListeners = 0
function updateWindow() {
  winWidth.value = window.innerWidth
  winHeight.value = window.innerHeight
}

/**
 * The M3 width/height size classes, reactive.
 *
 * With no argument it tracks the browser window. Pass an element (ref or getter) to classify
 * that element's own size instead, which is what the adaptive layout components do, so they
 * adapt to the space they actually get (a column, a dialog, a resizable panel).
 */
export function useWindowSizeClass(target?: MaybeRefOrGetter<HTMLElement | null | undefined>): WindowSizeClassInfo {
  let width: Ref<number>
  let height: Ref<number>
  // Hydrating server-rendered HTML: start from the server's size (none, so compact) to match it, then measure
  const hydrating = isHydrating()

  if (target === undefined) {
    if (hydrating) {
      const mounted = ref(false)
      onMounted(() => { mounted.value = true })
      width = computed(() => (mounted.value ? winWidth.value : 0)) as Ref<number>
      height = computed(() => (mounted.value ? winHeight.value : 0)) as Ref<number>
    } else {
      width = winWidth
      height = winHeight
    }
    onMounted(() => {
      if (winListeners++ === 0) {
        updateWindow()
        window.addEventListener('resize', updateWindow)
      }
    })
    onUnmounted(() => {
      if (--winListeners === 0) window.removeEventListener('resize', updateWindow)
    })
  } else {
    // Until the element is measured, guess from the window so the first paint is usually right.
    width = ref(hydrating ? 0 : winWidth.value)
    height = ref(hydrating ? 0 : winHeight.value)
    let observer: ResizeObserver | undefined
    const observe = (el: HTMLElement | null | undefined) => {
      observer?.disconnect()
      if (!el || typeof ResizeObserver === 'undefined') return
      width.value = el.offsetWidth
      height.value = el.offsetHeight
      // offsetWidth/Height (border box), so padding on the element counts like it does for the window.
      observer = new ResizeObserver(() => {
        width.value = el.offsetWidth
        height.value = el.offsetHeight
      })
      observer.observe(el)
    }
    onMounted(() => {
      watch(() => toValue(target), observe, { immediate: true })
    })
    onUnmounted(() => observer?.disconnect())
  }

  return {
    width,
    height,
    widthClass: computed(() => widthSizeClass(width.value)),
    heightClass: computed(() => heightSizeClass(height.value)),
  }
}
