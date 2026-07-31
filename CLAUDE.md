# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@m3ui-vue/m3ui-vue` — a Material Design 3 component library for Vue 3 + Tailwind CSS v4, published to npm. 120+ tree-shakeable, single-file components plus composables, palettes, and locales. It has no app of its own; the only way to see it running is inside a consumer project (e.g. the sibling repo `../newfadelresto-front`, which depends on it via `main.ts`: `app.use(createM3UI({ palette: 'red', locale: esLocale }))`).

There is no `docs/`, `playground/`, or `examples/` directory. The component table in `README.md` and the source itself are the only usage references — when in doubt about a component's props/slots, read the `.vue` file directly.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`, and the publish workflow pins `pnpm/action-setup@v4`).

- `pnpm build` — full build: `build:js` (vite lib build → `dist/*.js` + copies `m3ui-vue.css` to `dist/styles.css`) → `build:types` (`vue-tsc -p tsconfig.build.json`, emits `.d.ts` only) → `build:css` (copies `src/styles/` to `dist/styles/`, which is how `./theme` and `./palettes` subpath exports resolve straight from source).
- `pnpm test` — runs the full vitest suite once (`vitest run`).
- `pnpm test:watch` — vitest in watch mode.
- Single test file: `pnpm exec vitest run src/__tests__/MDialog.test.ts`. Single test name: `pnpm exec vitest run -t "renders content when open"`.
- **No standalone `lint` or `typecheck` script exists** — there is no ESLint/Prettier config in the repo at all. The closest thing to a typecheck is `pnpm build:types` (`vue-tsc -p tsconfig.build.json`), which type-checks the whole `src/` tree and emits declarations without a JS build. Run that after any nontrivial change instead of assuming a lint step exists.
- Tests run under `happy-dom` (`vitest.config.ts`) with a small `localStorage` polyfill in `src/__tests__/setup.ts` for environments where it's missing. Test coverage is thin — only a handful of components/composables have tests (`MAlert`, `MConfirmDialog`, `MDialog`, `MSpinner`, `plugin`, `useColorPalette`, `useDebounce`, `useLocale`, `useTheme`, `localePresets`). Most of the 120+ components have none; don't assume a component is tested just because it exists.

### Publishing

Versioning is manual: bump `version` in `package.json` and add an entry to `CHANGELOG.md` (Keep-a-Changelog style, "adheres to Semantic Versioning"), commit (repo convention is a lone commit literally titled `package version`), tag `vX.Y.Z`, and push the tag. `.github/workflows/publish.yml` triggers on `v*` tags, runs `pnpm build`, and publishes with `npm publish --provenance --access public` via npm trusted publishing (OIDC, no npm token secret). There is no CI workflow that runs tests on PRs/pushes — `publish.yml` is the only workflow in `.github/workflows/`.

### Multiple entry points

`vite.config.ts` builds several separate lib entries, not just one bundle — this matters when adding a component that pulls in a heavy dependency:

- `src/index.ts` → main `.` export (`dist/m3ui.js`)
- `src/chart.ts`, `src/code-editor.ts`, `src/markdown.ts`, `src/rich-text-editor.ts`, `src/terminal.ts` → subpath exports (`/chart`, `/code-editor`, `/markdown`, `/rich-text-editor`, `/terminal`)
- `src/locales/index.ts` → `/locales`

Components with heavy optional peer deps (`MRichTextEditor`/tiptap, `MCodeEditor`+`MJsonEditor`/codemirror, `MMarkdown`/markdown-it, `MTerminal`/xterm, `MChart`/chart.js+vue-chartjs) are deliberately **not** re-exported from `src/index.ts` — they live only in their dedicated entry file, and that entry file is why those peer deps are marked `optional: true` in `peerDependenciesMeta`. If you add a component with a new heavy dependency, follow this pattern: give it its own `src/<name>.ts` entry, add it to `vite.config.ts`'s `build.lib.entry` and to `exports` in `package.json`, and mark the new deps as optional peers rather than importing them from the main entry.

CSS is not code-split (`cssCodeSplit: false`) — all component styles land in one `m3ui-vue.css` regardless of entry point, copied to `dist/styles.css`.

## Architecture

### Component export pattern

Every component is a single-file `.vue` component under `src/components/`, exported as a **named default re-export** from `src/index.ts`:

```ts
export { default as MDatePicker } from './components/MDatePicker.vue'
```

`src/index.ts` is a flat, alphabetized-ish list of these plus the composable exports at the top. Components starting with `_` (e.g. `_MDrawerItemList.vue`, `_MTreeNode.vue`) are private helpers used internally by another component (`MNavigationDrawer`, `MTree`) and are intentionally **not** exported from `index.ts`, and are excluded from the type build in `tsconfig.build.json`. Follow that convention for any new internal-only helper component.

