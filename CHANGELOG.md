# Changelog

All notable changes to `@m3ui-vue/m3ui-vue` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.6.4] - 2026-09-16

### Fixed
- `MSlider` `centered` and `range` variants: fill edges next to a real draggable thumb now anchor to that thumb's clamped (thumbInset-aware) position instead of the raw value percentage — previously, near 0%/100%, the fill could creep past a thumb pinned by `thumbInset` and swallow the gap that's supposed to stay visible there. `standard` already had this fix (`fillActiveSize`/`fillInactiveSize`); `centered`/`range` were still using raw `pctLo`/`pctHi`/`centerPct`
- `MSlider` `centered` and `range` variants' fill segment corners now match `standard`'s official M3 track-segment shape: the end touching the real track edge stays a rounded cap, the end facing a thumb/gap goes square. A segment flanked by a thumb-gap on *both* sides (range's middle segment between the two thumbs; centered's active segment, which never touches a real track end) is now square on every corner instead of using a uniform full-pill radius
- `MSlider` outer fill-corner radius (the track-end cap, all variants) nudged slightly rounder/softer than the plain shape-scale token

## [0.6.3] - 2026-09-15

### Fixed
- `MWindow`'s internal bring-to-front z-index counter is now module-scoped and truly shared across every instance — previously each window kept its own independent counter (despite a comment claiming otherwise), so with 3+ windows open, clicking one to bring it to the front could tie with another window's z-index and fail to actually come to the top
- `MWindow`'s z-index range now starts at `10` instead of `100`, keeping it below the app-level overlay scale (`MDialog` and every `*Modal` picker, `MSelect`/`MAutocomplete`/`MMultiSelect`/`MMultiAutocomplete`, `MSpotlightSearch`, `MCommandPalette` all use `z-50`) — windows no longer render on top of a real modal/spotlight/command palette
- `MTerminal`: the last line of the initial `lines` prop (and of any later update to it) is now written without a trailing newline, so the cursor sits right after that line's content instead of dropping to an empty line below it — matters for building an interactive shell-style demo where the last line is a prompt

## [0.6.2] - 2026-09-14

### Added
- New component: `MPageProgress` — thin top loading bar for page/route transitions (YouTube/NProgress style), fixed to the top of the viewport with a trickle-then-complete animation
- `MPageProgress` auto-detects vue-router (via `$router` on the current app instance, without adding `vue-router` as a dependency) and wires itself to `beforeEach`/`afterEach`/`onError` automatically — drop it once in your app layout and it just works if a router is present
- New composable `usePageProgress()` — shared, module-level `progress`/`isActive` state with `start()`, `set(pct)`, and `done()`, the same API `MPageProgress` uses internally, so it can also be driven by hand (a manual fetch, an app without vue-router, or on top of the router auto-wiring) instead of or alongside route navigation
- `MPageProgress` `auto` prop (default `true`) — set to `false` to disable the vue-router auto-wiring and drive it entirely through `usePageProgress()`
- `MPageProgress` `position` prop (`'top' | 'bottom'`, default `'top'`) — pins the bar to either edge of the viewport
- New component: `MBar` — a draggable Electron title bar (`-webkit-app-region: drag`, with `no-drag` carved out around interactive areas), for frameless (`frame: false`) Electron windows. `icon`/`title` (or `#icon`/`#title` slots), `titleAlign` (`'start' | 'center'`), and `#trailing`/default slots for extra content before the window controls
- `MBar` `platform` prop (`'windows' | 'macos'`, default `'windows'`) — on `'macos'` it reserves space for the OS's native traffic lights and hides the drawn controls by default (still overridable via `controls`)
- `MBar` `icon` accepts an image src (URL, data URI, or a path with a file extension) as well as a Material Symbol name — auto-detected, so an app logo works without a separate prop
- `MBar` draws minimize/maximize/close buttons matching native title bar conventions (full-height, close turns error-red on hover) and emits `minimize`/`maximize`/`close` events — it has no way to actually control the OS window itself, the host app wires these to its Electron main-process IPC; a `maximized` prop (driven by that same IPC state) swaps the maximize icon for restore. `minimizable`/`maximizable`/`closable` toggle each button independently; double-clicking empty drag space emits `maximize` by default (`doubleClickMaximize` to disable)
- `MSlider`: corner "stop" dots (start/end) now truly hide once the fill has passed them instead of just swapping tint; `standard` variant no longer shows a start indicator at all (matches the official M3 slider — only the far/unreached end is ever marked)
- `MSlider` thumb now keeps a real, constant margin from the track ends — it never touches the very edge, and the fill keeps a matching gap around it even at 0%/100% (previously the gap could visually disappear at the extremes)
- `MSlider` `standard` variant's fill pill corners: the outer end (away from the thumb) stays fully rounded, the end facing the thumb goes square, matching the official M3 slider's track segments
- `MSlider` gained `fillColor`/`thumbColor` props — custom CSS colors (hex, `rgb()`, a var…) for the filled track/dot and the thumb respectively, independent from `color` and not limited to the four M3 roles; the unfilled shade for a custom `fillColor` is derived automatically via `color-mix()`
- `MSlider` gained a `thumbIcon` prop to replace the draggable bar thumb with a Material Symbol icon (own size, grows slightly on press instead of pinching thin)
- `MSlider`'s corner `icon` prop now sits at its own edge inset (scaled to the thumb, not the tiny plain-dot inset) and is naturally covered by the thumb when it's on top of it, instead of a fragile percentage-based hide threshold
- `MSlider` `stops` variant: the dot for the step currently under the thumb now hides (checked against both thumbs in `range`)

---

## [0.6.1] - 2026-09-13

### Added
- New component: `MLightbox` — Material 3 fullscreen image lightbox with prev/next arrow navigation, keyboard arrow-key navigation, and swipe/drag-to-navigate via Pointer Events (mouse and touch)
- `MLightbox` auto-detects `<img>` elements rendered in its default slot (opt an image out with `data-lightbox="false"`) and wires click-to-open automatically, so wrapping arbitrary content — including `MMarkdown` output — makes every image in it clickable without building an `items` array by hand; pass an explicit `items` array instead for full programmatic control (`modelValue`/`index` v-models, `open()`/`close()`/`next()`/`prev()` exposed via template ref)
- `MLightbox` opens with a Discord-style animation: when opened from a detected/clicked thumbnail, the image visibly expands from that thumbnail's on-screen position and size to fullscreen; falls back to a plain scale-up when there's no originating element (e.g. opened programmatically without a source click)
- `MLightbox` `showThumbnails` prop (default `false`) shows a row of clickable thumbnails at the bottom for jumping directly to an image
- `MLightbox` `rounded` prop (default `true`) rounds the corners of the main opened image
- `MLightbox` `loop` prop (default `true`) controls whether navigating past the first/last image wraps around
- `createM3UI` gained a `persistPalette` option (default `true`, matching prior behavior) — set to `false` to make `palette` a hard default that always wins on boot regardless of what's already stored in `localStorage`, and to stop later `useColorPalette().set()` calls from persisting either (they still apply live)
- `useColorPalette()` gained `setPersistPalette(enabled)` to toggle `localStorage` persistence at runtime, plus a `persistPalette` ref reflecting the current state

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
