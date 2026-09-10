# Changelog

All notable changes to `@m3ui-vue/m3ui-vue` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.6.0] - 2026-09-09

### Added
- New component: `MPinInput` — OTP/PIN code input with one box per character, auto-advance on type, smart backspace, arrow-key navigation, and full-code paste support
- `MPinInput` `type` prop (`'numeric' | 'alphanumeric'`) and `masked` prop (password-style dots) for PIN vs. verification-code use cases
- `MPinInput` `groups` prop (segment sizes, e.g. `[2, 4, 2, 3, 1, 3]`) with a configurable `separator` for license/activation-key style layouts — `length` is derived as the sum of the groups
- `MPinInput` `complete` event, fired once with the full value as soon as every box is filled
- `material-symbols` listed as an optional peer dependency, and documented as a self-hosted/offline alternative to the Google Fonts CDN for Material Symbols Outlined (see README "Fonts" section)
- New component: `MCopyButton` — copy-to-clipboard icon button with temporary success feedback, `copied`/`error` events
- New component: `MPasswordMeter` — password strength meter (length + character variety heuristic), 5 levels with customizable labels, emits `score`
- New component: `MRelativeTime` — auto-updating "3 minutes ago" / "in 2 hours" text using the native `Intl.RelativeTimeFormat`, with an adaptive refresh cadence
- `M3Locale` gained a `lang` field (BCP-47 tag, e.g. `'es'`) set by every packaged locale — `MRelativeTime` reads it via `useLocale()` to auto-match the app's configured locale (from `createM3UI({ locale })`) without needing a `locale` prop on every instance; the prop still overrides it when set
- New component: `MQRCode` — QR code generator rendered as inline SVG, available from the `@m3ui-vue/m3ui-vue/qrcode` entry point with `qrcode-generator` as an optional peer dependency (follows the same dedicated-entry pattern as `MChart`/`MMarkdown`)
- `MQRCode` `rounded` prop (default `true`) rounds the outer container corners for a softer, more M3-like frame — independent of the scannable pattern itself
- `MQRCode` `moduleStyle` prop (`'square' | 'dots'`, default `'square'`): `'dots'` rounds each module's corners individually based on its neighbors, so connected runs (the finder-pattern squares especially) merge into smooth shapes instead of showing notches; both styles scan identically
- New component: `MExportButton` — exports an array of objects to CSV or JSON with one click (triggers a real browser download), `exported`/`error` events, no dependencies
- New component: `MSignaturePad` — canvas signature capture with pointer events, `clear()`/`undo()`/`isEmpty()`/`toDataURL()` exposed via template ref, `begin`/`end`/`change` events
- New component: `MKbd` — keyboard-shortcut hint chip; accepts a `'+'`-delimited string or an array of keys, with a customizable `separator`
- New component: `MBarcode` — barcode generator (Code128, EAN13, UPC, CODE39, and other symbologies) rendered as inline SVG, available from the `@m3ui-vue/m3ui-vue/barcode` entry point with `jsbarcode` as an optional peer dependency (same dedicated-entry pattern as `MChart`/`MQRCode`), with an `error` slot for values invalid in the given format

---

## [0.5.10] - 2026-09-09

### Changed
- Bumped `vue` devDependency to `^3.5.42` and `vue-tsc` to `^3.3.11` (latest stable)
- `typescript` devDependency stays pinned at `~6.0.3` — TypeScript 7 (the new native/Go-based compiler) drops the classic JS Compiler API (`typescript/lib/tsc`) that `vue-tsc` relies on for `.vue` type-checking, so `pnpm build:types` fails against it until Vue tooling catches up

---

## [0.5.9] - 2026-08-19

### Added
- New component: `MShader` — renders a Shadertoy-style GLSL fragment shader (`code` prop) on WebGL2, with an optional WGSL module (`wgsl` prop) rendered on WebGPU when available (`renderer: 'auto' | 'webgpu' | 'webgl'`)
- `MShader` custom `uniforms` prop alongside the built-in `iTime`, `iResolution`, `iMouse`, and `iFrame` uniforms
- `MShader` `paused` and `pixelRatio` props, `#loading` / `#fallback` / `#error` slots, and `ready` / `error` events

---

## [0.5.8] - 2026-07-30

### Fixed
- `MDataTable`: the `#row-actions` and `#row-expand` slots are now re-evaluated on every render instead of being cached in a `computed` — Vue doesn't make `slots` reactive, so adding or removing either slot dynamically (e.g. `v-if` around `#row-actions`) no longer left the actions/expand column stuck showing (or hiding) stale state until a full remount

