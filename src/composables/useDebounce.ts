import { onBeforeUnmount } from 'vue'

export function useDebounce(fn: (...args: any[]) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null

  function debounced(...args: any[]) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, ms)
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  onBeforeUnmount(cancel)

  return { debounced, cancel }
}
