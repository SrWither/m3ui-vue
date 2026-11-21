<script setup lang="ts">
/*
 * Internal (not exported from index.ts): the year grid of the four date pickers, Compose's YearPicker. Laid over
 * the weekday row and the days (the parent wraps them in a `relative` box), as tall as them: 72x36dp pills, 3 per
 * row, 16dp apart (DatePickerModalTokens SelectionYear*, YearsInRow, YearsVerticalPadding). The year on view is
 * filled, the current one outlined, the ones min/max leave no day in disabled (OnSurfaceVariant at 38%).
 */
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  years: { year: number; disabled: boolean }[]
  /** The year on view: the selected pill */
  viewYear: number
  locale: string
  /** The radiogroup's accessible name */
  label: string
}>()

const emit = defineEmits<{ pick: [year: number] }>()

const el = ref<HTMLElement>()
const currentYear = new Date().getFullYear()
const yearFormat = computed(() => new Intl.NumberFormat(props.locale, { useGrouping: false }))

// The grid's Tab stop (and first focus): the year on view, else the first enabled one
const tabStop = computed(() => {
  const on = props.years.find((y) => y.year === props.viewYear && !y.disabled)
  return (on ?? props.years.find((y) => !y.disabled))?.year
})

// Opens on the year on view, in the middle of the grid, with the focus on it (Compose requests it too)
watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  const btn = el.value?.querySelector<HTMLElement>('[tabindex="0"]')
  if (!el.value || !btn) return
  el.value.scrollTop = btn.offsetTop - (el.value.clientHeight - btn.offsetHeight) / 2
  btn.focus({ preventScroll: true })
}, { immediate: true })

// Arrows move the focus across the enabled years (a row is 3), Home/End to the ends; Enter/Space pick
function onKey(e: KeyboardEvent) {
  const buttons = Array.from(el.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])
  const i = buttons.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return
  const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, Home: -i, End: buttons.length - 1 - i }
  if (!(e.key in step)) return
  e.preventDefault()
  buttons[Math.min(buttons.length - 1, Math.max(0, i + step[e.key]!))]?.focus()
}
</script>

<template>
  <Transition name="m3-date-years">
    <div
      v-if="open"
      ref="el"
      class="absolute inset-0 grid auto-rows-min grid-cols-3 justify-items-center gap-y-4 overflow-y-auto bg-surface-container-high py-2"
      role="radiogroup"
      :aria-label="label"
      @keydown="onKey"
    >
      <button
        v-for="{ year: y, disabled } in years"
        :key="y"
        type="button"
        role="radio"
        :aria-checked="y === viewYear"
        :disabled="disabled"
        :tabindex="y === tabStop ? 0 : -1"
        class="flex h-9 w-[72px] items-center justify-center rounded-full text-body-large outline-none transition-colors focus-visible:ring-2 focus-visible:ring-secondary"
        :class="
          y === viewYear
            ? disabled ? 'bg-primary/38 text-on-primary' : 'cursor-pointer bg-primary text-on-primary'
            : disabled
              ? 'cursor-not-allowed text-on-surface-variant/38' + (y === currentYear ? ' border border-primary/38' : '')
              : y === currentYear
                ? 'cursor-pointer border border-primary text-primary hover:bg-primary/8'
                : 'cursor-pointer text-on-surface-variant hover:bg-on-surface-variant/8'
        "
        @click="emit('pick', y)"
      >
        {{ yearFormat.format(y) }}
      </button>
    </div>
  </Transition>
</template>

<style>
/* Compose: expandVertically + fadeIn from 0.6 (DefaultEffects) in, shrinkVertically + fadeOut (FastEffects) out */
.m3-date-years-enter-active {
  transition: clip-path 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-date-years-leave-active {
  transition: clip-path 150ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-date-years-enter-from {
  clip-path: inset(0 0 100% 0);
  opacity: 0.6;
}
.m3-date-years-leave-to {
  clip-path: inset(0 0 100% 0);
  opacity: 0;
}
</style>
