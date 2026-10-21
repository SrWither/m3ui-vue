<script setup lang="ts" generic="T = unknown">
/**
 * Material's container transform: an element (a card, a list item, an image, a FAB…) grows into an expanded view
 * and shrinks back into it, morphing its bounds and shape while its content fades into the new one. The expanded
 * view opens over the page, full screen, as a centered panel, or wherever your classes put it (`custom`), with a
 * scrim (optional), Escape and scroll lock; focus goes to it and back to the element on close. A port of Android's
 * MaterialContainerTransform, played on the compositor. For elements that live apart from the expanded view (a grid
 * of cards, one detail), pass a `useContainerTransform()` controller instead of the default slot.
 *
 * @slot default The element that opens it, with `{ open, isOpen }`: call `open()` from its click
 * @slot expanded The expanded view, with `{ close, item }` (`item` is what the controller's `open` was given)
 * @event update:open The expanded view opened or closed (v-model:open)
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useContainerTransform, type ContainerTransformController } from '../composables/useContainerTransform'
import {
  CLOSE_MS, OPEN_MS, SCRIM_OPACITY, boxOf, containerFrames, playContainerFrames, radiusOf, type Box,
} from '../composables/_containerTransform'
import { prefersReducedMotion } from '../composables/_springAnimation'
import { useScrollLock } from '../composables/_useScrollLock'
import { useEscapeStack } from '../composables/_useEscapeStack'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** A `useContainerTransform()` controller, to open it from elements elsewhere (`controller.open($event, item)`) */
  controller?: ContainerTransformController<T>
  /**
   * Where the expanded view opens: over the whole screen, as a centered panel (wider screens), or `custom`: the
   * classes you give the component place and size it (`bottom-4 right-4 w-80 h-96`, `inset-y-0 right-0 w-96`…),
   * anywhere over the page
   */
  mode?: 'fullscreen' | 'dialog' | 'custom'
  /** The centered panel's maximum width (`dialog` mode) */
  maxWidth?: string
  /** Accessible name of the expanded view */
  label?: string
  /**
   * Dims the page behind it, which makes it modal (scroll lock, `aria-modal`). Without one the page stays usable:
   * a click outside closes it instead (unless `persistent`)
   */
  scrim?: boolean
  /** A click on the scrim, or outside without one, doesn't close it */
  persistent?: boolean
  /**
   * Android's back (button or gesture) closes it, like an expanded view in an app, where the browser has the
   * CloseWatcher API (Chrome, Edge); the history and the router are left alone. Default `true`
   */
  closeOnBack?: boolean
}>(), { mode: 'fullscreen', maxWidth: '560px', scrim: true, persistent: false, closeOnBack: true })

/** Whether the expanded view is open; opening it from here grows it from the default slot's element */
const openModel = defineModel<boolean>('open', { default: false })

const own = useContainerTransform<T>()
const ctl = computed(() => props.controller ?? own)

const anchor = ref<HTMLElement>()
const scrimEl = ref<HTMLElement>()
const clip = ref<HTMLElement>()
const shadowEl = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const mounted = ref(false)

const anchorElement = () => (anchor.value?.firstElementChild as HTMLElement | null) ?? null
const openFromSlot = () => ctl.value.open(anchorElement())

let anims: Animation[] = []
let ghost: HTMLElement | null = null
let hidden: HTMLElement | null = null
let returnFocus = false

