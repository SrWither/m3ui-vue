<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, shallowRef, type Component } from 'vue'

type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'radar'

const props = withDefaults(
  defineProps<{
    type: ChartType
    data: Record<string, any>
    options?: Record<string, any>
    height?: string
  }>(),
  { height: '300px' },
)

const ready = ref(false)
const chartComponent = shallowRef<Component | null>(null)
const componentMap = shallowRef<Record<string, Component>>({})

function getM3Colors() {
  const style = getComputedStyle(document.documentElement)
  const get = (v: string) => style.getPropertyValue(v).trim()
  return {
    primary: get('--color-primary'),
    onSurface: get('--color-on-surface'),
    onSurfaceVariant: get('--color-on-surface-variant'),
    outlineVariant: get('--color-outline-variant'),
    surface: get('--color-surface'),
    surfaceContainer: get('--color-surface-container'),
  }
}

const m3Colors = ref(getM3Colors())

let themeObserver: MutationObserver | null = null

onMounted(async () => {
  m3Colors.value = getM3Colors()

  themeObserver = new MutationObserver(() => { m3Colors.value = getM3Colors() })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

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
          font: { family: "'Roboto', system-ui, sans-serif", size: 12 },
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
        titleFont: { family: "'Roboto', system-ui, sans-serif", size: 13, weight: '600' as const },
        bodyFont: { family: "'Roboto', system-ui, sans-serif", size: 12 },
        displayColors: true,
        boxPadding: 4,
      },
    },
  }

  if (props.type !== 'pie' && props.type !== 'doughnut') {
    base.scales = {
      x: {
        grid: { color: c.outlineVariant + '40', drawTicks: false },
        ticks: { color: c.onSurfaceVariant, font: { size: 11 }, padding: 8 },
        border: { color: c.outlineVariant },
      },
      y: {
        grid: { color: c.outlineVariant + '40', drawTicks: false },
        ticks: { color: c.onSurfaceVariant, font: { size: 11 }, padding: 8 },
        border: { color: c.outlineVariant },
      },
    }
  }

  if (props.type === 'radar') {
    base.scales = {
      r: {
        grid: { color: c.outlineVariant + '40' },
        angleLines: { color: c.outlineVariant + '40' },
        pointLabels: { color: c.onSurfaceVariant, font: { size: 11 } },
        ticks: { color: c.onSurfaceVariant, backdropColor: 'transparent' },
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
