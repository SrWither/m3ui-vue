<script setup lang="ts">
/**
 * A thin Chart.js wrapper — line, bar, pie, doughnut, and radar types, with legend/tooltip/axis colors that
 * automatically track the active M3 theme (light/dark, palette, contrast). Datasets without colors of their own get
 * the theme's too, one per series (one per slice in a pie or doughnut). Available from the `/chart` entry point.
 */
import { computed, ref, watch, onMounted, shallowRef, type Component } from 'vue'
import { useThemeTokens } from '../composables/useThemeTokens'

type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'radar'

const props = withDefaults(
  defineProps<{
    /** Chart type. Required — there is no default. */
    type: ChartType
    /** Chart.js data object with labels and datasets. Required — there is no default. */
    data: Record<string, any>
    /**
     * Chart.js options, deep-merged on top of MChart's own M3-themed defaults (legend/tooltip/axis colors that
     * track the active theme automatically)
     */
    options?: Record<string, any>
    /** Chart height */
    height?: string
    /**
     * Colors for datasets that don't set their own, in order (one per series; per slice in a pie or doughnut): M3
     * role names (`primary`, `tertiary-container`…) or any CSS colors. Default primary, tertiary, secondary, success,
     * error, outline
     */
    colors?: string[]
  }>(),
  { height: '300px' },
)

const SERIES = ['primary', 'tertiary', 'secondary', 'success', 'error', 'outline']

const ready = ref(false)
const chartComponent = shallowRef<Component | null>(null)
const componentMap = shallowRef<Record<string, Component>>({})

// Every role a color list may name, read as plain strings (a canvas can't resolve CSS variables) and kept current
// across theme, palette, contrast and generated-palette changes, settled after the switch's color transition
const ROLES = [
  'primary', 'secondary', 'tertiary', 'error', 'success', 'outline', 'outline-variant', 'inverse-primary',
  'primary-container', 'secondary-container', 'tertiary-container', 'error-container', 'success-container',
  'on-surface', 'on-surface-variant', 'surface', 'surface-container',
] as const
const tokens = useThemeTokens(ROLES)
const isRole = (c: string): c is (typeof ROLES)[number] => (ROLES as readonly string[]).includes(c)
const resolve = (c: string) => (isRole(c) ? tokens.value[c] : c)

// Canvas can't resolve CSS vars either for fonts: pass Chart.js the resolved stack, read again once web fonts load
// (text drawn before keeps the fallback)
const readFont = () =>
  (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim())
  || "'Roboto', system-ui, sans-serif"
const fontFamily = ref(readFont())

const m3Colors = computed(() => ({
  onSurface: tokens.value['on-surface'],
  onSurfaceVariant: tokens.value['on-surface-variant'],
  outlineVariant: tokens.value['outline-variant'],
  surface: tokens.value.surface,
  surfaceContainer: tokens.value['surface-container'],
  fontFamily: fontFamily.value,
}))

/** A color at some opacity, for fills under a line or inside a radar. */
function withAlpha(color: string, a: number) {
  const m = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (m) return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`
}

// Datasets without colors get the theme's: only the keys they leave unset, so a consumer's own colors always win
const themedData = computed(() => {
  const data = props.data
  if (!Array.isArray(data?.datasets)) return data
  const palette = (props.colors?.length ? props.colors : SERIES).map(resolve)
  const at = (i: number) => palette[i % palette.length]!
  const slices = props.type === 'pie' || props.type === 'doughnut'
  const datasets = data.datasets.map((ds: Record<string, any>, i: number) => {
    const fill: Record<string, any> = {}
    if (slices) {
      if (ds.backgroundColor === undefined) fill.backgroundColor = (ds.data ?? []).map((_: unknown, j: number) => at(j))
      // Slices separated by the card's own color
      if (ds.borderColor === undefined) fill.borderColor = m3Colors.value.surface
    } else {
      const c = at(i)
      if (ds.borderColor === undefined) fill.borderColor = c
      if (ds.backgroundColor === undefined) fill.backgroundColor = props.type === 'bar' ? c : withAlpha(c, props.type === 'radar' ? 0.2 : 0.15)
      if (props.type !== 'bar' && ds.pointBackgroundColor === undefined) fill.pointBackgroundColor = c
    }
    return { ...fill, ...ds }
  })
  return { ...data, datasets }
})

onMounted(async () => {
  fontFamily.value = readFont()
  document.fonts?.ready.then(() => { fontFamily.value = readFont() })

  const [chartjs, vueChartjs] = await Promise.all([
    import('chart.js'),
    import('vue-chartjs'),
  ])

  chartjs.Chart.register(
    chartjs.CategoryScale,
    chartjs.LinearScale,
    chartjs.PointElement,
    chartjs.LineElement,
    chartjs.BarElement,
    chartjs.ArcElement,
    chartjs.RadialLinearScale,
    chartjs.Filler,
    chartjs.Tooltip,
    chartjs.Legend,
    chartjs.Title,
  )

  componentMap.value = {
    line: vueChartjs.Line,
    bar: vueChartjs.Bar,
    pie: vueChartjs.Pie,
    doughnut: vueChartjs.Doughnut,
    radar: vueChartjs.Radar,
  }

  ready.value = true
})

watch(() => props.type, () => {
  if (ready.value) chartComponent.value = componentMap.value[props.type] ?? null
}, { immediate: true })

watch(ready, () => {
  chartComponent.value = componentMap.value[props.type] ?? null
})

const mergedOptions = computed<Record<string, any>>(() => {
  const c = m3Colors.value
  const base: Record<string, any> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: c.onSurface,
          font: { family: c.fontFamily, size: 12 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: c.surfaceContainer,
        titleColor: c.onSurface,
        bodyColor: c.onSurfaceVariant,
        borderColor: c.outlineVariant,
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { family: c.fontFamily, size: 13, weight: '600' as const },
        bodyFont: { family: c.fontFamily, size: 12 },
        displayColors: true,
        boxPadding: 4,
      },
    },
  }

  if (props.type !== 'pie' && props.type !== 'doughnut') {
    base.scales = {
      x: {
        grid: { color: withAlpha(c.outlineVariant, 0.25), drawTicks: false },
        ticks: { color: c.onSurfaceVariant, font: { family: c.fontFamily, size: 11 }, padding: 8 },
        border: { color: c.outlineVariant },
      },
      y: {
        grid: { color: withAlpha(c.outlineVariant, 0.25), drawTicks: false },
        ticks: { color: c.onSurfaceVariant, font: { family: c.fontFamily, size: 11 }, padding: 8 },
        border: { color: c.outlineVariant },
      },
    }
  }

  if (props.type === 'radar') {
    base.scales = {
      r: {
        grid: { color: withAlpha(c.outlineVariant, 0.25) },
        angleLines: { color: withAlpha(c.outlineVariant, 0.25) },
        pointLabels: { color: c.onSurfaceVariant, font: { family: c.fontFamily, size: 11 } },
        ticks: { color: c.onSurfaceVariant, backdropColor: 'transparent', font: { family: c.fontFamily } },
      },
    }
  }

  return deepMerge(base, props.options ?? {})
})

function deepMerge(target: any, source: any): any {
  const output = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] ?? {}, source[key])
    } else {
      output[key] = source[key]
    }
  }
  return output
}
</script>

<template>
  <div class="rounded-lg border border-outline-variant bg-surface p-4" :style="{ height }">
    <component
      v-if="ready && chartComponent"
      :is="chartComponent"
      :data="themedData"
      :options="mergedOptions"
    />
  </div>
</template>
