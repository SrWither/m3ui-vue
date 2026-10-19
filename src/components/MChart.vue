<script setup lang="ts">
/**
 * A thin Chart.js wrapper — line, bar, pie, doughnut, and radar types, with legend/tooltip/axis colors that
 * automatically track the active M3 theme (light/dark, and any palette swap). Available from the `/chart` entry
 * point.
 */
import { computed, ref, watch, onMounted, onBeforeUnmount, shallowRef, type Component } from 'vue'

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
  }>(),
  { height: '300px' },
)

const ready = ref(false)
const chartComponent = shallowRef<Component | null>(null)
const componentMap = shallowRef<Record<string, Component>>({})

function getM3Colors() {
  // No DOM on the server (SSR): the chart only draws on the client, which reads them again in onMounted
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement)
  const get = (v: string) => style?.getPropertyValue(v).trim() ?? ''
  return {
    primary: get('--color-primary'),
    onSurface: get('--color-on-surface'),
    onSurfaceVariant: get('--color-on-surface-variant'),
    outlineVariant: get('--color-outline-variant'),
    surface: get('--color-surface'),
    surfaceContainer: get('--color-surface-container'),
    // Canvas can't resolve CSS vars, so pass Chart.js the resolved font stack
    fontFamily: get('--font-sans') || "'Roboto', system-ui, sans-serif",
  }
}

const m3Colors = ref(getM3Colors())

let themeObserver: MutationObserver | null = null

onMounted(async () => {
  m3Colors.value = getM3Colors()

  themeObserver = new MutationObserver(() => { m3Colors.value = getM3Colors() })
  // `class` flips light/dark, `data-palette` switches the palette (useColorPalette / createM3UI).
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-palette'] })
  // Canvas text drawn before a web font finishes loading keeps the fallback, so redraw once it has
  document.fonts?.ready.then(() => { m3Colors.value = getM3Colors() })

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

onBeforeUnmount(() => { themeObserver?.disconnect() })

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
        grid: { color: c.outlineVariant + '40', drawTicks: false },
        ticks: { color: c.onSurfaceVariant, font: { family: c.fontFamily, size: 11 }, padding: 8 },
        border: { color: c.outlineVariant },
      },
      y: {
        grid: { color: c.outlineVariant + '40', drawTicks: false },
        ticks: { color: c.onSurfaceVariant, font: { family: c.fontFamily, size: 11 }, padding: 8 },
        border: { color: c.outlineVariant },
      },
    }
  }

  if (props.type === 'radar') {
    base.scales = {
      r: {
        grid: { color: c.outlineVariant + '40' },
        angleLines: { color: c.outlineVariant + '40' },
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
      :data="data"
      :options="mergedOptions"
    />
  </div>
</template>
