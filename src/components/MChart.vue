<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  Title,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line, Bar, Pie, Doughnut, Radar } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  Title,
)

type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'radar'

const props = withDefaults(
  defineProps<{
    type: ChartType
    data: ChartData<any>
    options?: ChartOptions<any>
    height?: string
  }>(),
  { height: '300px' },
)

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

onMounted(() => { m3Colors.value = getM3Colors() })

const themeObserver = ref<MutationObserver | null>(null)
onMounted(() => {
  themeObserver.value = new MutationObserver(() => { m3Colors.value = getM3Colors() })
  themeObserver.value.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(() => m3Colors.value, () => {}, { deep: true })

const mergedOptions = computed<ChartOptions<any>>(() => {
  const c = m3Colors.value
  const base: ChartOptions<any> = {
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

const chartComponent = computed(() => {
  const map = { line: Line, bar: Bar, pie: Pie, doughnut: Doughnut, radar: Radar }
  return map[props.type]
})
</script>

<template>
  <div class="rounded-lg border border-outline-variant bg-surface p-4" :style="{ height }">
    <component
      :is="chartComponent"
      :data="data"
      :options="mergedOptions"
    />
  </div>
</template>