Public exports also include type re-exports living alongside a component (e.g. `export type { ButtonGroupOption } from './components/MButtonGroup.vue'`) — when a component defines an exported interface for its props/options, re-export the type from `index.ts` next to the component export, matching existing entries.

### The inline/dropdown vs. Modal picker pattern — NOT DRY, read before touching a picker

There's a recurring paired-component pattern for pickers: an inline/dropdown variant and a separate `*Modal` sibling.

- `MDatePicker` / `MDatePickerModal`
- `MTimePicker` / `MTimePickerModal`
- `MColorPicker` / `MColorPickerModal`
- `MDateRangePicker` / `MDateRangePickerModal`

The inline variant renders its popup via `Teleport to="body"` and positions it manually with `triggerEl.value.getBoundingClientRect()` against the trigger field. The Modal sibling is a **completely separate component** that also does `Teleport to="body"`, but renders as a centered `fixed inset-0` overlay, with its own `document.addEventListener('keydown', ...)` Escape handling and its own `document.body.style.overflow = 'hidden'` scroll lock, duplicated by hand in every Modal file rather than shared.

Confirmed by direct comparison: `MDatePicker.vue` and `MDatePickerModal.vue` each independently define their own `calendarDays` computed (calendar-grid generation logic), and each Modal reimplements Escape-key and scroll-lock handling that's already centralized in `MDialog.vue`. **`MDialog.vue` is not used by any of the `*Modal` picker components** — grep confirms it's only consumed by `MConfirmDialog.vue` and `MRichTextEditor.vue`. `MBottomSheet.vue` is similarly standalone and not wired into anything else.

Practical implications:
- If you fix a bug in one half of a pair (e.g. calendar-grid math, timezone handling, keyboard nav), **check the sibling file for the same bug** — it was very likely copy-pasted, not shared.
- If you're adding a new paired picker, the path of least resistance matching existing conventions is to duplicate an existing pair's structure rather than to factor out shared logic — but flag to the user if a shared internal composable/component would clearly be better, since nothing currently forces you to keep duplicating this.
- `MDialog.vue` (props: `modelValue`, `title?`, `maxWidth?`, `persistent?`, `fullscreen?`, `closeLabel?`; slots `#default`/`#title`/`#actions`; handles Escape + scroll lock + Teleport itself) is the generic modal shell that new modal-style components *should* reach for — it's already correct and tested (`src/__tests__/MDialog.test.ts`) — but be aware most of the existing `*Modal` pickers ignore it.

### Composables (`src/composables/`)

- **`useTheme()`** — light/dark/system theme. Module-level `ref<Theme>` seeded from `localStorage['m3-theme']`, applied via `document.documentElement.classList.toggle('dark', ...)` immediately on module load (before any component mounts, to avoid a flash). Returns `{ theme, cycle() }`; `cycle()` rotates light → dark → system. Listens to `prefers-color-scheme` media query changes while any component using it is mounted.
- **`useColorPalette()`** — runtime palette switching. Module-level `ref` seeded from `localStorage['m3-palette']` (default `'purple'`), applied by setting `data-palette="<id>"` on `<html>` (removed entirely for the `'purple'` baseline, which lives in `theme.css` rather than `palettes.css`). Returns `{ palette, palettes, set(id) }`. `set()` adds a `theme-transitioning` class (forces reflow, then removes it after 300ms) so the palette swap animates instead of snapping. Exports the `palettes: Palette[]` array (`{ id, label, seed }`) — this is the **actual source of truth for available palettes: 30 entries**, not the 20 listed in the README's "Color Palettes" prose (that list is stale/incomplete — cross-check `src/styles/palettes.css`, which has full light+dark `[data-palette='...']` blocks for all 29 non-purple ids, before trusting the README count).
- **`useFieldBg(containerEl, fieldBgProp)`** — auto-detects the M3 background color/CSS-var behind a field container so floating labels get a correctly colored cutout. Walks up `containerEl.value.parentElement` checking a fixed list of `bg-*` M3 utility classes (`M3_BG_CLASSES`) first (so it can reference the CSS var, e.g. `var(--color-surface-container-low)`, and stay in sync with theme transitions instead of resolving to a static computed color), then falls back to `getComputedStyle(el).backgroundColor` if no class matches, defaulting to `var(--color-surface)`. Re-resolves on a `MutationObserver` watching `class`/`style`/`data-theme` attribute changes on `<html>`. Returns `{ resolvedFieldBg }`, which prefers an explicit `fieldBg` prop over the auto-detected value.
- **`useLocale()`** — returns a `reactive` `M3Locale` object. Merges `defaultLocale` (English, ~90 keys covering common UI strings, tables, pickers, scheduler, transfer list, command palette, rich text editor toolbar, JSON editor/viewer, etc.) with an app-provided locale injected via the `M3_LOCALE_KEY` `InjectionKey<MaybeRef<Partial<M3Locale>>>` Symbol (provided by `createM3UI({ locale })`, see below). Reactive via `watchEffect` + `toValue()`, so a `ref`-wrapped locale updates live. `src/locales/` ships full translations: `esLocale`, `frLocale`, `ptLocale`, `deLocale`, `jaLocale`, `zhLocale`, `koLocale`, exported from the separate `/locales` entry point (`src/locales/index.ts`), not from the main `index.ts`.
- **`useDevice()`** — `isMobile` ref flipping at a 768px `window.innerWidth` breakpoint, backed by a single shared module-level `resize` listener (ref-counted via a `listeners` counter so it's attached once regardless of how many components call `useDevice()`, and detached when the last consumer unmounts).
- Also present: `useToast()` / `useNotification()` (imperative toast/notification composables, backed by `MSnackbar`/`MNotificationHost`), `useDebounce()`.

### Plugin: `createM3UI()` (`src/plugin.ts`)

```ts
createM3UI({ palette?: string, customPalettes?: Palette[], locale?: MaybeRef<Partial<M3Locale>> })
```

Returned as a Vue plugin object with an `install(app)`. It does two things:
1. If `options.palette` is set, isn't `'purple'`, and there's no `'m3-palette'` key in `localStorage` yet, it sets `data-palette` on `<html>` and seeds `localStorage`. This "only on first visit" guard is deliberate — once a user picks a palette via `useColorPalette().set()`, that persisted choice must win on every later boot instead of being clobbered back to the plugin's static default (see the comment in `plugin.ts`; there's a matching CHANGELOG fix: "createM3UI pisaba la paleta elegida por el usuario en cada boot").
2. If `options.locale` is set, `app.provide(M3_LOCALE_KEY, options.locale)`, which is what `useLocale()` reads.

