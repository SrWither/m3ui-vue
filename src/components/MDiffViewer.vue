<script setup lang="ts">
/**
 * Shows what changed between two texts (code, config, prose): side by side or unified, with the changed words
 * highlighted inside changed lines, line numbers, counts of added and removed lines, and long unchanged stretches
 * folded behind a "Show N unchanged lines" row (`context` lines kept around each change). Below `breakpoint` (its own
 * width) side by side becomes unified. No editor or extra dependency: its own line and word diff (`diffLines`,
 * `diffWords`, exported too).
 *
 * @slot header Replaces the header's title area (file names): `{ added, removed }`
 * @event update:mode The view changed from its toggle
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MSegmentedButton from './MSegmentedButton.vue'
import { useLocale } from '../composables/useLocale'
import { diffLines, diffStats, diffWords, type DiffLine, type DiffPart } from '../composables/textDiff'

const props = withDefaults(
  defineProps<{
    /** The text before */
    original: string
    /** The text after */
    modified: string
    /** Side by side or unified (v-model:mode with the toggle) */
    mode?: 'split' | 'unified'
    /** Show the split / unified toggle in the header */
    toggle?: boolean
    /** The original's name in the header (a file name, "v1") */
    originalLabel?: string
    /** The modified version's name */
    modifiedLabel?: string
    /** Unchanged lines kept around each change; longer stretches fold (-1: never fold) */
    context?: number
    /** Highlight the changed words inside changed lines */
    wordDiff?: boolean
    /** Show line numbers */
    lineNumbers?: boolean
    /** Wrap long lines instead of scrolling */
    wrap?: boolean
    /** Below this width (px, its own) side by side shows unified */
    breakpoint?: number
    /** Limit the height (CSS), scrolling inside */
    maxHeight?: string
  }>(),
  { mode: 'split', toggle: true, context: 3, wordDiff: true, lineNumbers: true, wrap: false, breakpoint: 640 },
)

const emit = defineEmits<{ 'update:mode': [mode: 'split' | 'unified'] }>()

const t = useLocale()
const root = ref<HTMLElement>()
const width = ref(0)
const current = ref(props.mode)
watch(() => props.mode, (m) => (current.value = m))
const view = computed(() => (current.value === 'split' && width.value > 0 && width.value < props.breakpoint ? 'unified' : current.value))
function setMode(m: 'split' | 'unified') {
  current.value = m
  emit('update:mode', m)
}

const diff = computed(() => diffLines(props.original, props.modified))
const stats = computed(() => diffStats(diff.value))
const expanded = ref(new Set<number>())
watch(() => [props.original, props.modified], () => (expanded.value = new Set()))

type Line = DiffLine & { parts?: DiffPart[] }
type Row = { kind: 'line'; line: Line } | { kind: 'fold'; id: number; count: number }

/** Change blocks get word diffs (each removed line with the added one at the same place), long equal runs fold */
const rows = computed<Row[]>(() => {
  const lines: Line[] = diff.value.map((l) => ({ ...l }))
  if (props.wordDiff) {
    for (let i = 0; i < lines.length;) {
      if (lines[i]!.op === 'equal') { i++; continue }
      const removes: Line[] = []
      const adds: Line[] = []
      while (i < lines.length && lines[i]!.op === 'remove') removes.push(lines[i++]!)
      while (i < lines.length && lines[i]!.op === 'add') adds.push(lines[i++]!)
      for (let k = 0; k < Math.min(removes.length, adds.length); k++) {
        const words = diffWords(removes[k]!.text, adds[k]!.text)
        // Only worth it when much of the line stayed
        const kept = words.filter((w) => w.op === 'equal').reduce((n, w) => n + w.text.trim().length, 0)
        if (kept < Math.max(removes[k]!.text.trim().length, adds[k]!.text.trim().length) * 0.3) continue
        removes[k]!.parts = words.filter((w) => w.op !== 'add')
        adds[k]!.parts = words.filter((w) => w.op !== 'remove')
      }
    }
  }
  if (props.context < 0) return lines.map((line) => ({ kind: 'line', line }))
  const out: Row[] = []
  for (let i = 0; i < lines.length;) {
    if (lines[i]!.op !== 'equal') { out.push({ kind: 'line', line: lines[i++]! }); continue }
    let j = i
    while (j < lines.length && lines[j]!.op === 'equal') j++
    const head = i === 0 ? 0 : props.context
    const tail = j === lines.length ? 0 : props.context
    const hidden = j - i - head - tail
    if (hidden > 1 && !expanded.value.has(i)) {
      for (let k = i; k < i + head; k++) out.push({ kind: 'line', line: lines[k]! })
      out.push({ kind: 'fold', id: i, count: hidden })
      for (let k = j - tail; k < j; k++) out.push({ kind: 'line', line: lines[k]! })
    } else for (let k = i; k < j; k++) out.push({ kind: 'line', line: lines[k]! })
    i = j
  }
  return out
})

