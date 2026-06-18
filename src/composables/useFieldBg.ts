import { ref, computed, onMounted, onBeforeUnmount, type Ref } from 'vue'

const M3_BG_CLASSES = [
  'bg-surface-container-highest',
  'bg-surface-container-high',
  'bg-surface-container-low',
  'bg-surface-container-lowest',
  'bg-surface-container',
  'bg-surface-variant',
  'bg-surface-bright',
  'bg-surface-dim',
  'bg-surface',
  'bg-background',
  'bg-inverse-surface',
  'bg-primary-container',
  'bg-secondary-container',
  'bg-tertiary-container',
  'bg-error-container',
  'bg-primary',
  'bg-secondary',
  'bg-tertiary',
  'bg-error',
] as const

function findM3BgVar(el: HTMLElement): string | null {
  for (const cls of M3_BG_CLASSES) {
    if (el.classList.contains(cls)) return `var(--color-${cls.slice(3)})`
  }
  return null
}

function isTransparent(color: string): boolean {
  if (!color || color === 'transparent') return true
  const m = color.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const parts = m[1]!.split(',').map((s) => s.trim())
    if (parts.length === 4 && parseFloat(parts[3]!) === 0) return true
  }
  return false
}

/**
 * Auto-detects the background behind `containerEl` and exposes it as `--field-bg`.
 * Prefers a CSS variable reference (e.g. var(--color-surface-container-low)) over a
 * raw computed color so the outlined label cutout transitions in sync with the rest
 * of the theme switch instead of lagging behind.
 *
 * @param containerEl  The element that receives `--field-bg` as an inline style.
 * @param fieldBgProp  Getter for the explicit `fieldBg` prop (overrides auto-detect).
 */
export function useFieldBg(
  containerEl: Ref<HTMLElement | null>,
  fieldBgProp: () => string | undefined,
) {
  const detectedBg = ref<string>('var(--color-surface)')

  function applyFieldBg(value: string) {
    detectedBg.value = value
    containerEl.value?.style.setProperty('--field-bg', fieldBgProp() ?? value)
  }

  function resolveBg() {
    let el: HTMLElement | null = containerEl.value?.parentElement ?? null
    while (el) {
      const cssVar = findM3BgVar(el)
      if (cssVar) { applyFieldBg(cssVar); return }
      if (el === document.body) { applyFieldBg('var(--color-surface)'); return }
      const bg = getComputedStyle(el).backgroundColor
      if (!isTransparent(bg)) { applyFieldBg(bg); return }
      el = el.parentElement
    }
    applyFieldBg('var(--color-surface)')
  }

  let observer: MutationObserver | null = null

  onMounted(() => {
    resolveBg()
    observer = new MutationObserver(() => resolveBg())
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    })
  })

  onBeforeUnmount(() => observer?.disconnect())

  const resolvedFieldBg = computed(() => fieldBgProp() ?? detectedBg.value)

  return { resolvedFieldBg }
}