---

## [0.5.7] - 2026-07-30

### Added
- `MTimePicker`: picking an hour now emits `update:modelValue` immediately using the currently selected minute, instead of waiting until a minute is also picked

### Fixed
- `createM3UI({ palette })` no longer overwrites a palette the user already chose via `useColorPalette().set()` on every app boot — `palette` is now applied only as the first-visit default

---

## [0.5.6] - 2026-07-21

### Changed
- `MDataTable` `minHeight` no longer defaults to `20rem` — tables use their natural, content-driven height unless a caller explicitly passes `minHeight` to opt into a reserved floor (e.g. a day-agenda table that's often near-empty and shouldn't look tiny while filtering)
- `MDataTable` skeleton row count falls back to `perPage` when `minHeight` isn't set, and only fills it dynamically when a caller opts in

### Fixed
- `MDataTable` empty state now reserves a 200px minimum height by default even without `minHeight`, so "no results" no longer renders as a squashed one-line sliver

---

## [0.5.5] - 2026-07-21

### Changed
- `MDataTable` skeleton row count while loading is now sized to fill `minHeight` (rows needed to reach it, capped at `perPage`) instead of always rendering `perPage` rows — avoids a visible height jump when a table with a `minHeight` floor (e.g. a mostly-empty day agenda) finishes loading
- `MDataTable` empty-state message ("no results") is now vertically centered within the reserved height instead of sitting flush at the top; `minHeight` is applied only to the table's wrapper, not the `<table>` itself, avoiding inconsistent header growth across browsers

---

## [0.5.4] - 2026-07-18

### Fixed
- `MNavigationDrawer` static section titles no longer get compressed when the drawer runs short on vertical space

---

## [0.5.3] - 2026-07-18

### Fixed
- `MNavigationDrawer` long content no longer overflows its scrollable sections — flex children now shrink correctly (`min-height: 0`) instead of forcing the drawer taller

---

## [0.5.2] - 2026-07-09

### Fixed
- `MJsonEditor` and `MJsonViewer`: UI strings (valid/invalid badge, format/minify buttons, element/field counts) now come from the locale system instead of being hardcoded in Spanish
- `MJsonEditor`: formatting or minifying no longer gets immediately overwritten by a stale `modelValue` resync — the editor now only resyncs from outside when the actual data changes, not just its formatting
- `MCodeEditor`: text selection is now visibly highlighted
- `MCircleProgressBar` wavy variant: wave crest now travels right-to-left along the ring, matching Material's motion spec (was reversed)

---

## [0.5.1] - 2026-07-01

### Fixed
- `MContextMenu` now closes when the page is scrolled instead of staying anchored to a stale position
- Toast and notification duplicate-count badge no longer gets clipped mid-animation when the item is dismissed, and now fades out in sync with the item instead of popping off abruptly
- `MColorPicker` and `MColorPickerModal`: dragging on the saturation/brightness area past its edge no longer triggers native text selection on the surrounding page

---

## [0.5.0] - 2026-06-30

### Added
- New component: `MMenuDivider` — horizontal divider for use inside `MMenu` and `MContextMenu`
- `shortcut` prop on `MMenuItem` — displays a keyboard shortcut label aligned to the right of the item
- `MContextMenu` fully rewritten to slot-based composition — uses `MMenuItem` and `#children` slots just like `MMenu`, replacing the old `items: ContextMenuItem[]` prop
- `MTreeTable` expand/collapse animation — height + opacity JS transition hooks matching `MTree` and `MExpansionPanel`
- `errorLabel` prop on all input components — separates the error message string from the boolean `error` state

### Changed
- `error` prop on all input components (`MTextField`, `MNumberField`, `MMaskField`, `MSelect`, `MAutocomplete`, `MMultiAutocomplete`, `MMultiSelect`, `MTagInput`, `MTimePicker`, `MDatePicker`, `MDateRangePicker`, `MColorPicker`) changed from `string` to `boolean`; use new `errorLabel` for the message
- `MAbsolute` now defaults to `top: 8px; left: 8px` when no position props are provided
- `MWindow` corner resize handles enlarged from 12 px to 20 px and edge handles from 5 px to 8 px for easier grabbing