/** Side by side: removed lines on the left facing added ones on the right, equal ones on both */
const splitRows = computed(() => {
  const out: ({ kind: 'pair'; left?: Line; right?: Line } | { kind: 'fold'; id: number; count: number })[] = []
  const list = rows.value
  for (let i = 0; i < list.length;) {
    const r = list[i]!
    if (r.kind === 'fold') { out.push(r); i++; continue }
    if (r.line.op === 'equal') { out.push({ kind: 'pair', left: r.line, right: r.line }); i++; continue }
    const removes: Line[] = []
    const adds: Line[] = []
    while (i < list.length && list[i]!.kind === 'line' && (list[i] as { line: Line }).line.op === 'remove') removes.push((list[i++] as { line: Line }).line)
    while (i < list.length && list[i]!.kind === 'line' && (list[i] as { line: Line }).line.op === 'add') adds.push((list[i++] as { line: Line }).line)
    for (let k = 0; k < Math.max(removes.length, adds.length); k++) out.push({ kind: 'pair', left: removes[k], right: adds[k] })
  }
  return out
})

const unfold = (id: number) => (expanded.value = new Set([...expanded.value, id]))

const BG = { equal: '', remove: 'bg-error-container/45', add: 'bg-success-container/45' } as const
const MARK = { remove: 'rounded-xs bg-error-container text-on-error-container', add: 'rounded-xs bg-success-container text-on-success-container' } as const
const SIGN = { equal: ' ', remove: '−', add: '+' } as const

