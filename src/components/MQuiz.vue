<script lang="ts">
/**
 * A question of an `MQuiz`.
 * - `single`: `answer` is the index of the right option.
 * - `multiple`: `answer` is the indices of every right option (all of them, and only them, to score).
 * - `truefalse`: `answer` is a boolean.
 * - `order`: `options` are given in the right order; the quiz shuffles them.
 * - `text`: `answer` is the accepted answer(s); case, accents and extra spaces are ignored.
 */
export interface QuizQuestion {
  id: string | number
  type?: 'single' | 'multiple' | 'truefalse' | 'order' | 'text'
  prompt: string
  /** An image shown with the prompt */
  image?: string
  options?: string[]
  answer?: number | number[] | boolean | string | string[]
  /** Shown after answering: why the answer is what it is */
  explanation?: string
  /** Points the question is worth */
  points?: number
}

export type QuizAnswer = number | number[] | boolean | string

/** The outcome of a finished quiz. */
export interface QuizResult {
  score: number
  total: number
  percent: number
  /** Whether `percent` reached `passScore` (always true without one) */
  passed: boolean
  answers: Record<string, { value: QuizAnswer | undefined; correct: boolean }>
}
</script>

<script setup lang="ts">
/**
 * A quiz for a course, an onboarding or a training: single and multiple choice, true/false, putting items in order
 * and typed answers, one question at a time with a progress bar. With `feedback="immediate"` each answer is checked
 * on the spot with its explanation; with `"end"` everything is revealed in the results. The results show the score,
 * pass / fail against `passScore`, and a review of every question. An optional time limit ends the quiz when it
 * runs out.
 *
 * @slot result Replaces the results screen. Slot props: `{ result, retry }`
 * @event answer A question was answered (checked): `{ id, value, correct }`
 * @event finish The quiz ended, with its `QuizResult`
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'
import { vRipple } from '../directives/vRipple'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    questions: QuizQuestion[]
    /** Check each answer right away, or only reveal them in the results */
    feedback?: 'immediate' | 'end'
    /** Shuffles the questions on every attempt */
    shuffle?: boolean
    /** Shuffles the options of choice questions */
    shuffleOptions?: boolean
    /** Percent needed to pass, e.g. 70. Without it there's no pass / fail */
    passScore?: number
    /** Time limit for the whole quiz, in seconds */
    timeLimit?: number
    /** Lists every question with the given and the right answer in the results */
    review?: boolean
    /** Offers to try again from the results */
    allowRetry?: boolean
  }>(),
  {
    feedback: 'immediate',
    shuffle: false,
    shuffleOptions: false,
    review: true,
    allowRetry: true,
  },
)

const emit = defineEmits<{
  answer: [{ id: string | number; value: QuizAnswer | undefined; correct: boolean }]
  finish: [QuizResult]
}>()

function shuffled<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

interface Item { q: QuizQuestion; type: NonNullable<QuizQuestion['type']>; /** original option indices in display order */ order: number[] }

const items = ref<Item[]>([])
const index = ref(0)
const answers = ref<Record<string, QuizAnswer | undefined>>({})
const checked = ref<Record<string, boolean>>({})
const finished = ref(false)

function setup() {
  const qs = props.shuffle ? shuffled(props.questions) : props.questions
  items.value = qs.map((q) => {
    const type = q.type ?? 'single'
    const idx = (q.options ?? []).map((_, i) => i)
    let order = idx
    if (type === 'order') {
      order = shuffled(idx)
      // never start already solved
      if (order.length > 1 && order.every((v, i) => v === i)) order = [...order.slice(1), order[0]!]
    } else if (props.shuffleOptions && (type === 'single' || type === 'multiple')) order = shuffled(idx)
    return { q, type, order }
  })
  index.value = 0
  answers.value = {}
  checked.value = {}
  finished.value = false
  for (const it of items.value) if (it.type === 'order') answers.value[String(it.q.id)] = [...it.order]
  startTimer()
}