### Fixed
- `MSlider` range variant: moving one thumb past the other and then clicking near the crossed position caused the wrong thumb to jump — now tracks array index instead of logical position
- `MCircleProgressBar` indeterminate: trailing end trembled/shook at minimum arc size — fixed by animating `stroke-dashoffset` alongside `stroke-dasharray` so both ends never converge

### Removed
- `ContextMenuItem` type export (replaced by slot-based API)

---

## [0.4.7] - 2026-06-30

### Added
- New component: `MCircleProgressBar` — animated ring progress with `wavy` (bumpy wave) and `circle` (smooth arc) variants
- `MCircleProgressBar` default slot — embed any content (icon, image, text) centered inside the ring; hides the percentage label automatically
- `MCircleProgressBar` indeterminate state — M3-style spinning arc with subtle grow/shrink breathing animation
- `thickness` prop for both `MCircleProgressBar` and `MProgressBar` to control stroke width (defaults: 3 for wavy/circle, 4 for linear)
- `MProgressBar` wavy variant — wave smoothly appears when progress crosses 10 % and fades out at 100 %, with margin that appears/disappears in sync
- Toast and notification deduplication — identical messages stack into a single item showing a count badge instead of flooding the UI
- `icon: null` option in `useToast` and `useNotification` to suppress the icon entirely

### Fixed
- `MColorPicker` and `MColorPickerModal`: drag-to-pick not working on mobile/touch (added `touch-action: none`)
- `MCircleProgressBar`: edge gap between wave and track now scales sub-linearly with `thickness` to stay proportional at large values
- `MProgressBar` wavy variant: inactive track bar was overlapping the wave due to a Vue reactive style / rAF conflict on `left`

---

## [0.4.6] - 2026-06-25

### Fixed
- Flex1 in drawer modal not filling available height

---

## [0.4.5] - 2026-06-25

### Fixed
- Drawer custom content slot (`#default`) not stretching to use all available space

---

## [0.4.4] - 2026-06-24

### Added
- `MNavigationDrawer` item click event (`@item-click`) support

---

## [0.4.3] - 2026-06-24

### Added
- Debounced prop for text inputs — `MTextField` and other text-based inputs now accept a `debounce` prop

---

## [0.4.2] - 2026-06-24

### Added
- Dynamic locale switching at runtime

### Fixed
- Slider lag/jank on mobile devices

---

## [0.4.1] - 2026-06-24

### Fixed
- Modal variant broken in `MAutocomplete` and `MMultiAutocomplete`

---

## [0.4.0] - 2026-06-23

### Added
- New component: `MSplitButton` — button with a primary action and a dropdown secondary action
- New component: `MButtonGroup` — groups related buttons into a cohesive unit
- New component: `MToolbar` — horizontal toolbar container
- Button size variants: `xs`, `sm`, `md`, `lg`, `xl` on `MButton` and `MSplitButton`
- Ripple effect in `MIconButton` with matching size variants
- Segmented style variant for list components
- Dialog fullscreen variant
- Carousel improvements (beta)
- Rich tooltip: arbitrary content inside `MTooltip`
- `useNotification` composable and `MNotification` component for persistent app notifications
- `useDevice` composable exposing device/viewport info
- FAB auto-close on scroll
- FAB custom expand content via `#expand` slot
- Docked input variant auto-closes on scroll
- Modal variant for `MDatePicker` and `MTimePicker`
- Modal variant for `MColorPicker`
- Modal variant for `MSelect`, `MAutocomplete`, `MMultiAutocomplete`, and `MMultiSelect`
- Improved toast system with richer API

### Fixed
- Slider centered variant gap
- Expansion panel open/close animation regression
- Tag input (`MTagInput`) on mobile

---

## [0.3.1] - 2026-06-22

### Added
- New component: `MChatBubble` — speech-bubble style message display

### Fixed
- `MWindow` clamp-to-content behavior
- Touch event handling in `MWindow`
- `MWindow` vertical resize delay

---

## [0.3.0] - 2026-06-21

### Added
- New component: `MWindow` — draggable and resizable floating window
- New component: `MMultiAutocomplete` — multi-value autocomplete input
- `MAutocomplete` and `MTagInput` general improvements
- `hideSelected` option in `MSelect` and `MMultiSelect` to hide already-selected options
- Expand chips inline in `MMultiSelect`
- Custom value data support in `MSelect` and `MMultiSelect`

### Fixed
- Icons alignment in input fields (outline and filled variants)
- `MTopAppBar` / AppBar height adjustment

---

