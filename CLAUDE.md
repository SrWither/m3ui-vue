# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@m3ui-vue/m3ui-vue` — a Material Design 3 component library for Vue 3 + Tailwind CSS v4, published to npm. 135+ tree-shakeable, single-file components plus composables, palettes, and locales. It has no app of its own; the only way to see it running is inside a consumer project (e.g. the sibling repo `../newfadelresto-front`, which depends on it via `main.ts`: `app.use(createM3UI({ palette: 'red', locale: esLocale }))`).

There is no `docs/`, `playground/`, or `examples/` directory in this repo. The docs site is the sibling repo `../m3ui-vue-docs` (live at https://m3ui.dev, one page per component with live demos — see its own CLAUDE.md); it's also the place to see changes running, via its local `link:` dependency. When in doubt about a component's props/slots, read the `.vue` file directly.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`, and the publish workflow pins `pnpm/action-setup@v4`).

- `pnpm build` — full build: `build:js` (vite lib build → `dist/*.js` + copies `m3ui-vue.css` to `dist/styles.css`) → `build:types` (`vue-tsc -p tsconfig.build.json`, emits `.d.ts` only) → `build:css` (copies `src/styles/` to `dist/styles/`, which is how `./theme` and `./palettes` subpath exports resolve straight from source).
- `pnpm test` — runs the full vitest suite once (`vitest run`).
- `pnpm test:watch` — vitest in watch mode.
- Single test file: `pnpm exec vitest run src/__tests__/MDialog.test.ts`. Single test name: `pnpm exec vitest run -t "renders content when open"`.
- **No standalone `lint` or `typecheck` script exists** — there is no ESLint/Prettier config in the repo at all. The closest thing to a typecheck is `pnpm build:types` (`vue-tsc -p tsconfig.build.json`), which type-checks the whole `src/` tree and emits declarations without a JS build. Run that after any nontrivial change instead of assuming a lint step exists.
- Tests run under `happy-dom` (`vitest.config.ts`) with a small `localStorage` polyfill in `src/__tests__/setup.ts` for environments where it's missing. Test coverage is partial — `ls src/__tests__` for the current list (~28 files: a few dozen components plus `plugin`, `useColorPalette`, `useDebounce`, `useLocale`, `useTheme`, `usePageProgress`, `localePresets`). Most of the 135+ components have none; don't assume a component is tested just because it exists. When fixing a behavior bug, add a test that reproduces it and confirm it fails against the old code (`git stash`/`git checkout <file>`, run, restore) — `MRating.test.ts` and `MPullToRefresh.test.ts` are recent examples that mock `getBoundingClientRect` and dispatch synthetic touch events respectively.

### How changes are landed

1. Work targets one unreleased version at a time. When a new round of work starts, bump `package.json` to that version first, even before any code change (a lone `package version` commit).
2. Implement → `pnpm build:types` + `pnpm test` → `pnpm build:js` and `rm -rf ../m3ui-vue-docs/node_modules/.vite` so the docs site picks the change up (it links the built `dist/`, not `src/`) → the change gets verified visually in the docs site (on a real phone for touch behavior) by the maintainer.
3. Only after that verification: write the `CHANGELOG.md` entry **and** the docs changelog (`../m3ui-vue-docs/src/pages/ChangelogPage.vue`), then commit. Agents shouldn't write changelog entries or commit before the human reviewing the change says so.
4. Commit shape here: the code commit (`feat:`/`fix: ...`, code + its test), then a separate `update changelog` commit. Within one unreleased version, later items append to the same `## [x.y.z] - Unreleased` entry (`### Added` / `### Changed` / `### Fixed`; bold any change to default appearance or behavior).
5. The docs repo gets one commit per item (page changes + its `ChangelogPage.vue` line), never including its `link:`-pointing `package.json`/`pnpm-lock.yaml`. Nothing is pushed or tagged unless asked (a pushed `v*` tag publishes to npm; a push to the docs' `main` deploys m3ui.dev).
6. Whenever a component's behavior or props change, update its docs page in the same pass. See `../m3ui-vue-docs/CLAUDE.md` for that repo's layout and gotchas (no working typecheck there; validate with `pnpm exec vite build`).

### Publishing

Versioning is manual: bump `version` in `package.json` and add an entry to `CHANGELOG.md` (Keep-a-Changelog style, "adheres to Semantic Versioning"), commit (repo convention is a lone commit literally titled `package version`), tag `vX.Y.Z`, and push the tag. `.github/workflows/publish.yml` triggers on `v*` tags, runs `pnpm build`, and publishes with `npm publish --provenance --access public` via npm trusted publishing (OIDC, no npm token secret). There is no CI workflow that runs tests on PRs/pushes — `publish.yml` is the only workflow in `.github/workflows/`.

### Multiple entry points

`vite.config.ts` builds several separate lib entries, not just one bundle — this matters when adding a component that pulls in a heavy dependency:

- `src/index.ts` → main `.` export (`dist/m3ui.js`)
- `src/chart.ts`, `src/code-editor.ts`, `src/markdown.ts`, `src/rich-text-editor.ts`, `src/terminal.ts`, `src/qrcode.ts`, `src/barcode.ts` → subpath exports (`/chart`, `/code-editor`, `/markdown`, `/rich-text-editor`, `/terminal`, `/qrcode`, `/barcode`)
- `src/locales/index.ts` → `/locales`

Components with heavy optional peer deps (`MRichTextEditor`/tiptap, `MCodeEditor`+`MJsonEditor`/codemirror, `MMarkdown`/markdown-it, `MTerminal`/xterm, `MChart`/chart.js+vue-chartjs, `MQRCode`/qrcode-generator, `MBarcode`/jsbarcode) are deliberately **not** re-exported from `src/index.ts` — they live only in their dedicated entry file, and that entry file is why those peer deps are marked `optional: true` in `peerDependenciesMeta`. If you add a component with a new heavy dependency, follow this pattern: give it its own `src/<name>.ts` entry, add it to `vite.config.ts`'s `build.lib.entry` and to `exports` in `package.json`, and mark the new deps as optional peers rather than importing them from the main entry.

CSS is not code-split (`cssCodeSplit: false`) — all component styles land in one `m3ui-vue.css` regardless of entry point, copied to `dist/styles.css`.

## Architecture

### Component export pattern

Every component is a single-file `.vue` component under `src/components/`, exported as a **named default re-export** from `src/index.ts`:

```ts
export { default as MDatePicker } from './components/MDatePicker.vue'
```

`src/index.ts` is a flat, alphabetized-ish list of these plus the composable exports at the top. Components starting with `_` (e.g. `_MDrawerItemList.vue`, `_MTreeNode.vue`, `_MTransferPane.vue`) are private helpers used internally by another component (`MNavigationDrawer`, `MTree`, `MTransferList`) and are intentionally **not** exported from `index.ts`, and are excluded from the type build in `tsconfig.build.json`. Follow that convention for any new internal-only helper component.

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

### `MFab`'s `#content` slot as a generic FAB-anchored popover shell

Similar spirit to `MDialog` above, but for a Teleported panel anchored to a FAB instead of a centered/full-screen modal. `MFab.vue`'s `#content` slot (`open`/close, outside-click, scroll-away-close, and Escape are all handled internally — see `computeContentPos()`) is meant to be reused rather than reimplemented; `MFabMenu.vue` builds on it entirely (no independent open/close logic of its own), and the "Custom Content"/"Map Layer Switcher" demos on the Buttons docs page show ad-hoc `#content` usage. Panel-behavior knobs added for this: `align` (`'start' | 'end'`, which edge a panel wider than the FAB anchors to — `'end'` keeps it from running off-screen when the FAB sits bottom-right), `scrim` (a plain sibling of the panel with its own independent fade, deliberately never nested inside the panel so it doesn't inherit the panel's enter/leave transform), and `contentTransition` (`'scale' | 'fade' | 'none'` — set to `'fade'` or `'none'` when the slot content animates its own entrance, e.g. `MFabMenu`'s per-item stagger, so the panel doesn't *also* scale in as a group on top of that; `'fade'` still gives Vue a real transition duration to wait on before unmounting, so the content's own close animation isn't cut off).

### Porting M3 motion/dimensions from the real source, not eyeballing it

When implementing or fixing a component's visual/animation behavior against the M3 spec, the marketing site (m3.material.io) is a JS-rendered SPA that `WebFetch` cannot read (returns only the page title). The reliable source is Google's own `androidx/androidx` GitHub repo — the actual Kotlin Compose Material3 implementation and its design tokens:
- `gh api repos/androidx/androidx/contents/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/<Component>.kt -H "Accept: application/vnd.github.raw"` for the composable's logic (exact spring `dampingRatio`/`stiffness`, stagger/delay constants, which shape/size the component actually is).
- `gh search code "<TokenObjectName>" --repo androidx/androidx` to locate the right token file when the exact filename isn't obvious (e.g. app bar tokens live in `AppBarSmallTokens.kt`/`AppBarMediumTokens.kt`/`AppBarLargeTokens.kt`, not `TopAppBar*Tokens.kt`; the `TopAppBar` composables themselves are in `AppBar.kt`, not `Tabs.kt`/`TabRow.kt` naming assumptions), then fetch that `.../tokens/<Name>Tokens.kt` file the same way for concrete dp values.
- Motion specs resolve through `MotionSchemeKeyTokens` (`FastSpatial`/`FastEffects`/`DefaultSpatial`/`SlowEffects`, etc.) down to `StandardMotionTokens.kt`/`ExpressiveMotionTokens.kt` for the literal `dampingRatio`/`stiffness` numbers — Standard is the default scheme app-wide unless a component is Expressive-only (e.g. `LoadingIndicator`/`FloatingActionButtonMenu` are `@ExperimentalMaterial3ExpressiveApi`, so use the Expressive token values for those; a mainstream stable component like `TabRow` uses Standard).
- Concrete examples already ported this way: `MLoadingIndicator`'s shape-morph spring (Expressive `FastSpatial`-equivalent, dampingRatio 0.6/stiffness 200) and its rotation-tied-to-morph mechanic; `MFabMenu`'s per-item reveal (Expressive `FastSpatial` dampingRatio 0.6/stiffness 800 for the width wipe, `FastEffects` dampingRatio 1.0/stiffness 3800 for the opacity) and its `itemSize` default (`FabMenuBaselineTokens`: 56dp row height, 24dp icon, `titleMedium` text); `MTabs`' indicator (Standard `DefaultSpatial`, dampingRatio 0.9/stiffness 700 — two *independent* springs for offset and width is what actually produces the "stretch" look, not a hand-choreographed union-then-snap); `MSearchBar`'s collapsed/expanded dimensions (`SearchBarTokens`/`SearchViewTokens`: 56dp pill, docked 28dp corners, fullscreen 72dp header); `MTopAppBar`'s medium/large heights (`AppBarMediumTokens`/`AppBarLargeTokens`: 112dp/152dp).

### Spring/physics animations run on plain JS + rAF, never CSS transitions

Established convention across `MProgressBar`, `MCircleProgressBar`, `MLoadingIndicator`, `MPullToRefresh`, and `MTabs`: per-frame animation state (position, velocity, phase) lives in plain `let` variables outside Vue's reactivity, stepped inside a `requestAnimationFrame` loop, with the DOM/refs written to only once per frame (`el.style.transform = ...` or a single ref assignment) — not driven by CSS `transition`/`animation` properties, and not by per-frame Vue `ref` reads inside the hot loop. Reasons this matters in practice, learned the hard way this session: (1) a CSS `transition` declared once (e.g. in a template `:style` binding) will silently keep applying to *any* later write to that property, including a JS "instant, no-animation" code path that never meant to animate — an easy way to accidentally reintroduce or mask a bug (see the `MTabs` case below); (2) faithfully porting a real spring (dampingRatio/stiffness) requires actual per-frame numerical integration (semi-implicit Euler: `vel += (-stiffness*(pos-target) - 2*dampingRatio*sqrt(stiffness)*vel) * dt; pos += vel*dt`) since CSS easing curves can only approximate one, not retarget mid-flight with continuous velocity the way a real spring does; (3) a `:style="{ transform: ... }"` **reactive template binding** on an element whose transform is *also* being set imperatively (e.g. via a template ref in the rAF loop) will fight itself — Vue re-asserts the bound value on every re-render of that component for *any* reason (even an unrelated ref changing), silently overwriting the imperative write. If an element's transform/opacity is driven imperatively, don't also bind it reactively in the template — set the initial state once in `onMounted` instead.

**Stiff springs need substeps.** Semi-implicit Euler diverges when `dt` is too large for the stiffness: `FastEffects` (stiffness 3800) blows up at a dropped frame's 33ms step even with the usual `Math.min(dt, 1/30)` clamp. `_useSheetMotion.ts` integrates in fixed 4ms substeps; do the same for any spring stiffer than ~1500. Modal sheets (`MBottomSheet`, `MSideSheet`) share that composable through `<Transition :css="false" @enter @leave>` hooks plus `[data-sheet-panel]`/`[data-sheet-scrim]` markers; their old CSS enter animation never ran because a reactive drag `:style` transform overrode it (point (3) above). VTU stubs `<Transition>` by default, so tests of JS transition hooks need `global: { stubs: { transition: false } }`.

**Gotcha that cost real debugging time**: a component with both a `watch(() => props.modelValue, ...)` (animate) and a separate `watch(() => props.someArray, ..., { deep: true })` (meant to re-measure layout when the list itself changes) can race — an inline `:someArray="[...]"` literal in a *consumer's* template gets a brand-new array reference on every unrelated re-render of that consumer, firing the array watcher and (if it takes a "no animation, just snap" code path) instantly overriding an in-flight animation from the other watcher, since both resolve within the same tick. This was exactly the `MTabs` primary-indicator bug — fixed by making every code path that can legitimately move the indicator go through the same animated path (re-running an already-correct animation toward an unchanged target is a no-op, so it's safe even when both watchers fire together). If adding a similar dual-watcher pattern elsewhere, default to this rather than a `deep`-watched "snap" path.

### Drag-and-drop components: Pointer Events + springs + FLIP, never native HTML5 DnD

`MDragDropList` and `MKanban` were rebuilt on this pattern (0.8.6); reuse it for anything draggable. Native HTML5 drag-and-drop is ruled out: it never fires for touch on most mobile browsers, its ghost image can't be styled, and it can't animate the other items out of the way.

- **Press → activate:** `pointerdown` records the start and adds `window` listeners for move/up/cancel. Mouse/pen activate after ~4px of movement (so a plain click stays a click); touch activates on a ~350ms long press (moving >8px first cancels it as a scroll). A drag handle with `touch-action: none` can start instantly instead. Skip the press when the target is inside a control (`closest('input, textarea, select, button, a, label, [contenteditable]')`, plus any opt-out marker like MKanban's `[data-kanban-action]`) so slot content keeps working.
- **Blocking scroll once dragging:** `touch-action` is resolved when the finger lands and can't be changed mid-gesture (the original `MPullToRefresh` bug). Register a **non-passive** `touchmove` listener on the root (in `onMounted`) that calls `preventDefault()` only while a drag is active; also suppress `contextmenu` (long-press menu) and set `body.style.userSelect = 'none'` for the drag's duration.
- **Motion:** every item's offset is a spring (Standard `DefaultSpatial`, dampingRatio 0.9 / stiffness 700) in one rAF loop writing `style.transform` — the dragged item follows the pointer directly, the rest spring toward computed targets. Measure natural layout with `offsetTop`/`offsetHeight` (they ignore transforms). When the dragged item can't stay in its container (MKanban: crossing columns inside an `overflow-x` board), switch it to `position: fixed` at its own rect for the drag and un-fix it before the DOM update.
- **FLIP for every reorder:** `onBeforeUpdate` captures each item's on-screen position, `onUpdated` springs each item from old to new. This animates pointer drops, keyboard moves and parent-driven changes alike, and works across lists where Vue recreates the element (keyed by id in a component-level `Map`). Skip the capture while a drag is active.
- **Edge clamping:** clamp the lifted item to the list bounds and compare its center with `>=`/`<=` against neighbors' midpoints — with strict comparisons the clamped item can never reach the first/last slot (a real bug caught by tests).
- **Keyboard + a11y:** `Space`/`Enter` grab, arrows move (emitting each step so FLIP animates it), `Space`/`Enter` drop, `Esc` restores a snapshot; refocus the moved element in `onUpdated`; announce through an `aria-live` region with locale strings. Lifted look per M3 dragged tokens (`ListTokens`/`ElevatedCardTokens`: elevation Level 4, 16% state layer).
- **Escape hatches for custom content** (users ask for these after every redesign): an opt-in `bare` prop that drops the row/card shell (lift shadow becomes `filter: drop-shadow` so it follows the slot's shape), slot-scope values like `dragging` / `handleProps` (spread onto a custom grip), and marker attributes. All additive.

### Custom row content in list-like components

Same escape hatches outside drag-and-drop: `MTransferList` has an `#item` slot (`{ item, checked, side, toggle, move }`) that by default replaces only the row's inner content (keeping checkbox/highlight/hover), plus a `bare` prop where the slot draws the whole row (then the `<li>` itself becomes `tabindex=0 role=checkbox` so keyboard and a11y survive). Row click/dblclick/Enter handlers ignore events from controls inside the slot (`button, a, select, textarea, [contenteditable], input:not([type=checkbox]), [data-<component>-action]`).

To give a slot the consumer's own item type, make the component generic (`<script setup lang="ts" generic="T extends TransferItem = TransferItem">`). Exported interfaces can't live in a generic `<script setup>` (vue-tsc: "Modifiers cannot appear here"), so move them into a separate plain `<script lang="ts">` block in the same file; `index.ts`'s `export type { ... } from './X.vue'` keeps working.

### Adaptive layouts (`useWindowSizeClass`, `MNavigationSuite`, `MListDetail`, `MSupportingPane`)

Ported from androidx `material3-adaptive` (`WindowSizeClass` breakpoints in `window-core`, `PaneScaffoldDirective.kt`, `NavigationSuiteScaffold.kt`'s `navigationSuiteType`, `SupportingPaneScaffold.kt`'s default `Reflow(Main)`). Deliberate web departure: the components classify **their own size** (`useWindowSizeClass(rootRef)`, ResizeObserver on `offsetWidth/Height`), not the window, so they work in columns/dialogs and the docs can demo them in a resizable frame (`../m3ui-vue-docs/src/components/demos/AdaptiveFrame.vue`). Pane transitions are CSS (M3 emphasized curve), not Compose's springs; no extra/third pane, no tabletop posture. Current M3 `NavigationSuiteScaffold` never picks a drawer (compact width → short bar, compact height → short bar with `start` icons, else collapsed rail). In `MListDetail` both panes stay mounted in one-pane mode (hidden one gets `inert` + `visibility: hidden`) so list scroll and detail state survive.

Navigation items (`NavRailItem`, `ShortNavBarItem`, `NavigationSuiteItem`) take an optional `to`, resolved by the internal `src/composables/_useItemLink.ts` (not exported): `RouterLink` when the app registered vue-router's `RouterLink` (checked via `appContext.components`), a plain `<a href>` for a string `to` without it, and a `<button>` when there's no `to` or the item is disabled. Reuse it for any other navigation component that needs links, rather than the bare `:is="'RouterLink'"` string `MFab` uses, which renders an unresolved tag without vue-router.

**Gotcha:** an HTML comment placed before a component's root element makes the template a fragment in dev builds/tests, so the consumer's `class`/attrs silently stop falling through (production builds strip comments, which hides it). Put template comments *inside* the root element. Pre-existing instances (harmless in `dist/`): `MNavigationDrawer`, `MNavigationRail`, `MSkeleton`, `MStepper`, `MTabs`, `MTransferList`.

### `MWindow` (not an M3 spec component)

M3 has no window, so `MWindow` is built from M3 pieces and desktop conventions (GNOME as the reference the maintainer uses). Module-level `<script>` state is shared across instances: `sharedZIndex` and `activeWindowId` (only the front window gets the focused look: `surface-container-high` bar, elevation 3; others `surface-container`, elevation 1). Geometry lives in refs written by drag/resize directly; animated changes (maximize/restore, minimize) add the `m3-window-geometry` CSS transition class for 300ms only, so drags never lag. Detaching a maximized/snapped window waits for `DETACH_DISTANCE` (40px), then eases the size in a rAF loop while `positionFromAnchor()` keeps the grab point under the pointer. The `snap` preview is teleported into the parent element (the window clips its own content). All position clamping goes through `clampLeft`/`clampTop` (inside the parent, or with `offscreen` 1/4 of the width and the title bar kept visible); `snapAt` checks the sides before the top so a top corner means "that half".

### Locale strings with variables

There's no i18n library: built-in text goes in `M3Locale`. When a string needs values, use `{name}` placeholders replaced at the call site with `.replace('{pos}', ...)` (see `reorderGrabbed`, `kanbanMoved`). `localePresets.test.ts` requires every key in all 7 locales with non-empty values.

### `TransitionGroup` leave with `position: absolute`

The usual trick of making leaving items `position: absolute` (so siblings can `-move` into the gap) needs an explicit `top`: without one each leaving item sits at its static position, which shifts as its siblings leave the flow too, so a batch removal (e.g. MTransferList's "move all") piles every row onto the first slot while fading. `_MTransferPane.vue` snapshots each row's `offsetTop` in `onBeforeUpdate` (before the first leave changes the layout) and pins it in `@before-leave`. Reuse that for any list that can lose several items at once.

### Container queries

`MTransferList` lays out by its own width with Tailwind v4 container queries (`@container` on the root, `@xl:flex-row` etc.), not viewport breakpoints — right for components that may sit in a narrow column on a wide screen. These utilities reach consumers because `theme.css`'s `@source` scans the built `dist/`.

### Testing interaction-heavy components under happy-dom

happy-dom has no layout, so drag tests mock it: `Object.defineProperty(el, 'offsetTop'/'offsetHeight', ...)` per row and override `el.getBoundingClientRect` for containers/cards, then dispatch real `PointerEvent`s (`pointerdown` on the element, `pointermove`/`pointerup` on `window`) and use `vi.useFakeTimers()` for long presses. Remember the mock doesn't reflow when an item leaves the flow. For a bug fix, run the new test against the old file (`git stash push <file>`, run, `git stash pop`) to prove it reproduces. When `console.log` output is swallowed in a probe test, write results to a file in the scratchpad instead.

### Composables (`src/composables/`)

- **`useTheme()`** — light/dark/system theme. Module-level `ref<Theme>` seeded from `localStorage['m3-theme']`, applied via `document.documentElement.classList.toggle('dark', ...)` immediately on module load (before any component mounts, to avoid a flash). Returns `{ theme, cycle() }`; `cycle()` rotates light → dark → system. Listens to `prefers-color-scheme` media query changes while any component using it is mounted.
- **`useColorPalette()`** — runtime palette switching. Module-level `ref` seeded from `localStorage['m3-palette']` (default `'purple'`), applied by setting `data-palette="<id>"` on `<html>` (removed entirely for the `'purple'` baseline, which lives in `theme.css` rather than `palettes.css`). Returns `{ palette, palettes, set(id) }`. `set()` adds a `theme-transitioning` class (forces reflow, then removes it after 300ms) so the palette swap animates instead of snapping. Exports the `palettes: Palette[]` array (`{ id, label, seed }`) — this is the **actual source of truth for available palettes: 40 entries** (the README's "Color Palettes" section is kept in sync with this list — cross-check `src/styles/palettes.css`, which has full light+dark `[data-palette='...']` blocks for all 39 non-purple ids, if the two ever drift again).
- **`useFieldBg(containerEl, fieldBgProp)`** — auto-detects the M3 background color/CSS-var behind a field container so floating labels get a correctly colored cutout. Walks up `containerEl.value.parentElement` checking a fixed list of `bg-*` M3 utility classes (`M3_BG_CLASSES`) first (so it can reference the CSS var, e.g. `var(--color-surface-container-low)`, and stay in sync with theme transitions instead of resolving to a static computed color), then falls back to `getComputedStyle(el).backgroundColor` if no class matches, defaulting to `var(--color-surface)`. Re-resolves on a `MutationObserver` watching `class`/`style`/`data-theme` attribute changes on `<html>`. Returns `{ resolvedFieldBg }`, which prefers an explicit `fieldBg` prop over the auto-detected value.
- **`useLocale()`** — returns a `reactive` `M3Locale` object. Merges `defaultLocale` (English, ~90 keys covering common UI strings, tables, pickers, scheduler, transfer list, command palette, rich text editor toolbar, JSON editor/viewer, etc.) with an app-provided locale injected via the `M3_LOCALE_KEY` `InjectionKey<MaybeRef<Partial<M3Locale>>>` Symbol (provided by `createM3UI({ locale })`, see below). Reactive via `watchEffect` + `toValue()`, so a `ref`-wrapped locale updates live. `src/locales/` ships full translations: `esLocale`, `frLocale`, `ptLocale`, `deLocale`, `jaLocale`, `zhLocale`, `koLocale`, exported from the separate `/locales` entry point (`src/locales/index.ts`), not from the main `index.ts`.
  - **Adding locale keys** (any component that renders built-in text must use these, never hardcoded strings — `MResult` used to hardcode Spanish): add the key to the `M3Locale` interface and `defaultLocale` (English) in `useLocale.ts`, and to all 7 files in `src/locales/`. `localePresets.test.ts` enforces that every locale has every key with a truthy value (so no `''` defaults) and no extra keys. Components that take all their text via required props (e.g. `MEmptyState`'s `title`) don't need locale keys.
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
- **`src/styles/palettes.css`** (subpath export `./palettes`) — 39 additional palettes (all of `useColorPalette.ts`'s `palettes` array except the `purple` baseline, which lives in `theme.css`), each as a pair of blocks: `[data-palette='<id>'] { --color-primary: ...; }` (light) and `[data-palette='<id>'].dark { ... }` (dark), overriding the same token names theme.css defines. Selecting a palette is purely an HTML attribute (`data-palette` on `<html>`, set by `useColorPalette()`/`createM3UI()`), combined with the existing `.dark` class for the scheme — the two dimensions (palette × scheme) compose via CSS selector combination, not JS.
- A third stylesheet, `dist/styles.css` (subpath export `./styles`, built from `src/index.ts`'s bundled CSS via `vite build`), carries component-scoped styles/animations that aren't design tokens (transitions, ripples, etc. defined in component `<style>` blocks). Consumers import all three: `theme`, `palettes`, then `styles`, in that order (see README).

Components consume tokens as ordinary Tailwind utility classes (`bg-primary`, `text-on-surface`, `bg-surface-container-high`, etc.) — Tailwind v4 auto-generates the utilities from the `--color-*` tokens defined in the `@theme` block, which is also why `useFieldBg`'s `M3_BG_CLASSES` list has to be hand-maintained as a fixed array of class names rather than derived dynamically.

## Cross-repo note

The sibling frontend repo `../newfadelresto-front` is the real-world consumer/proving ground for this library (installed via npm/pnpm as a normal dependency, not a workspace link, per its `package.json`). If a change here is meant to fix a bug reported from that repo, check `newfadelresto-front/src/main.ts` for how `createM3UI`/`esLocale` are wired, and the pinned version there for what's actually deployed — bumping this package's `version` here does not automatically update the consumer's lockfile.