// The element it opens from, cloned into the transition (it stays hidden in the page meanwhile). The clone keeps
// what it inherited there: text styles and the custom properties (an MScheme's colors, for one)
function makeGhost(src: HTMLElement, box: Box) {
  const g = src.cloneNode(true) as HTMLElement
  g.removeAttribute('id')
  g.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  g.setAttribute('aria-hidden', 'true')
  g.inert = true
  const cs = getComputedStyle(src)
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i]!
    if (name.startsWith('--')) g.style.setProperty(name, cs.getPropertyValue(name))
  }
  for (const p of ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'direction', 'text-align']) {
    g.style.setProperty(p, cs.getPropertyValue(p))
  }
  Object.assign(g.style, {
    position: 'absolute', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`,
    margin: '0', boxSizing: 'border-box', transformOrigin: '0 0', pointerEvents: 'none', visibility: 'visible',
  })
  clip.value!.insertBefore(g, panel.value!)
  return g
}

function clearRun() {
  for (const a of anims) a.cancel()
  anims = []
  ghost?.remove()
  ghost = null
  if (shadowEl.value) shadowEl.value.style.filter = ''
}

// The clip would cut the panel's own shadow off until the end, so while it morphs a drop shadow on the layer
// around it (which follows the clipped shape) stands in for it: elevation 3's two layers, as drop-shadow can't spread
function shadeTransition() {
  if (!shadowEl.value || !panel.value || getComputedStyle(panel.value).boxShadow === 'none') return
  shadowEl.value.style.filter = 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.3)) drop-shadow(0 4px 8px rgb(0 0 0 / 0.15))'
}

function hideSource(src: HTMLElement | null) {
  if (hidden && hidden !== src) hidden.style.visibility = ''
  hidden = src
  if (src) src.style.visibility = 'hidden'
}

function opened() {
  clearRun()
}

function closed() {
  clearRun()
  mounted.value = false
  const src = hidden
  hideSource(null)
  if (returnFocus) src?.focus?.({ preventScroll: true })
  returnFocus = false
}

// A box with no size (an element that isn't rendered) can't be scaled from: open or close without the transform
const sized = (b: Box) => b.width > 0 && b.height > 0

// When the running animations end (whichever way they were last turned), settle in the state asked for now. Every
// waiter on a run calls this; the first one clears the run, so the others find it replaced and do nothing. (Each
// waiter used to settle in its own direction: closing mid-opening, the opening's waiter could win, jump open and
// leave the controller closed with the view still on screen.)
function whenDone(run: Animation[]) {
  Promise.all(run.map((a) => a.finished)).then(() => {
    if (anims !== run) return
    if (ctl.value.isOpen.value) opened()
    else closed()
  }, () => {})
}

// Plays the running animations the other way. They hold their last frame meanwhile, so an opening turned into a
// closing doesn't show the open view for a frame between its end and the layer going away
function turnAround() {
  for (const a of anims) {
    a.effect?.updateTiming({ fill: 'both' })
    a.reverse()
  }
}

// Plays a run, settling when it ends (see whenDone)
function play(entering: boolean, start: Box, end: Box, startRadius: number, endRadius: number, done: () => void) {
  const frames = containerFrames(start, end, startRadius, endRadius, entering, entering ? OPEN_MS : CLOSE_MS)
  shadeTransition()
  // The views' resting boxes: the clone sits on the element's, the panel on its own
  anims = playContainerFrames(
    frames,
    { clip: clip.value!, start: entering ? ghost : panel.value!, end: entering ? panel.value! : ghost!, scrim: scrimEl.value },
    window.innerWidth,
    window.innerHeight,
    entering ? undefined : 'forwards',
  )
  if (!anims.length) return done()
  whenDone(anims)
}

async function show() {
  // Closing: turn around and grow back
  if (anims.length && mounted.value) {
    turnAround()
    return
  }
  const src = ctl.value.source.value
  mounted.value = true
  await nextTick()
  if (!panel.value || !ctl.value.isOpen.value) return
  returnFocus = true
  panel.value.focus({ preventScroll: true })
  if (!src || !src.isConnected || prefersReducedMotion()) return hideSource(src)
  const start = boxOf(src)
  const end = boxOf(panel.value)
  if (!sized(start) || !sized(end)) return hideSource(src)
  ghost = makeGhost(src, start)
  hideSource(src)
  play(true, start, end, radiusOf(src), radiusOf(panel.value), opened)
}

function hide() {
  if (!mounted.value) return
  // Opening: turn around and shrink back
  if (anims.length) {
    turnAround()
    return
  }
  const src = hidden
  if (!panel.value || !src || !src.isConnected || prefersReducedMotion()) return closed()
  returnFocus = !!panel.value.contains(document.activeElement) || document.activeElement === document.body
  const start = boxOf(panel.value)
  const end = boxOf(src)
  if (!sized(start) || !sized(end)) return closed()
  ghost = makeGhost(src, end)
  play(false, start, end, radiusOf(panel.value), radiusOf(src), closed)
}

// Android's back closes it through a CloseWatcher (the platform's own close request, which also gets Escape where
// nothing handled it), so the history isn't touched: pushing an entry made a router navigate on every close
interface CloseWatcherLike { onclose: (() => void) | null; destroy: () => void }
let closeWatcher: CloseWatcherLike | null = null
function watchClose() {
  if (!props.closeOnBack || closeWatcher || typeof window === 'undefined') return
  const Watcher = (window as unknown as { CloseWatcher?: new () => CloseWatcherLike }).CloseWatcher
  if (!Watcher) return
  const w = new Watcher()
  w.onclose = () => {
    closeWatcher = null
    ctl.value.close()
  }
  closeWatcher = w
}
function unwatchClose() {
  closeWatcher?.destroy()
  closeWatcher = null
}

watch(() => ctl.value.isOpen.value, (open) => {
  if (openModel.value !== open) openModel.value = open
  if (open) {
    watchClose()
    show()
  } else {
    unwatchClose()
    hide()
  }
})
watch(openModel, (open) => {
  if (open === ctl.value.isOpen.value) return
  if (open) ctl.value.open(ctl.value.source.value ?? anchorElement())
  else ctl.value.close()
}, { immediate: true })

useScrollLock(() => mounted.value && props.scrim)
useEscapeStack(() => mounted.value && ctl.value.isOpen.value, () => ctl.value.close())

// Without a scrim the page stays usable: a press outside the expanded view (and the element it came from) closes it
function onOutside(e: PointerEvent) {
  const target = e.target as Node | null
  if (!target || panel.value?.contains(target) || hidden?.contains(target)) return
  ctl.value.close()
}
watch(() => mounted.value && ctl.value.isOpen.value && !props.scrim && !props.persistent, (on) => {
  if (typeof document === 'undefined') return
  if (on) document.addEventListener('pointerdown', onOutside, true)
  else document.removeEventListener('pointerdown', onOutside, true)
})

onBeforeUnmount(() => {
  clearRun()
  hideSource(null)
  unwatchClose()
  if (typeof document !== 'undefined') document.removeEventListener('pointerdown', onOutside, true)
})

const close = () => ctl.value.close()
const panelStyle = computed(() => (props.mode === 'dialog' ? { width: `min(${props.maxWidth}, calc(100% - 48px))` } : undefined))
</script>

<template>
  <span v-if="$slots.default" ref="anchor" class="contents">
    <slot :open="openFromSlot" :is-open="ctl.isOpen.value" />
  </span>
  <Teleport to="body">
    <div v-if="mounted" class="fixed inset-0 z-50" :class="!scrim && 'pointer-events-none'">
      <div
        v-if="scrim"
        ref="scrimEl"
        class="absolute inset-0 bg-black"
        :style="{ opacity: SCRIM_OPACITY }"
        @click="mode !== 'fullscreen' && !persistent && close()"
      />
      <!-- The container: its clip morphs between the two boxes during a transition; the views move inside it. The
           layer around it draws the panel's shadow meanwhile -->
      <div ref="shadowEl" class="pointer-events-none absolute inset-0">
        <div ref="clip" class="pointer-events-none absolute inset-0">
          <div
            ref="panel"
            v-bind="$attrs"
            role="dialog"
            :aria-modal="scrim ? 'true' : undefined"
            :aria-label="label"
            tabindex="-1"
            class="m3-ct-panel pointer-events-auto absolute overflow-y-auto outline-none"
            :class="mode === 'dialog' ? 'm3-ct-dialog inset-0 m-auto h-fit max-h-[calc(100%-48px)]' : mode === 'fullscreen' ? 'inset-0' : ''"
            :style="panelStyle"
            style="transform-origin: 0 0"
          >
            <slot name="expanded" :close="close" :item="ctl.item.value" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* The expanded surface's look, in the base layer so the consumer's classes on the component win (see MShape) */
@layer base {
  .m3-ct-panel {
    background-color: var(--color-surface);
    color: var(--color-on-surface);
  }
  .m3-ct-dialog {
    background-color: var(--color-surface-container-high);
    border-radius: 28px;
    box-shadow: var(--shadow-elevation-3);
  }
}
</style>
