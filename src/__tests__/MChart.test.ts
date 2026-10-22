import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

// No canvas under happy-dom: stand-ins that record the data and options MChart hands Chart.js
const received: { data?: any; options?: any }[] = []
const Stub = defineComponent({
  props: ['data', 'options'],
  setup: (p) => () => {
    received.push({ data: p.data, options: p.options })
    return h('canvas')
  },
})
vi.mock('vue-chartjs', () => ({ Line: Stub, Bar: Stub, Pie: Stub, Doughnut: Stub, Radar: Stub }))
vi.mock('chart.js', () => {
  const noop = {}
  return { Chart: { register: () => {} }, CategoryScale: noop, LinearScale: noop, PointElement: noop, LineElement: noop, BarElement: noop, ArcElement: noop, RadialLinearScale: noop, Filler: noop, Tooltip: noop, Legend: noop, Title: noop }
})

const MChart = (await import('../components/MChart.vue')).default
const root = document.documentElement
const set = (vars: Record<string, string>) => Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--color-${k}`, v))

afterEach(() => {
  received.length = 0
  root.removeAttribute('style')
  root.removeAttribute('data-palette')
  document.head.querySelector('#chart-test-palette')?.remove()
})

describe('MChart', () => {
  it('re-reads the theme colors when the palette changes, not only the theme', async () => {
    const style = document.createElement('style')
    style.id = 'chart-test-palette'
    style.textContent = `:root { --color-on-surface: #111111; } :root[data-palette='green'] { --color-on-surface: #0a3d1a; }`
    document.head.appendChild(style)

    const w = mount(MChart, { props: { type: 'bar', data: { labels: [], datasets: [] } } })
    const legendColor = () => (w.vm as any).mergedOptions.plugins.legend.labels.color
    expect(legendColor()).toBe('#111111')

    document.documentElement.setAttribute('data-palette', 'green')
    await new Promise((r) => setTimeout(r)) // MutationObserver callbacks are async
    await nextTick()
    expect(legendColor()).toBe('#0a3d1a')
    w.unmount()
  })
})

async function render(props: Record<string, unknown>) {
  const w = mount(MChart, { props })
  await flushPromises()
  return { w, last: () => received[received.length - 1]! }
}

describe('MChart theme colors', () => {
  it('colors datasets without colors from the theme, one per series', async () => {
    set({ primary: '#6750a4', tertiary: '#7d5260', surface: '#fef7ff' })
    const { last } = await render({ type: 'line', data: { labels: ['a', 'b'], datasets: [{ data: [1, 2] }, { data: [3, 4] }] } })
    const [a, b] = last().data.datasets
    expect(a.borderColor).toBe('#6750a4')
    expect(a.backgroundColor).toBe('rgba(103, 80, 164, 0.15)')
    expect(b.borderColor).toBe('#7d5260')
  })

  it("never overrides a dataset's own colors", async () => {
    set({ primary: '#6750a4' })
    const { last } = await render({ type: 'bar', data: { datasets: [{ data: [1], backgroundColor: 'red' }] } })
    const ds = last().data.datasets[0]
    expect(ds.backgroundColor).toBe('red')
    expect(ds.borderColor).toBe('#6750a4')
  })

  it('colors each slice of a pie, separated by the surface color', async () => {
    set({ primary: '#111111', tertiary: '#222222', secondary: '#333333', surface: '#fef7ff' })
    const { last } = await render({ type: 'pie', data: { labels: ['a', 'b', 'c'], datasets: [{ data: [1, 2, 3] }] } })
    const ds = last().data.datasets[0]
    expect(ds.backgroundColor).toEqual(['#111111', '#222222', '#333333'])
    expect(ds.borderColor).toBe('#fef7ff')
  })

  it('takes its own color list, roles or CSS colors', async () => {
    set({ 'tertiary-container': '#ffd8e4' })
    const { last } = await render({ type: 'bar', colors: ['tertiary-container', '#00ff00'], data: { datasets: [{ data: [1] }, { data: [2] }] } })
    expect(last().data.datasets.map((d: any) => d.backgroundColor)).toEqual(['#ffd8e4', '#00ff00'])
  })

  it('follows a theme change', async () => {
    set({ primary: '#6750a4', 'on-surface': '#1d1b20' })
    const { last } = await render({ type: 'line', data: { datasets: [{ data: [1] }] } })
    expect(last().options.plugins.legend.labels.color).toBe('#1d1b20')
    set({ primary: '#d0bcff', 'on-surface': '#e6e0e9' })
    root.classList.add('dark')
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    expect(last().options.plugins.legend.labels.color).toBe('#e6e0e9')
    expect(last().data.datasets[0].borderColor).toBe('#d0bcff')
    root.classList.remove('dark')
  })
})
