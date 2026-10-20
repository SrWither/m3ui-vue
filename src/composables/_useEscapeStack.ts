import { getCurrentInstance, onBeforeUnmount, watch, type WatchSource } from 'vue'

/*
 * Internal (not exported from index.ts): Escape for stacked modal surfaces. Each MDialog used to listen on document
 * itself, so with a dialog opened over another (a date picker over a form) one Escape closed them all. Open
 * surfaces go on a stack, and one listener hands Escape to the top one only. A persistent dialog on top takes it and
 * does nothing, so the one under it stays.
 */

const stack: (() => void)[] = []

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !stack.length) return
  stack[stack.length - 1]!()
}

/** Calls `onEscape` on Escape while `active`, unless something opened later is on top of it. */
export function useEscapeStack(active: WatchSource<boolean>, onEscape: () => void) {
  const entry = () => onEscape()
  function set(on: boolean) {
    if (typeof document === 'undefined') return
    const i = stack.indexOf(entry)
    if (on && i < 0) {
      stack.push(entry)
      if (stack.length === 1) document.addEventListener('keydown', onKeydown)
    } else if (!on && i >= 0) {
      stack.splice(i, 1)
      if (!stack.length) document.removeEventListener('keydown', onKeydown)
    }
  }
  watch(active, (on) => set(!!on), { immediate: true })
  if (getCurrentInstance()) onBeforeUnmount(() => set(false))
}