`customPalettes` is accepted in the type but not currently consumed inside `install()` — worth double-checking before relying on it if asked to wire up custom palettes.

The plugin is optional — components work without `app.use(createM3UI(...))`; you just get the default `purple` palette and English strings.

### Theming / design tokens

Two CSS files, both plain CSS (not JS/TS config) and both exposed as npm subpath exports so consumers `@import` them directly rather than importing from a bundler config:

- **`src/styles/theme.css`** (subpath export `./theme`) — the Tailwind v4 `@theme` block defining the M3 baseline (purple) light-theme tokens as `--color-*` CSS custom properties (`--color-primary`, `--color-on-primary`, `--color-primary-container`, ... full M3 role set: primary/secondary/tertiary/error/success × base/on/container, surface variants, outline, inverse-*), plus `--radius-*` (shape scale), `--shadow-elevation-*`, and the full M3 type scale as `--text-*`/`--text-*--line-height` pairs. Also defines `.dark { ... }` overrides for the same tokens (dark scheme), base `body`/`::selection` styles, the `material-symbols-outlined` icon font class, and shared keyframe animations (`m3-ripple`, `m3-ctx-in`, `m3-progress-indeterminate`, `m3-wavy-spin`) plus the `.theme-transitioning` class both `useTheme()` and `useColorPalette()` toggle to animate transitions. Also has `@source '..'` so Tailwind scans the library's own component sources for utility classes, and `@custom-variant dark (&:where(.dark, .dark *))` enabling class-based dark mode.
- **`src/styles/palettes.css`** (subpath export `./palettes`) — 29 additional palettes (all of `useColorPalette.ts`'s `palettes` array except the `purple` baseline, which lives in `theme.css`), each as a pair of blocks: `[data-palette='<id>'] { --color-primary: ...; }` (light) and `[data-palette='<id>'].dark { ... }` (dark), overriding the same token names theme.css defines. Selecting a palette is purely an HTML attribute (`data-palette` on `<html>`, set by `useColorPalette()`/`createM3UI()`), combined with the existing `.dark` class for the scheme — the two dimensions (palette × scheme) compose via CSS selector combination, not JS.
- A third stylesheet, `dist/styles.css` (subpath export `./styles`, built from `src/index.ts`'s bundled CSS via `vite build`), carries component-scoped styles/animations that aren't design tokens (transitions, ripples, etc. defined in component `<style>` blocks). Consumers import all three: `theme`, `palettes`, then `styles`, in that order (see README).

Components consume tokens as ordinary Tailwind utility classes (`bg-primary`, `text-on-surface`, `bg-surface-container-high`, etc.) — Tailwind v4 auto-generates the utilities from the `--color-*` tokens defined in the `@theme` block, which is also why `useFieldBg`'s `M3_BG_CLASSES` list has to be hand-maintained as a fixed array of class names rather than derived dynamically.

## Cross-repo note

The sibling frontend repo `../newfadelresto-front` is the real-world consumer/proving ground for this library (installed via npm/pnpm as a normal dependency, not a workspace link, per its `package.json`). If a change here is meant to fix a bug reported from that repo, check `newfadelresto-front/src/main.ts` for how `createM3UI`/`esLocale` are wired, and the pinned version there for what's actually deployed — bumping this package's `version` here does not automatically update the consumer's lockfile.
