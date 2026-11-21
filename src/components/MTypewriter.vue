<script setup lang="ts">
/**
 * MTypewriter — text that types itself out and, with several phrases, erases and types the next in a loop, behind a
 * blinking caret. Only the end that differs is erased ("faster" → "prettier" keeps nothing, "build faster apps" →
 * "build prettier apps" erases back to "build "). Works by grapheme, so emoji and accents count as one
 * character. Starts when it scrolls into view; with reduced motion the phrases swap whole. Screen readers get every
 * phrase once, not each keystroke.
 *
 * @slot cursor Replaces the caret
 * @event typed Emitted with the phrase's index when a phrase is fully typed
 * @event done Emitted when the last phrase is typed and `loop` is off
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** A phrase, or phrases typed one after another */
    text: string | string[]
    /** Milliseconds per character typed */
    typeSpeed?: number
    /** Milliseconds per character erased */
    deleteSpeed?: number
    /** Milliseconds a typed phrase stays before it's erased */
    pause?: number
    /** Milliseconds before the first character */
    startDelay?: number
    /** Start over after the last phrase; off stops on it */
    loop?: boolean
    /** Erase only the end that differs from the next phrase */
    smartBackspace?: boolean
    /** Vary each keystroke's delay a little, like a person typing */
    humanize?: boolean
    /** Show the caret */
    cursor?: boolean
    /** Wait until it's on screen to start */
    startOnVisible?: boolean
    /** Element rendered */
    tag?: string
  }>(),
  {
    typeSpeed: 70,
    deleteSpeed: 35,
    pause: 1600,
    startDelay: 300,
    loop: true,
    smartBackspace: true,
    humanize: true,
    cursor: true,
    startOnVisible: true,
    tag: 'span',
  },
)

const emit = defineEmits<{ typed: [index: number]; done: [] }>()

const phrases = computed(() => (Array.isArray(props.text) ? props.text : [props.text]))

// Graphemes: an emoji with a skin tone, a flag or a letter with its accent is one keystroke
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
const split = (s: string) => (segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s))

const shown = ref<string[]>([])
const index = ref(0)
const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let timer: ReturnType<typeof setTimeout> | undefined
let running = false

const jitter = (ms: number) => (props.humanize ? ms * (0.6 + Math.random() * 0.8) : ms)

function commonPrefix(a: string[], b: string[]) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function schedule(fn: () => void, ms: number) {
  clearTimeout(timer)
  timer = setTimeout(fn, ms)
}

function typePhrase() {
  const target = split(phrases.value[index.value] ?? '')
  if (reduced) {
    shown.value = target
    return afterTyped()
  }
  if (shown.value.length < target.length) {
    shown.value = target.slice(0, shown.value.length + 1)
    schedule(typePhrase, jitter(props.typeSpeed))
  } else afterTyped()
}

function afterTyped() {
  emit('typed', index.value)
  const last = index.value === phrases.value.length - 1
  if (last && !props.loop) {
    emit('done')
    return
  }
  // A single phrase has nothing to loop to: it stays typed
  if (phrases.value.length === 1) return
  schedule(erase, props.pause)
}

function erase() {
  const nextIndex = (index.value + 1) % phrases.value.length
  const next = split(phrases.value[nextIndex] ?? '')
  const keep = props.smartBackspace ? commonPrefix(shown.value, next) : 0
  if (reduced) {
    shown.value = []
    index.value = nextIndex
    return typePhrase()
  }
  if (shown.value.length > keep) {
    shown.value = shown.value.slice(0, -1)
    schedule(erase, jitter(props.deleteSpeed))
  } else {
    index.value = nextIndex
    schedule(typePhrase, props.typeSpeed * 3)
  }
}

function start() {
  if (running) return
  running = true
  schedule(typePhrase, props.startDelay)
}

function restart() {
  clearTimeout(timer)
  running = false
  shown.value = []
  index.value = 0
  start()
}

const el = ref<HTMLElement>()
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (props.startOnVisible && typeof IntersectionObserver !== 'undefined' && el.value) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        start()
      }
    })
    observer.observe(el.value)
  } else start()
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  observer?.disconnect()
})

watch(() => phrases.value.join('\u0000'), () => { if (running) restart() })

defineExpose({ restart })

const typed = computed(() => shown.value.join(''))
</script>

<template>
  <component :is="tag" ref="el" class="m3-typewriter">
    <span class="sr-only">{{ phrases.join(', ') }}</span>
    <span aria-hidden="true">{{ typed }}</span>
    <span v-if="cursor" aria-hidden="true" class="m3-typewriter-cursor" :class="!$slots.cursor && 'm3-typewriter-caret'"><slot name="cursor" /></span>
  </component>
</template>

<style>
/* Like an M3 text field's caret: 2px wide, primary, blinking */
.m3-typewriter-cursor {
  display: inline-block;
  min-width: 2px;
  height: 1em;
  margin-left: 0.06em;
  vertical-align: -0.12em;
  animation: m3-typewriter-blink 1.06s steps(1) infinite;
}
.m3-typewriter-caret {
  width: 2px;
  background-color: var(--color-primary);
}
@keyframes m3-typewriter-blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .m3-typewriter-cursor {
    animation: none;
  }
}
</style>
