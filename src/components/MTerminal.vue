<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    lines?: string[]
    readonly?: boolean
    title?: string
    minHeight?: string
  }>(),
  {
    lines: () => [],
    readonly: false,
    title: 'Terminal',
    minHeight: '300px',
  },
)

const emit = defineEmits<{
  input: [string]
  line: [string]
}>()

const containerRef = ref<HTMLElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let lineBuffer = ''

function getThemeColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    background: style.getPropertyValue('--color-surface-container-lowest').trim() || '#0f0d13',
    foreground: style.getPropertyValue('--color-on-surface').trim() || '#e6e1e5',
    cursor: style.getPropertyValue('--color-primary').trim() || '#d0bcff',
    cursorAccent: style.getPropertyValue('--color-on-primary').trim() || '#381e72',
    selectionBackground: style.getPropertyValue('--color-primary-container').trim() || '#4f378b',
  }
}

onMounted(() => {
  if (!containerRef.value) return

  const colors = getThemeColors()

  terminal = new Terminal({
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: 14,
    lineHeight: 1.4,
    cursorBlink: !props.readonly,
    disableStdin: props.readonly,
    theme: {
      background: colors.background,
      foreground: colors.foreground,
      cursor: colors.cursor,
      cursorAccent: colors.cursorAccent,
      selectionBackground: colors.selectionBackground,
    },
    scrollback: 1000,
    convertEol: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value)

  try { fitAddon.fit() } catch { /* container might not be visible yet */ }

  for (const line of props.lines) {
    terminal.writeln(line)
  }

  if (!props.readonly) {
    terminal.onData((data) => {
      emit('input', data)

      if (data === '\r') {
        terminal!.write('\r\n')
        emit('line', lineBuffer)
        lineBuffer = ''
      } else if (data === '\x7f') {
        if (lineBuffer.length > 0) {
          lineBuffer = lineBuffer.slice(0, -1)
          terminal!.write('\b \b')
        }
      } else {
        lineBuffer += data
        terminal!.write(data)
      }
    })
  }

  resizeObserver = new ResizeObserver(() => {
    try { fitAddon?.fit() } catch { /* ignore */ }
  })
  resizeObserver.observe(containerRef.value)
})

watch(() => props.lines, (newLines) => {
  if (!terminal) return
  terminal.clear()
  for (const line of newLines) {
    terminal.writeln(line)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  terminal?.dispose()
})

defineExpose({
  write: (text: string) => terminal?.write(text),
  writeln: (text: string) => terminal?.writeln(text),
  clear: () => terminal?.clear(),
  focus: () => terminal?.focus(),
})
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-outline-variant">
    <!-- Title bar -->
    <div class="flex items-center gap-2 border-b border-outline-variant bg-surface-container px-4 py-2">
      <MIcon name="terminal" :size="18" class="text-on-surface-variant" />
      <span class="flex-1 text-label-medium text-on-surface-variant">{{ title }}</span>
      <div class="flex gap-1.5">
        <div class="h-3 w-3 rounded-full bg-error/60" />
        <div class="h-3 w-3 rounded-full bg-tertiary-container" />
        <div class="h-3 w-3 rounded-full bg-success/60" />
      </div>
    </div>

    <!-- Terminal container -->
    <div
      ref="containerRef"
      class="bg-surface-container-lowest px-2 py-1"
      :style="{ minHeight }"
    />
  </div>
</template>

<style>
@import '@xterm/xterm/css/xterm.css';
</style>