## [0.2.7] - 2026-06-21

### Added
- `MNavigationDrawer` default slot for placing arbitrary custom content

---

## [0.2.6] - 2026-06-21

### Added
- New header/footer slots in `MNavigationDrawer`

---

## [0.2.5] - 2026-06-21

### Added
- Right drawer support in `MAppLayout`
- Drawer position variants: `left`, `right`, `top`, `bottom`
- `MFooter` layout component
- `x` / `y` offset props on `MAbsolute` and `MFixed`
- Navigation slot in `MTopAppBar`

---

## [0.2.4] - 2026-06-21

### Added
- Configurable `width` prop on `MNavigationDrawer`
- `MAvatar` image fallback (shows initials when image fails to load)

### Fixed
- `MAppLayout` drawer width not reflecting custom width prop

---

## [0.2.3] - 2026-06-21

### Fixed
- Invisible custom scrollbar in WebKit-based browsers (Safari, Chrome on iOS)

---

## [0.2.2] - 2026-06-21

### Fixed
- Incorrect locale entry keys
- Test files incorrectly included in `tsconfig` compilation

---

## [0.2.1] - 2026-06-20

### Added
- Unit test suite

---

## [0.2.0] - 2026-06-20

### Added
- **i18n** — full internationalization support with `createM3UI({ locale })` and `useLocale()`
- Preset locale bundles (EN, ES, FR, DE, PT, and more)
- 10 new color palettes
- New component: `MCarousel` — image/content carousel
- `MDataTable` server-side pagination and sorting support
- New input types and variants
- Children item dividers in `MNavigationDrawer` with smooth transition animation
- Improved collapsed-variant children rendering in `MNavigationDrawer`

### Fixed
- Icons and placeholder alignment in input fields
- Input outline icon vertical alignment

---

## [0.1.11] - 2026-06-19

### Fixed
- Excess padding in drawer modal header

---

## [0.1.10] - 2026-06-19

### Added
- New components: `MEmoji`, `MEmojiButton`, `MEmojiSelector`
- Improved `MBadge` styling and variants
- Improved `MMarkdown` renderer
- `MIconButton` label is now optional

### Fixed
- `MMarkdown` and `MRichTextEditor` rendering issues
- `MTour` overflow on mobile
- `MFab` click not firing on mobile

---

## [0.1.9] - 2026-06-19

### Added
- New display and layout components: `MText`, `MTitle`, `MSubtitle`, `MSection`, `MRelative`, `MSticky`, `MCenter`, `MBox`
- Improved absolute/fixed positioning components and list layouts
- New props in `MAppLayout` and `MFab`

---

## [0.1.8] - 2026-06-18

### Added
- Drawer full-close animation
- `MDataTable` row expand/collapse animation
- Improved label rendering

### Fixed
- Minor Vue prop-type warnings
- `MIconButton` no longer requires a visible label

---

## [0.1.7] - 2026-06-18

### Fixed
- Dropdown element size on expand

---

## [0.1.6] - 2026-06-18

### Added
- Improved `MCard` variants and surface styling

---

## [0.1.5] - 2026-06-18

### Added
- Router-aware navigation components with `to` prop support; various minor fixes

---

## [0.1.4] - 2026-06-18

### Fixed
- `MTour` z-index stacking issue

---

## [0.1.3] - 2026-06-18

### Fixed
- Context menu children positioning

---

## [0.1.2] - 2026-06-18

### Added
- Vue language syntax highlighting in `MCodeEditor`
- Copy-to-clipboard icon in `MCodeEditor`
- Code editor general improvements
- Tailwind CSS source file entry point

### Fixed
- CSS styles import ordering
- `MFab` expand overflow clipping
- `MSelect` placeholder spacing when an option is selected
- Tooltip auto-close on scroll

---

## [0.1.1] - 2026-06-18

### Fixed
- NPM publish workflow and CI pipeline setup

---

## [0.1.0] - 2026-06-18

### Added
- Initial release of `@m3ui-vue/m3ui-vue`
- 80+ components across: Buttons, Inputs, Data Display, Feedback, Navigation, Layout, Overlays, Tables, Utility, Editors, and Advanced
- Full TypeScript support with exported types
- Tailwind CSS v4 integration via `@tailwindcss/vite`
- Material Design 3 theming with 20 built-in color palettes
- Dark / light / system theme switching
- Composables: `useToast`, `useTheme`, `useColorPalette`, `useLocale`
