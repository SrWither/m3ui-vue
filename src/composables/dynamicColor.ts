// Dynamic color: a full M3 color scheme (light and dark) generated from one seed color with Google's
// material-color-utilities (HCT, DynamicScheme). The package is loaded with a dynamic import, so apps that
// never use a seed don't download it; it's bundled into the library (its 0.4.0 ESM build has an extensionless
// import that Node can't resolve, which would break SSR and tests if it were left external).

export type SchemeVariant =
  | 'tonal-spot'
  | 'expressive'
  | 'vibrant'
  | 'fidelity'
  | 'content'
  | 'neutral'
  | 'monochrome'
  | 'rainbow'
  | 'fruit-salad'

export interface SeedOptions {
  /** How the seed spreads into the scheme. `tonal-spot` is Android's default (calm, seed-led). */
  variant?: SchemeVariant
  /** Contrast level: 0 standard, 0.5 medium, 1 high (-1 reduced). */
  contrast?: number
}

/** Token name (as in `--color-<name>`) → hex, for each scheme. */
export interface GeneratedScheme {
  light: Record<string, string>
  dark: Record<string, string>
}

/** The `--color-*` roles a generated scheme sets. `success*` is a library extension and stays as themed. */
export const schemeRoles = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'background', 'on-background',
  'surface', 'on-surface', 'surface-variant', 'on-surface-variant',
  'surface-dim', 'surface-bright',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'outline', 'outline-variant',
  'inverse-surface', 'inverse-on-surface', 'inverse-primary',
  'scrim', 'shadow',
  'primary-fixed', 'primary-fixed-dim', 'on-primary-fixed', 'on-primary-fixed-variant',
  'secondary-fixed', 'secondary-fixed-dim', 'on-secondary-fixed', 'on-secondary-fixed-variant',
  'tertiary-fixed', 'tertiary-fixed-dim', 'on-tertiary-fixed', 'on-tertiary-fixed-variant',
] as const

const camel = (role: string) => role.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

/** Generates the light and dark schemes for a seed color (`#rrggbb`). */
export async function generateScheme(seed: string, options: SeedOptions = {}): Promise<GeneratedScheme> {
  const mcu = await import('@material/material-color-utilities')
  const variants = {
    'tonal-spot': mcu.SchemeTonalSpot,
    expressive: mcu.SchemeExpressive,
    vibrant: mcu.SchemeVibrant,
    fidelity: mcu.SchemeFidelity,
    content: mcu.SchemeContent,
    neutral: mcu.SchemeNeutral,
    monochrome: mcu.SchemeMonochrome,
    rainbow: mcu.SchemeRainbow,
    'fruit-salad': mcu.SchemeFruitSalad,
  }
  const Scheme = variants[options.variant ?? 'tonal-spot'] ?? mcu.SchemeTonalSpot
  const source = mcu.Hct.fromInt(mcu.argbFromHex(seed))
  const colors = new mcu.MaterialDynamicColors() as unknown as Record<string, () => { getArgb(s: unknown): number }>
  const build = (dark: boolean) => {
    const scheme = new Scheme(source, dark, options.contrast ?? 0)
    const out: Record<string, string> = {}
    for (const role of schemeRoles) {
      const color = colors[camel(role)]?.call(colors)
      if (color) out[role] = mcu.hexFromArgb(color.getArgb(scheme))
    }
    return out
  }
  return { light: build(false), dark: build(true) }
}

/** CSS for a scheme under `[data-palette='<id>']` (light) and `[data-palette='<id>'].dark`, like palettes.css. */
export function schemeToCss(scheme: GeneratedScheme, id: string): string {
  const block = (tokens: Record<string, string>) =>
    Object.entries(tokens).map(([k, v]) => `  --color-${k}: ${v};`).join('\n')
  return `[data-palette='${id}'] {\n${block(scheme.light)}\n}\n[data-palette='${id}'].dark {\n  color-scheme: dark;\n${block(scheme.dark)}\n}\n`
}

/**
 * The seed color of an image's pixels (RGBA bytes, as `ImageData.data`): its colors quantized and scored the way
 * Android picks a wallpaper's source color (QuantizerCelebi + Score). Fully transparent pixels are skipped.
 */
export async function seedFromPixels(rgba: ArrayLike<number>): Promise<string> {
  const mcu = await import('@material/material-color-utilities')
  // QuantizerWsmeans starts from Math.random() cluster assignments, so the same image could give a different seed
  // on every read. Android's Java version seeds its Random with 0x42688: run it on a generator seeded the same way
  // (the quantization is synchronous, so nothing else sees the swap).
  const random = Math.random
  let state = 0x42688
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  try {
    return mcu.hexFromArgb(mcu.sourceColorFromImageBytes(rgba as Uint8ClampedArray))
  } finally {
    Math.random = random
  }
}

// Android's WallpaperColors scales a wallpaper down to about this many pixels before quantizing: plenty for
// picking a color, and fast whatever the image's size.
const EXTRACTION_AREA = 112 * 112

/**
 * The seed color of an image, for `generateScheme`, `useColorPalette().setSeed()` or `MScheme`: what Android does
 * with the wallpaper. Takes a URL (cross-origin images need CORS headers, or the canvas can't be read), an `<img>`,
 * an `ImageBitmap` or a `Blob` (a file the user picked). Browser only.
 */
export async function seedFromImage(source: string | HTMLImageElement | ImageBitmap | Blob): Promise<string> {
  let image: CanvasImageSource & { width: number; height: number }
  let objectUrl: string | undefined
  if (typeof source === 'string' || source instanceof Blob) {
    // A Blob goes through an <img> too: createImageBitmap decodes colors differently (another seed for the same
    // file than its URL gives)
    if (typeof source !== 'string') objectUrl = URL.createObjectURL(source)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = objectUrl ?? (source as string)
    try {
      await img.decode()
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    image = img
  } else {
    if (source instanceof HTMLImageElement && !source.complete) await source.decode()
    image = source
  }
  const w = (image as HTMLImageElement).naturalWidth || image.width
  const h = (image as HTMLImageElement).naturalHeight || image.height
  if (!w || !h) throw new Error('seedFromImage: the image has no size')
  const scale = Math.min(1, Math.sqrt(EXTRACTION_AREA / (w * h)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('seedFromImage: no 2D canvas')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return seedFromPixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
}
