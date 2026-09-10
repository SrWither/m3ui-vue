<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    value: string | number | Date
    /** BCP-47 locale tag (e.g. 'es-ES'). Defaults to the app's locale (via createM3UI/useLocale), then the browser's locale. */
    locale?: string
  }>(),
  {},
)

const appLocale = useLocale()
const resolvedLocale = computed(() => props.locale ?? appLocale.lang)

const date = computed(() => new Date(props.value))
const now = ref(Date.now())

// Re-render at a cadence that matches the current magnitude — no point
// re-checking every second once we're already saying "3 hours ago".
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit; tick: number }[] = [
  { amount: 60, unit: 'seconds', tick: 1_000 },
  { amount: 60, unit: 'minutes', tick: 30_000 },
  { amount: 24, unit: 'hours', tick: 60_000 },
  { amount: 7, unit: 'days', tick: 3_600_000 },
  { amount: 4.34524, unit: 'weeks', tick: 3_600_000 },
  { amount: 12, unit: 'months', tick: 3_600_000 },
  { amount: Infinity, unit: 'years', tick: 0 },
]

let timer: ReturnType<typeof setTimeout> | undefined

function scheduleNext() {
  clearTimeout(timer)
  let duration = (date.value.getTime() - now.value) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      if (division.tick > 0) {
        timer = setTimeout(() => { now.value = Date.now(); scheduleNext() }, division.tick)
      }
      return
    }
    duration /= division.amount
  }
}

watch(date, () => { now.value = Date.now(); scheduleNext() }, { immediate: true })
onUnmounted(() => clearTimeout(timer))

const formatted = computed(() => {
  const formatter = new Intl.RelativeTimeFormat(resolvedLocale.value, { numeric: 'auto' })
  let duration = (date.value.getTime() - now.value) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return formatter.format(0, 'seconds')
})

const absolute = computed(() => date.value.toLocaleString(resolvedLocale.value))
</script>

<template>
  <time :datetime="date.toISOString()" :title="absolute">{{ formatted }}</time>
</template>
