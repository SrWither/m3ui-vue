import { ref, watchEffect } from 'vue'

export interface Palette {
  id: string
  label: string
  seed: string
}

export const palettes: Palette[] = [
  { id: 'purple',      label: 'Purple',      seed: '#6750A4' },
  { id: 'indigo',      label: 'Indigo',      seed: '#4355B9' },
  { id: 'navy',        label: 'Navy',        seed: '#354BA0' },
  { id: 'blue',        label: 'Blue',        seed: '#005AC1' },
  { id: 'cyan',        label: 'Cyan',        seed: '#006874' },
  { id: 'teal',        label: 'Teal',        seed: '#006B5F' },
  { id: 'green',       label: 'Green',       seed: '#386A20' },
  { id: 'lime',        label: 'Lime',        seed: '#4C6706' },
  { id: 'olive',       label: 'Olive',       seed: '#636118' },
  { id: 'amber',       label: 'Amber',       seed: '#785900' },
  { id: 'sand',        label: 'Sand',        seed: '#715C2E' },
  { id: 'orange',      label: 'Orange',      seed: '#8B5000' },
  { id: 'deep-orange', label: 'Deep Orange', seed: '#96480A' },
  { id: 'brown',       label: 'Brown',       seed: '#6E4C32' },
  { id: 'red',         label: 'Red',         seed: '#B82000' },
  { id: 'coral',       label: 'Coral',       seed: '#A03530' },
  { id: 'crimson',     label: 'Crimson',     seed: '#9C4068' },
  { id: 'pink',        label: 'Pink',        seed: '#9C4057' },
  { id: 'violet',      label: 'Violet',      seed: '#7C39A4' },
  { id: 'slate',       label: 'Slate',       seed: '#4A6269' },
  { id: 'graphite',    label: 'Graphite',    seed: '#5C5C5C' },
  { id: 'charcoal',    label: 'Charcoal',    seed: '#3C3C3C' },
  { id: 'steel',       label: 'Steel',       seed: '#5A6A72' },
  { id: 'ash',         label: 'Ash',         seed: '#6B6560' },
  { id: 'iron',        label: 'Iron',        seed: '#505864' },
  { id: 'fog',         label: 'Fog',         seed: '#625E6E' },
  { id: 'pewter',      label: 'Pewter',      seed: '#5A6360' },
  { id: 'smoke',       label: 'Smoke',       seed: '#4D5C66' },
  { id: 'stone',       label: 'Stone',       seed: '#68635A' },
  { id: 'zinc',        label: 'Zinc',        seed: '#585B5E' },
]

const current = ref(localStorage.getItem('m3-palette') ?? 'purple')

export function useColorPalette() {
  watchEffect(() => {
    const id = current.value
    localStorage.setItem('m3-palette', id)

    if (id === 'purple') {
      document.documentElement.removeAttribute('data-palette')
    } else {
      document.documentElement.setAttribute('data-palette', id)
    }
  })

  function set(id: string) {
    document.documentElement.classList.add('theme-transitioning')
    void document.documentElement.offsetHeight
    current.value = id
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 300)
  }

  return { palette: current, palettes, set }
}

// Apply on module load so palette is visible before any component mounts
const saved = localStorage.getItem('m3-palette')
if (saved && saved !== 'purple') {
  document.documentElement.setAttribute('data-palette', saved)
}
