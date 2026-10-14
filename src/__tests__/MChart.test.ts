import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MChart from '../components/MChart.vue'

afterEach(() => {
  document.documentElement.removeAttribute('data-palette')
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
