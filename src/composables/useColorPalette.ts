import { ref, watchEffect } from 'vue'

export interface Palette {
  id: string
  label: string
  seed: string
}

export const palettes: Palette[] = [
  { id: 'purple',      label: 'Morado',        seed: '#6750A4' },
  { id: 'indigo',      label: 'Índigo',        seed: '#4355B9' },
  { id: 'navy',        label: 'Marino',        seed: '#354BA0' },
  { id: 'blue',        label: 'Azul',          seed: '#005AC1' },
  { id: 'cyan',        label: 'Cian',          seed: '#006874' },
  { id: 'teal',        label: 'Teal',          seed: '#006B5F' },
  { id: 'green',       label: 'Verde',         seed: '#386A20' },
  { id: 'lime',        label: 'Lima',          seed: '#4C6706' },
  { id: 'olive',       label: 'Oliva',         seed: '#636118' },
  { id: 'amber',       label: 'Ámbar',         seed: '#785900' },
  { id: 'sand',        label: 'Arena',         seed: '#715C2E' },
  { id: 'orange',      label: 'Naranja',       seed: '#8B5000' },
  { id: 'deep-orange', label: 'Naranja oscuro', seed: '#96480A' },
  { id: 'brown',       label: 'Marrón',        seed: '#6E4C32' },
  { id: 'red',         label: 'Rojo',          seed: '#B82000' },
  { id: 'coral',       label: 'Coral',         seed: '#A03530' },
  { id: 'crimson',     label: 'Carmesí',       seed: '#9C4068' },
  { id: 'pink',        label: 'Rosa',          seed: '#9C4057' },
  { id: 'violet',      label: 'Violeta',       seed: '#7C39A4' },
  { id: 'slate',       label: 'Pizarra',       seed: '#4A6269' },
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