const current = computed(() => items.value[index.value])
const key = (it: Item) => String(it.q.id)
const value = computed(() => (current.value ? answers.value[key(current.value)] : undefined))
const isChecked = computed(() => !!current.value && !!checked.value[key(current.value)])

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function isCorrect(it: Item, v: QuizAnswer | undefined): boolean {
  const a = it.q.answer
  switch (it.type) {
    case 'single':
      return v === a
    case 'multiple': {
      const want = [...((a as number[]) ?? [])].sort()
      const got = [...((v as number[]) ?? [])].sort()
      return want.length === got.length && want.every((x, i) => x === got[i])
    }
    case 'truefalse':
      return v === a
    case 'order':
      return Array.isArray(v) && v.every((x, i) => x === i)
    case 'text': {
      if (typeof v !== 'string' || !v.trim()) return false
      const accepted = Array.isArray(a) ? a : [a as string]
      return accepted.some((x) => normalize(String(x)) === normalize(v))
    }
  }
}

function answered(it: Item) {
  const v = answers.value[key(it)]
  if (it.type === 'multiple') return Array.isArray(v) && v.length > 0
  if (it.type === 'text') return typeof v === 'string' && v.trim().length > 0
  return v !== undefined
}

function set(v: QuizAnswer) {
  if (!current.value || isChecked.value) return
  answers.value = { ...answers.value, [key(current.value)]: v }
}

function toggleMulti(i: number) {
  const cur = (value.value as number[] | undefined) ?? []
  set(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i])
}

function move(pos: number, d: number) {
  const cur = [...(value.value as number[])]
  const to = pos + d
  if (to < 0 || to >= cur.length) return
  ;[cur[pos], cur[to]] = [cur[to]!, cur[pos]!]
  set(cur)
}

function check() {
  const it = current.value
  if (!it) return
  checked.value = { ...checked.value, [key(it)]: true }
  emit('answer', { id: it.q.id, value: answers.value[key(it)], correct: isCorrect(it, answers.value[key(it)]) })
}

function next() {
  const it = current.value
  if (it && props.feedback === 'end' && !checked.value[key(it)]) check()
  if (index.value < items.value.length - 1) index.value++
  else finish()
}

const result = computed<QuizResult>(() => {
  let score = 0
  let total = 0
  const out: QuizResult['answers'] = {}
  for (const it of items.value) {
    const pts = it.q.points ?? 1
    const v = answers.value[key(it)]
    const ok = isCorrect(it, v)
    total += pts
    if (ok) score += pts
    out[key(it)] = { value: v, correct: ok }
  }
  const percent = total ? Math.round((score / total) * 100) : 0
  return { score, total, percent, passed: props.passScore === undefined || percent >= props.passScore, answers: out }
})

function finish() {
  if (finished.value) return
  // Unanswered questions still count, as wrong
  for (const it of items.value) if (!checked.value[key(it)]) checked.value[key(it)] = true
  finished.value = true
  stopTimer()
  emit('finish', result.value)
}

