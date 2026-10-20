import { getCurrentInstance, onBeforeUnmount, watch, type WatchSource } from 'vue'

/*
 * Internal (not exported from index.ts): locks the page's scroll (body overflow hidden) while a modal surface is
 * open, shared by every component that does it. Counted, so overlays stacked on each other (a select's modal or a
 * date picker inside an MDialog) release it only when the last one closes: each component used to write
 * `overflow = ''` on its own, so closing the inner one let the page under the outer one scroll again. Each
 * instance also releases what it holds when it unmounts (a dialog removed while open left the page locked for good)
 * and nothing when it holds nothing (a select unmounting inside an open dialog used to unlock it).
 */

let count = 0
let previous = ''

function lock() {
  if (count++ === 0) {
    previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlock() {
  if (count > 0 && --count === 0) document.body.style.overflow = previous
}

/**
 * Locks the page's scroll while `active` is true (from the start too: a dialog mounted open locks it), and releases
 * it when it turns false or the component unmounts. Without `active`, drive it with the returned `set`.
 */
export function useScrollLock(active?: WatchSource<boolean>) {
  let held = false
  function set(on: boolean) {
    if (typeof document === 'undefined' || on === held) return
    held = on
    if (on) lock()
    else unlock()
  }
  if (active) watch(active, (on) => set(!!on), { immediate: true })
  if (getCurrentInstance()) onBeforeUnmount(() => set(false))
  return { set }
}
