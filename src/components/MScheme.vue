<script lang="ts">
import { ref } from 'vue'
import type { GeneratedScheme } from '../composables/dynamicColor'

// Shared by every MScheme: the app's light/dark state (the `dark` class on <html>, whoever sets it), one observer
// for all of them, and the schemes and image seeds already built.
const isDark = ref(false)
let observer: MutationObserver | undefined
let users = 0
function watchDark() {
  if (users++ > 0) return
  const html = document.documentElement
  isDark.value = html.classList.contains('dark')
  observer = new MutationObserver(() => (isDark.value = html.classList.contains('dark')))
  observer.observe(html, { attributes: true, attributeFilter: ['class'] })
}
function unwatchDark() {
  if (--users > 0) return
  observer?.disconnect()
  observer = undefined
}

const schemes = new Map<string, Promise<GeneratedScheme>>()
const imageSeeds = new Map<string, Promise<string>>()
</script>

<script setup lang="ts">
/**
 * Paints its content with a color scheme of its own, built from a seed color or from an image's dominant color
 * (Material You's content color: an album, a dish or a profile photo coloring its own page), or one of the
 * palettes (a theme picker's previews). Every `bg-*`/`text-*`
 * M3 utility and every component inside it uses the scheme, in light or dark like the rest of the app, while the
 * rest of the app keeps its palette. Its text color is the scheme's `on-surface`; it sets no background.
 *
 * @slot default The content. Receives `{ seed, ready }`: the seed in use (the image's once it's read) and whether
 *   the scheme is applied yet
 * @event seed Emitted with the seed color read from `image`
 */
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { generateScheme, seedFromImage, type SchemeVariant } from '../composables/dynamicColor'
import { hasPaletteCss, palettes } from '../composables/useColorPalette'

const props = withDefaults(
  defineProps<{
    /** Seed color (`#rrggbb`) the scheme is built from */
    seed?: string
    /**
     * An image (URL) whose dominant color becomes the seed, picked as Android picks a wallpaper's. Cross-origin
     * images need CORS headers. `seed` wins while both are set
     */
    image?: string
    /**
     * One of the palettes (`useColorPalette().palettes`, custom ones included), applied to this element only with
     * its own CSS, in its standard contrast. `seed` and `image` win while set
     */
    palette?: string
    /** How the seed spreads into the scheme; `content` and `fidelity` keep the seed's own color most visible */
    variant?: SchemeVariant
    /** Contrast level: 0 standard, 0.5 medium, 1 high (-1 reduced) */
    contrast?: number
    /** Element to render */
    as?: string
  }>(),
  { variant: 'tonal-spot', contrast: 0, as: 'div' },
)

const emit = defineEmits<{ seed: [color: string] }>()

const imageSeed = shallowRef<string>()
const scheme = shallowRef<GeneratedScheme>()

// A palette with CSS (palettes.css, or a custom one with its own) is just its attribute on this element. 'purple'
// lives in :root with no [data-palette] block, and a custom palette may have none: those are built from their seed.
const paletteSeed = shallowRef<string>()
watch(
  () => props.palette,
  (id) => {
    paletteSeed.value = undefined
    if (!id || typeof document === 'undefined' || (id !== 'purple' && hasPaletteCss(id))) return
    paletteSeed.value = palettes.find((p) => p.id === id)?.seed
  },
  { immediate: true },
)
const paletteAttr = computed(() => (!props.seed && !props.image && props.palette && !paletteSeed.value ? props.palette : undefined))

const activeSeed = computed(() => props.seed ?? (props.image ? imageSeed.value : paletteSeed.value))

watch(
  () => props.image,
  async (src) => {
    imageSeed.value = undefined
    if (!src || typeof window === 'undefined') return
    let pending = imageSeeds.get(src)
    if (!pending) {
      pending = seedFromImage(src)
      imageSeeds.set(src, pending)
      pending.catch(() => imageSeeds.delete(src))
    }
    try {
      const color = await pending
      if (props.image !== src) return
      imageSeed.value = color
      emit('seed', color)
    } catch {
      // Unreadable image (failed to load, or cross-origin without CORS): keep the app's colors
    }
  },
  { immediate: true },
)

watch(
  () => [activeSeed.value, props.variant, props.contrast] as const,
  async ([seed, variant, contrast]) => {
    if (!seed) {
      scheme.value = undefined
      return
    }
    const key = `${seed}|${variant}|${contrast}`
    let pending = schemes.get(key)
    if (!pending) {
      pending = generateScheme(seed, { variant, contrast })
      schemes.set(key, pending)
    }
    const result = await pending
    if (activeSeed.value === seed && props.variant === variant && props.contrast === contrast) scheme.value = result
  },
  { immediate: true },
)

onMounted(watchDark)
onUnmounted(unwatchDark)

const style = computed(() => {
  if (!scheme.value || paletteAttr.value) return undefined
  const dark = isDark.value
  const out: Record<string, string> = { colorScheme: dark ? 'dark' : 'light' }
  for (const [role, value] of Object.entries(dark ? scheme.value.dark : scheme.value.light)) out[`--color-${role}`] = value
  return out
})
</script>

<template>
  <component
    :is="as"
    class="m3-scheme"
    :class="paletteAttr && isDark && 'dark'"
    :data-palette="paletteAttr"
    :style="style"
  >
    <slot :seed="activeSeed" :ready="!!style || !!paletteAttr" />
  </component>
</template>

<style>
/* Plain text inherits a color computed outside, with the app's palette: use the scheme's. In the base layer so a
   text-* class on the component wins. */
@layer base {
  .m3-scheme {
    color: var(--color-on-surface);
  }
}
</style>
