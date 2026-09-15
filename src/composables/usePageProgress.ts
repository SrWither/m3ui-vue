import { ref } from 'vue'

const progress = ref(0)
const isActive = ref(false)

let hideTimer: ReturnType<typeof setTimeout> | null = null
let trickleTimer: ReturnType<typeof setInterval> | null = null

function clearTimers() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (trickleTimer) { clearInterval(trickleTimer); trickleTimer = null }
}

/** Starts (or restarts) the bar and trickles it toward 90% while the real work finishes. */
function start() {
  clearTimers()
  isActive.value = true
  progress.value = 5

  trickleTimer = setInterval(() => {
    if (progress.value < 90) progress.value += (90 - progress.value) * 0.1
  }, 200)
}

/** Sets an explicit percentage, for callers that know real progress (e.g. an upload). */
function set(pct: number) {
  clearTimers()
  isActive.value = true
  progress.value = Math.min(100, Math.max(0, pct))
}

/** Completes the bar and fades it out. */
function done() {
  clearTimers()
  progress.value = 100
  hideTimer = setTimeout(() => {
    isActive.value = false
    progress.value = 0
  }, 200)
}

/**
 * Shared page-loading progress state (e.g. for a top progress bar between route
 * navigations). Module-level so any number of callers/components stay in sync —
 * call `start()`/`done()` from a router guard, a fetch wrapper, or by hand.
 */
export function usePageProgress() {
  return { progress, isActive, start, set, done }
}