let observer: ResizeObserver | undefined
onMounted(() => {
  const measure = () => (width.value = root.value?.clientWidth ?? 0)
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(measure)
    observer.observe(root.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const modeOptions = computed(() => [
  { value: 'split' as const, label: t.diffSplit, icon: 'vertical_split' },
  { value: 'unified' as const, label: t.diffUnified, icon: 'view_agenda' },
])
</script>

<template>
  <div ref="root" class="m3-diff overflow-hidden rounded-md border border-outline-variant bg-surface text-on-surface">
    <!-- Header: names, counts, the toggle -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-outline-variant bg-surface-container-low px-4 py-2">
      <div class="flex min-w-0 flex-1 items-center gap-2 text-label-large">
        <slot name="header" :added="stats.added" :removed="stats.removed">
          <span v-if="originalLabel" class="truncate font-mono text-on-surface-variant">{{ originalLabel }}</span>
          <span v-if="originalLabel && modifiedLabel" class="text-on-surface-variant">→</span>
          <span v-if="modifiedLabel" class="truncate font-mono">{{ modifiedLabel }}</span>
        </slot>
        <span class="ml-auto shrink-0 font-mono text-label-medium">
          <span class="text-success">+{{ stats.added }}</span>
          <span class="ml-2 text-error">−{{ stats.removed }}</span>
        </span>
      </div>
      <MSegmentedButton
        v-if="toggle && width >= breakpoint"
        :model-value="current"
        :options="modeOptions"
        density="compact"
        @update:model-value="(m: 'split' | 'unified') => setMode(m)"
      />
    </div>

    <div class="overflow-auto font-mono text-[13px] leading-5" :style="{ maxHeight }">
      <p v-if="!stats.added && !stats.removed" class="px-4 py-3 font-sans text-body-medium text-on-surface-variant">{{ t.diffNoChanges }}</p>

      <!-- Unified -->
      <table v-else-if="view === 'unified'" class="w-full border-collapse">
        <tbody>
          <template v-for="(r, i) in rows" :key="i">
            <tr v-if="r.kind === 'fold'">
              <td :colspan="lineNumbers ? 4 : 2" class="p-0">
                <button type="button" class="w-full cursor-pointer bg-surface-container px-4 py-1 text-left font-sans text-label-medium text-primary hover:bg-surface-container-high" @click="unfold(r.id)">
                  ⋯ {{ t.diffUnchanged.replace('{n}', String(r.count)) }}
                </button>
              </td>
            </tr>
            <tr v-else :class="BG[r.line.op]">
              <template v-if="lineNumbers">
                <td class="w-px select-none whitespace-nowrap px-2 text-right text-on-surface-variant/70">{{ r.line.oldLine ?? '' }}</td>
                <td class="w-px select-none whitespace-nowrap px-2 text-right text-on-surface-variant/70">{{ r.line.newLine ?? '' }}</td>
              </template>
              <td class="w-px select-none px-1 text-center" :class="r.line.op === 'add' ? 'text-success' : r.line.op === 'remove' ? 'text-error' : ''">{{ SIGN[r.line.op] }}</td>
              <td class="pr-4" :class="wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'">
                <template v-if="r.line.parts"><span v-for="(p, k) in r.line.parts" :key="k" :class="p.op !== 'equal' ? MARK[p.op] : ''">{{ p.text }}</span></template>
                <template v-else>{{ r.line.text || ' ' }}</template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Side by side -->
      <table v-else class="w-full table-fixed border-collapse">
        <colgroup>
          <col v-if="lineNumbers" class="w-12">
          <col>
          <col v-if="lineNumbers" class="w-12">
          <col>
        </colgroup>
        <tbody>
          <template v-for="(r, i) in splitRows" :key="i">
            <tr v-if="r.kind === 'fold'">
              <td :colspan="lineNumbers ? 4 : 2" class="p-0">
                <button type="button" class="w-full cursor-pointer bg-surface-container px-4 py-1 text-left font-sans text-label-medium text-primary hover:bg-surface-container-high" @click="unfold(r.id)">
                  ⋯ {{ t.diffUnchanged.replace('{n}', String(r.count)) }}
                </button>
              </td>
            </tr>
            <tr v-else>
              <td v-if="lineNumbers" class="select-none border-r border-outline-variant/50 px-2 text-right align-top text-on-surface-variant/70" :class="r.left ? BG[r.left.op] : 'bg-surface-container-low'">{{ r.left?.oldLine ?? '' }}</td>
              <td class="overflow-hidden border-r border-outline-variant px-2 align-top" :class="[r.left ? BG[r.left.op] : 'bg-surface-container-low', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre']">
                <template v-if="r.left?.parts"><span v-for="(p, k) in r.left.parts" :key="k" :class="p.op !== 'equal' ? MARK[p.op] : ''">{{ p.text }}</span></template>
                <template v-else>{{ r.left?.text ?? '' }}</template>
              </td>
              <td v-if="lineNumbers" class="select-none border-r border-outline-variant/50 px-2 text-right align-top text-on-surface-variant/70" :class="r.right ? BG[r.right.op] : 'bg-surface-container-low'">{{ r.right?.newLine ?? '' }}</td>
              <td class="overflow-hidden px-2 align-top" :class="[r.right ? BG[r.right.op] : 'bg-surface-container-low', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre']">
                <template v-if="r.right?.parts"><span v-for="(p, k) in r.right.parts" :key="k" :class="p.op !== 'equal' ? MARK[p.op] : ''">{{ p.text }}</span></template>
                <template v-else>{{ r.right?.text ?? '' }}</template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