// ── timer ──
const remaining = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null
function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}
function startTimer() {
  stopTimer()
  if (!props.timeLimit) {
    remaining.value = null
    return
  }
  remaining.value = props.timeLimit
  timer = setInterval(() => {
    remaining.value = Math.max(0, (remaining.value ?? 0) - 1)
    if (remaining.value === 0) finish()
  }, 1000)
}
onBeforeUnmount(stopTimer)
const clock = computed(() => {
  const s = remaining.value ?? 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

watch(() => props.questions, setup, { immediate: true })

// ── display helpers ──
function optionState(it: Item, i: number): 'correct' | 'wrong' | 'selected' | 'idle' {
  const v = answers.value[key(it)]
  const chosen = it.type === 'multiple' ? ((v as number[]) ?? []).includes(i) : v === i
  if (checked.value[key(it)] && (props.feedback === 'immediate' || finished.value)) {
    const right = it.type === 'multiple' ? ((it.q.answer as number[]) ?? []).includes(i) : it.q.answer === i
    if (right) return 'correct'
    if (chosen) return 'wrong'
    return 'idle'
  }
  return chosen ? 'selected' : 'idle'
}

const showFeedback = computed(() => props.feedback === 'immediate' && isChecked.value && !!current.value)
const currentCorrect = computed(() => !!current.value && isCorrect(current.value, value.value))

function correctText(it: Item) {
  const o = it.q.options ?? []
  switch (it.type) {
    case 'single': return o[it.q.answer as number] ?? ''
    case 'multiple': return ((it.q.answer as number[]) ?? []).map((i) => o[i]).join(', ')
    case 'truefalse': return it.q.answer ? locale.quizTrue : locale.quizFalse
    case 'order': return o.join(' → ')
    case 'text': return Array.isArray(it.q.answer) ? String(it.q.answer[0]) : String(it.q.answer ?? '')
  }
}
function givenText(it: Item) {
  const v = answers.value[key(it)]
  const o = it.q.options ?? []
  if (v === undefined || (Array.isArray(v) && !v.length) || v === '') return '—'
  switch (it.type) {
    case 'single': return o[v as number] ?? '—'
    case 'multiple': return (v as number[]).map((i) => o[i]).join(', ')
    case 'truefalse': return v ? locale.quizTrue : locale.quizFalse
    case 'order': return (v as number[]).map((i) => o[i]).join(' → ')
    case 'text': return String(v)
  }
}

const progress = computed(() => (items.value.length ? ((index.value + (isChecked.value ? 1 : 0)) / items.value.length) * 100 : 0))

defineExpose({ restart: setup, result })
</script>

<template>
  <div class="m3-quiz flex flex-col gap-4 text-on-surface">
    <template v-if="!finished && current">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-3 text-label-large text-on-surface-variant">
          <span data-progress-text>{{ locale.quizQuestionOf.replace('{n}', String(index + 1)).replace('{total}', String(items.length)) }}</span>
          <span
            v-if="remaining !== null"
            class="ms-auto flex items-center gap-1 tabular-nums"
            :class="remaining <= 10 ? 'text-error' : ''"
            role="timer"
            :aria-label="`${locale.quizTimeLeft} ${clock}`"
            data-timer
          >
            <MIcon name="timer" :size="18" />{{ clock }}
          </span>
        </div>
        <div class="h-1 overflow-hidden rounded-full bg-secondary-container" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full rounded-full bg-primary transition-[width] duration-300" :style="{ width: `${progress}%` }" />
        </div>
      </div>

      <div :key="key(current)" class="m3-quiz__question flex flex-col gap-3">
        <h3 class="text-title-large" data-prompt>{{ current.q.prompt }}</h3>
        <img v-if="current.q.image" :src="current.q.image" alt="" class="max-h-64 w-full rounded-md object-cover" />
        <p v-if="current.type === 'multiple'" class="text-body-medium text-on-surface-variant">{{ locale.quizSelectAll }}</p>
        <p v-else-if="current.type === 'order'" class="text-body-medium text-on-surface-variant">{{ locale.quizOrderHint }}</p>

        <!-- choices -->
        <div
          v-if="current.type === 'single' || current.type === 'multiple' || current.type === 'truefalse'"
          class="flex gap-2"
          :class="current.type === 'truefalse' ? 'flex-row' : 'flex-col'"
          :role="current.type === 'multiple' ? 'group' : 'radiogroup'"
        >
          <template v-if="current.type === 'truefalse'">
            <button
              v-for="b in [true, false]"
              :key="String(b)"
              v-ripple
              type="button"
              role="radio"
              :aria-checked="value === b"
              class="m3-quiz__option relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-md border px-4 py-3 text-body-large"
              :data-state="isChecked && feedback === 'immediate' ? (current.q.answer === b ? 'correct' : value === b ? 'wrong' : 'idle') : value === b ? 'selected' : 'idle'"
              :disabled="isChecked"
              :data-option="String(b)"
              @click="set(b)"
            >
              {{ b ? locale.quizTrue : locale.quizFalse }}
            </button>
          </template>
          <button
            v-for="i in current.order"
            v-else
            :key="i"
            v-ripple
            type="button"
            :role="current.type === 'multiple' ? 'checkbox' : 'radio'"
            :aria-checked="optionState(current, i) === 'selected' || (current.type === 'multiple' ? ((value as number[]) ?? []).includes(i) : value === i)"
            class="m3-quiz__option relative flex items-center gap-3 overflow-hidden rounded-md border px-4 py-3 text-start text-body-large"
            :data-state="optionState(current, i)"
            :disabled="isChecked"
            :data-option="i"
            @click="current.type === 'multiple' ? toggleMulti(i) : set(i)"
          >
            <MIcon
              :name="current.type === 'multiple'
                ? (((value as number[]) ?? []).includes(i) ? 'check_box' : 'check_box_outline_blank')
                : value === i ? 'radio_button_checked' : 'radio_button_unchecked'"
              :size="22"
              class="shrink-0"
            />
            <span class="flex-1">{{ current.q.options?.[i] }}</span>
            <MIcon v-if="optionState(current, i) === 'correct'" name="check_circle" :size="22" class="text-success" />
            <MIcon v-else-if="optionState(current, i) === 'wrong'" name="cancel" :size="22" class="text-error" />
          </button>
        </div>

        <!-- order -->
        <ol v-else-if="current.type === 'order'" class="flex flex-col gap-2">
          <li
            v-for="(opt, pos) in (value as number[])"
            :key="opt"
            class="m3-quiz__option flex items-center gap-2 rounded-md border px-3 py-1.5 text-body-large"
            :data-state="isChecked && feedback === 'immediate' ? (opt === pos ? 'correct' : 'wrong') : 'idle'"
            :data-order-item="opt"
          >
            <span class="w-6 text-center text-label-large text-on-surface-variant tabular-nums">{{ pos + 1 }}</span>
            <span class="flex-1">{{ current.q.options?.[opt] }}</span>
            <MIconButton icon="arrow_upward" size="sm" :aria-label="locale.quizMoveUp" :disabled="isChecked || pos === 0" data-move="up" @click="move(pos, -1)" />
            <MIconButton icon="arrow_downward" size="sm" :aria-label="locale.quizMoveDown" :disabled="isChecked || pos === (value as number[]).length - 1" data-move="down" @click="move(pos, 1)" />
          </li>
        </ol>

        <!-- text -->
        <input
          v-else
          :value="(value as string) ?? ''"
          type="text"
          class="m3-quiz__input h-14 rounded-xs border border-outline bg-transparent px-4 text-body-large outline-none focus:border-2 focus:border-primary"
          :class="isChecked && feedback === 'immediate' ? (currentCorrect ? 'border-success' : 'border-error') : ''"
          :placeholder="locale.quizTypeAnswer"
          :aria-label="locale.quizTypeAnswer"
          :disabled="isChecked"
          data-text-answer
          @input="set(($event.target as HTMLInputElement).value)"
          @keydown.enter="answered(current) && (feedback === 'immediate' && !isChecked ? check() : next())"
        />

        <div
          v-if="showFeedback"
          class="flex gap-3 rounded-md p-3"
          :class="currentCorrect ? 'bg-success/12 text-on-surface' : 'bg-error-container text-on-error-container'"
          role="status"
          data-feedback
        >
          <MIcon :name="currentCorrect ? 'check_circle' : 'info'" :size="22" :class="currentCorrect ? 'text-success' : ''" />
          <div class="flex flex-col gap-1">
            <p class="text-title-small">{{ currentCorrect ? locale.quizCorrect : locale.quizIncorrect }}</p>
            <p v-if="!currentCorrect && current.type !== 'single' && current.type !== 'multiple' && current.type !== 'truefalse'" class="text-body-medium">
              {{ locale.quizCorrectAnswer.replace('{answer}', correctText(current)) }}
            </p>
            <p v-if="current.q.explanation" class="text-body-medium">{{ current.q.explanation }}</p>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <MButton
          v-if="feedback === 'immediate' && !isChecked"
          :disabled="!answered(current)"
          data-action="check"
          @click="check"
        >{{ locale.quizCheck }}</MButton>
        <MButton
          v-else
          :disabled="feedback === 'end' && !answered(current)"
          :icon="index === items.length - 1 ? 'flag' : 'arrow_forward'"
          data-action="next"
          @click="next"
        >{{ index === items.length - 1 ? locale.quizFinish : locale.quizNext }}</MButton>
      </div>
    </template>

    <template v-else-if="finished">
      <slot name="result" :result="result" :retry="setup">
        <div class="flex flex-col items-center gap-2 py-4 text-center" data-result>
          <div class="relative h-32 w-32">
            <svg viewBox="0 0 36 36" class="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" class="stroke-secondary-container" stroke-width="3" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                :class="result.passed ? 'stroke-primary' : 'stroke-error'"
                stroke-width="3"
                stroke-linecap="round"
                :stroke-dasharray="`${result.percent} 100`"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-headline-medium font-medium tabular-nums">{{ result.percent }}%</span>
          </div>
          <p v-if="passScore !== undefined" class="text-title-large" :class="result.passed ? 'text-primary' : 'text-error'" data-passed>
            {{ result.passed ? locale.quizPassed : locale.quizFailed }}
          </p>
          <p class="text-body-large text-on-surface-variant" data-score>
            {{ locale.quizScore.replace('{score}', String(result.score)).replace('{total}', String(result.total)) }}
          </p>
          <MButton v-if="allowRetry" variant="tonal" icon="replay" class="mt-2" data-action="retry" @click="setup">{{ locale.quizRetry }}</MButton>
        </div>
      </slot>

      <div v-if="review" class="flex flex-col gap-2">
        <h4 class="text-title-medium">{{ locale.quizReview }}</h4>
        <ol class="flex flex-col divide-y divide-outline-variant rounded-md border border-outline-variant">
          <li v-for="(it, i) in items" :key="key(it)" class="flex gap-3 p-3" :data-review="key(it)">
            <MIcon
              :name="result.answers[key(it)]?.correct ? 'check_circle' : 'cancel'"
              :size="22"
              :class="result.answers[key(it)]?.correct ? 'text-success' : 'text-error'"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <p class="text-body-large">{{ i + 1 }}. {{ it.q.prompt }}</p>
              <p class="text-body-medium text-on-surface-variant">{{ locale.quizTypeAnswer }}: {{ givenText(it) }}</p>
              <p v-if="!result.answers[key(it)]?.correct" class="text-body-medium text-on-surface-variant">
                {{ locale.quizCorrectAnswer.replace('{answer}', correctText(it)) }}
              </p>
              <p v-if="it.q.explanation" class="text-body-small text-on-surface-variant">{{ it.q.explanation }}</p>
            </div>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>

<style>
.m3-quiz__option {
  border-color: var(--color-outline-variant);
  transition: background-color 150ms ease, border-color 150ms ease;
}
.m3-quiz__option:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}
.m3-quiz__option[data-state='selected'] {
  border-color: var(--color-primary);
  background-color: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
}
.m3-quiz__option[data-state='correct'] {
  border-color: var(--color-success);
  border-width: 2px;
  background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
}
.m3-quiz__option[data-state='wrong'] {
  border-color: var(--color-error);
  border-width: 2px;
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
}
.m3-quiz__option:disabled {
  cursor: default;
}
.m3-quiz__option:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 2px;
}
.m3-quiz__question {
  animation: m3-quiz-in 250ms cubic-bezier(0.2, 0, 0, 1);
}
@keyframes m3-quiz-in {
  from { opacity: 0; transform: translateX(16px); }
}
@media (prefers-reduced-motion: reduce) {
  .m3-quiz__question { animation: none; }
}
</style>
