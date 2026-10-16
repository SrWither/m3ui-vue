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
