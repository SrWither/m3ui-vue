# Changelog

All notable changes to `@m3ui-vue/m3ui-vue` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.2.2] - Unreleased

### Added
- `createM3UI` `storagePrefix`: every key the library stores (localStorage and cookies) becomes `<prefix>-m3-…`, so apps served from the same origin under different paths (`example.com/admin`, `example.com/shop`) keep their own theme, palette, contrast, seed and recent colors/emoji instead of sharing them. `themeInitScript()` and `viewportFromHeaders()` take the same `storagePrefix`
- `useConfetti` `duration`: a rain (`from: 'top'`) or, from a point, a fountain that keeps going that long, `count` then being pieces per second; `Infinity` runs until stopped. `fire()` returns a function that stops it early, letting the pieces already out finish falling
- `useFireworks()` / `launchFireworks()`: rockets rise from the bottom of the screen trailing a streak and burst, the classic way (sparks thrown out from the center in every direction, trailing streaks, slowed by drag and pulled down as they flicker out) or along an expressive shape (`shapes`: a ring, a heart, a flower…, kinematic so the shape stays readable). Mostly classic by default, in the theme's colors; `count`, `colors`, `size`, and `duration` + stop function like the confetti's. Shares useConfetti's canvas; nothing under reduced motion
- `useReactions()` / `fireReaction(origin, content, options)`: an emoji (any text) or a Material Symbol (`{ icon }`, filled, in the theme's primary where it starts) pops up and floats away swaying, like reactions over a live stream; `count`, `size`, `distance`, `duration`, `sway`. Played as Web Animations (the compositor runs them); under reduced motion it only fades in place
- `v-sparkle`: stars twinkle over an element, to draw the eye to something new or special: always or `'hover'` (pointer over it or focus in it), your own colors, MShape's shapes instead of stars, `size`, `rate`. Pauses off screen; none under reduced motion

### Changed
- **`MSlider`: a dragged thumb (and the active track) follows the pointer smoothly instead of jumping from step to step, then settles on its step when released.** The values emitted still snap to `step`; with `stops` (a discrete slider) it snaps as it goes, like Compose's

### Fixed
- Filled multiline `MTextField`: text scrolled up is clipped below the label instead of running behind it (the scrollbar starts below it too)

## [1.2.1] - 2026-10-22

### Fixed
- `MSegmentedButton` stretched by its container (in a flex column, or with `w-full`) left its segments at their natural width, its border running on past them: the segments now share the width

## [1.2.0] - 2026-10-22

### Added
- `MPullToRefresh` exposes `scrollEl` (the element that scrolls its content) and `scrollTo(options)` through a template ref
- `MProgressBar` and `MCircleProgressBar`: `color` also takes any CSS color, and the new `trackColor` sets the track (an M3 role or a CSS color). A CSS color without `trackColor` gets a track of itself at 24%
- `MRichTextEditor` `fill`: the editor takes the height you give it (`flex-1`, `h-full`…), keeping the toolbar in place and scrolling the text inside instead of growing with it; a click anywhere in the empty area lands in the text
- `MCarousel` and `MSimpleCarousel` expose `focus()`, so the arrow keys work right away when one opens in a full-screen viewer
- `MMenuItem` `#icon` slot (`{ on }`): replaces the leading icon with anything that fits its 20px box (a rotated `MIcon`, a color swatch, an avatar), in the icon's color
- `MNavigationDrawer` `accordion`: keeps one group open per level, so opening a group (by hand or by selecting) closes its siblings
- `MIconButton` `color`: an M3 role or any CSS color. Standard and outlined buttons use it for the icon, filled ones for the container (white on a CSS color, the role's on-color on a role), tonal ones for a 20% container with the color on it; disabled buttons and toggles keep their own colors
- `MSkeleton` `radius`: an M3 shape step (`none`, `xs`…`xl`, `full`) or any CSS length
- `MOverlay` `closeOnEscape` (through the library's Escape stack, so a dialog or menu opened over it takes Escape first), `lockScroll` (the shared scroll lock) and `transition` (your own `<Transition>` name instead of the fade; define its classes globally, the overlay is teleported)
- `MButton` and `MIconButton` `contentColor`: label/icon color over what the variant and `color` give, an M3 role (`on-surface` for a neutral text button) or any CSS color (`#000` on a white filled button)
- `MSearchField`: a pill-shaped search input that filters a list or grid in place (unlike `MSearchBar`, it never expands into a results view), in M3's search bar colors and shape. `v-model`, `size` (`sm` 40px, `md` 48px, `lg` 56px), clear button, `search` on Enter and `clear` events, Escape clears it (and once empty lets the key through to a dialog or menu around it), `#leading` (spaced for a 40px icon button like M3's) and `#trailing` slots; `class`/`style` go on the pill and other attributes on the `<input>`; defaults in the base layer so `bg-*`, `h-*`, `px-*` classes win
- `useAutoGrow(textarea, { minRows, maxRows, value })`: grows any `<textarea>` with its text between `minRows` and `maxRows` rows (measured from its own line height, padding and border), scrolling past the last; follows typing, changes from code through `value`, and width changes. `MTextField` `autoGrow` + `maxRows` (multiline) use it, with `rows` as the minimum and no drag handle
- `useThemeTokens(names)` is now public: the theme's colors as strings (`{ primary: '#6750a4', … }`) kept current across light/dark, palette, contrast and generated-palette changes and read again once the theme switch's transition settles, for what can't use CSS variables (a canvas, a map layer, chart colors computed in code)
- `MChart` colors datasets that don't set their own from the theme: primary, tertiary, secondary, success, error, outline in turn (one per slice in a pie or doughnut, separated by the surface color), or the new `colors` prop's list of roles or CSS colors. A dataset's own colors always win
- `MBottomSheet` and `MSideSheet` close on Escape (through the library's Escape stack, so a dialog or menu opened over them takes it first)
- `MTimeline`: `#item`, `#title`, `#dot` and `#opposite` slots (`{ item, index }`, in every layout; `#item-{i}` still works and wins for its entry), `bare` (only dots and line; `#item` draws each entry), `orientation="horizontal"`, generic items (your type reaches the slots) and a `key` field; it renders an `<ol>`
- `useScrollReveal(target, options)` and the `v-reveal` directive (registered by `createM3UI()`, exported as `vReveal`): elements fade, slide or grow in as they scroll into view, on M3 springs played by the compositor, cascading when several enter together. `effect` (`fade-up`, `fade`, `scale`, `slide-left`, `slide-right`), `distance`, `delay`, `stagger`, `once`, `threshold`, `rootMargin`, `scheme`, `speed`; nothing hides with reduced motion or on the server
- `MMenu` and `MContextMenu` push submenus go back with a swipe right on touch: the level follows the finger and, released past a third of the panel or flung, goes back; otherwise it springs into place. Vertical scrolling still works, and the item under the finger isn't tapped
- `MNavigationDrawer` `collapsedLabels`: in `collapsed` mode each item shows its label under its icon, with the selection and hover on a 56×32 pill around the icon, like `MNavigationRail`'s collapsed items, nested items included. Collapsed items (with or without it) also show their badge on the icon: a number as a count, text as a dot
- `useThemeTokens(names, { live: true })`: the values follow the theme switch's color fade frame by frame (as `rgba()` midway), so a canvas redrawn on change fades with the page instead of jumping to the new colors. Off by default; exported `ThemeTokensOptions` type
- `v-state-layer` directive (registered by `createM3UI()`, exported as `vStateLayer`): the M3 state layer on any element, a tint in its text color at 8% on hover (only on devices that hover), 10% on keyboard focus and press, 16% with `dragged`. Takes a CSS color or `{ disabled, color, dragged }`; `disabled`/`aria-disabled` hosts get none. Pairs with `v-ripple`
- `v-tooltip` directive (registered by `createM3UI()`, exported as `vTooltip`): `MTooltip`'s plain tooltip on any element without wrapping it, from a string or `{ text, placement, delay, disabled }`, with the same input as `MTooltip` (hover after a delay, keyboard focus, long press on touch, Escape and scroll hide it) and `aria-describedby` while it shows
- `v-focus-ring` directive (registered by `createM3UI()`, exported as `vFocusRing`): M3's focus indicator (3dp, `secondary`, 2dp outside, following the corners) on keyboard focus only, beating an `outline-none` on the same element. Takes a CSS color or `{ disabled, color, inset, within }` (`inset` draws it inside the edge for clipped rows, `within` also shows it while a descendant has keyboard focus)
- `v-scroll-elevation` directive (registered by `createM3UI()`, exported as `vScrollElevation`): your own header takes M3's scrolled container color (`surface-container`) and a `data-scrolled` attribute once the content under it scrolls, as the top app bar does. Follows the window, a selector or `{ target, threshold, color, onChange, disabled }` (`color: false` only sets the attribute; an empty template ref waits for its element)
- `v-long-press` directive (registered by `createM3UI()`, exported as `vLongPress`): calls a handler when an element is pressed and held (touch, pen or mouse), swallowing the click it ends in and the browser's long-press menu; moving past the tolerance (a scroll) cancels it. `data-long-pressing` while held; `{ handler, duration, tolerance, haptic, mouse, disabled }`
- `v-swipe` directive (registered by `createM3UI()`, exported as `vSwipe` with `SwipeInfo`/`SwipeDirection`): calls a handler when an element is swiped left, right, up or down, past `threshold` px or flicked faster than `velocity`. Sets the element's `touch-action` from the directions listened to (left/right leave vertical scrolling to the page), lets drags along other axes scroll, swallows the click a swipe ends in, and reports `onMove`/`onEnd` for feedback; mouse drags opt in with `mouse`
- `v-click-outside` directive (registered by `createM3UI()`, exported as `vClickOutside`): calls a handler when a primary-button press lands outside the element, armed after the event that mounted it. `{ handler, exclude, event, disabled }`: `exclude` takes elements or selectors that count as inside (a toggle button, a teleported popup), `event: 'click'` waits for the press to end
- `v-skeleton` directive (registered by `createM3UI()`, exported as `vSkeleton`): the real element becomes its own loading placeholder while `loading`, keeping its size and corners, hiding its content (which still sizes it), with `MSkeleton`'s tint and `pulse`/`wave`/`none` animation (none with reduced motion), ignoring the pointer and `aria-busy`
- `MMap` `transformStyle`: MapLibre's hook for a `mapStyle` change, to edit the next style before it loads (runs after `keepLayers`)
- `MMapLayers`, `MMapBaseLayers` and `MMapFilter` work outside the `MMap` (a side panel, a drawer) with a `map` prop: the `MMap`'s template ref. `useMap()`, `useMapLayers()` and `useMapFilter()` take one too (a ref or a getter), for your own panels; they're empty until the map mounts. `MMap` exposes its `context`; new `MapSource` type
- `MTimeline` progress: `current` (the current step's index) or items' `status` (`done`/`current`/`pending`) make it a progress timeline, in every layout: done steps filled with a solid line, the current one with a pulsing halo (still with reduced motion) and `aria-current="step"`, pending ones outlined with a dashed line. New `TimelineStatus` type
- `MTimeline` groups: an entry's `group` ("Today", "Yesterday") puts a header before each run of entries sharing it, the line ending with the run, in every layout; `#group` (`{ group, items }`) replaces the header
- `MTimeline` animates changes (`animate`, default `true`; not with reduced motion): entries added after it mounts fade and slide in wherever they land, and the others move to their new places on M3 springs instead of jumping. Needs items' `key`
- `MTimeline` `limit`: shows the first entries with a "Show N more" / "Show less" button for the rest (`v-model:expanded` optional; the revealed entries slide in). New locale keys `timelineShowMore` (`{count}`) and `timelineShowLess`
- The directives `createM3UI()` registers are typed for templates (`GlobalDirectives`), so vue-tsc / Volar check `v-tooltip`, `v-skeleton`, `v-swipe`… values. `v-skeleton`, `v-focus-ring` and `v-state-layer` render their markers on the server too, so an SSR page (Nuxt) shows the placeholder before it hydrates
- `viewportFromHeaders(headers)` and `VIEWPORT_HINTS`, for server rendering: the window size to render the adaptive layouts at, from a request's `m3-viewport` cookie, Chromium's viewport client hints, or on a first visit a size standing for the kind of device (`Sec-CH-UA-Mobile`, then the user agent: phone, tablet or desktop). `@m3ui-vue/nuxt` 0.3.0 uses it

### Changed
- **`MTimeline`'s alternating layout folds into a single column while the timeline is narrower than 32rem** (its own width, a container query): the line on the left, `#opposite` under the content. `:responsive="false"` keeps it alternating
- **`MMap` keeps the sources and layers added at runtime when `mapStyle` changes** (`keepLayers`, default `true`): yours through `useMap()` and those of `MMapGeoJson`, `MMapMeasure`… are carried into the new style, on top of its layers, instead of vanishing as with MapLibre alone. `:keep-layers="false"` drops them as before; a function picks the layers to carry
- **`MMenu` and `MContextMenu` push submenus have a new back header**: an `arrow_back` and the submenu's title in `label-large` `on-surface-variant`, like an M3 menu group label, followed by a menu divider, instead of a chevron, the parent's icon and the title in body text over a border
- **`MTimeline`'s alternating layout draws its line in each entry's color**, like the single-column one, instead of `outline-variant`
- **`MSegmentedButton` and `MButtonGroup` are generic over their options' value type**, so `v-model` is typed after it (`SegmentedOption<V>`, `ButtonGroupOption<T>`; a single value, or an array with `multiSelect`; `MButtonGroup` also `null`). Types only, nothing changes at runtime; a ref typed wider than its options (say `string | number | (string | number)[]` with string options) now fails type checking: type the ref or the options
- `MMenu` and `MContextMenu` push submenus (`submenu-mode="push"`): the panel's height follows the new level on an M3 spring instead of snapping to it, levels change with M3's shared axis X (a 30dp slide with a crossfade) instead of a full-width slide, and no scrollbar shows while they cross
- **`MNavigationDrawer` opens the groups that hold the selected item whenever `selected` changes** (`expandSelected`, default `true`), so a page reached through a route or a link shows its place in the tree; `:expand-selected="false"` keeps the old behavior

### Fixed
- `MTimeline`'s line was invisible for `secondary`, `tertiary`, `error` and `success` entries (a class built at runtime Tailwind never generated), stopped short of the next dot, and wandered when entries with and without icons were mixed
- Escape inside a dialog (or over one) closed the dialog along with whatever handled it: an open `MSelect`/`MAutocomplete`/`MMultiAutocomplete` list, an expanded `MSearchBar`, a visible `MTooltip`, a keyboard move in `MDragDropList`/`MKanban`, `MLightbox`, `MCommandPalette`, `MSpotlightSearch`, a modal `MNavigationRail`, an `MMapMeasure` measurement. They now stop the key once they use it, or go through the library's Escape stack, so one Escape closes the topmost thing only
- `MChart`'s axes, legend and tooltips missed contrast and generated (seed) palette changes and could keep mid-transition colors after a theme switch; they now go through `useThemeTokens`. Its grid color also works with non-hex tokens
- `MOverlay` dropped the consumer's `class`, `role`, `aria-*` and listeners (a Teleport root): they now go on the content layer, over the scrim
- `MMenu` and `MContextMenu` inside an `MDialog` or an `MOverlay`: Escape closed the menu and the dialog together; menus now take Escape through the library's stack, so it closes the menu alone
- `MSkeleton`'s default size and corners no longer beat the consumer's classes: they moved from inline styles and utilities to the base layer, so `w-40`, `aspect-video` or `rounded-xl` apply without `!`
- `MPullToRefresh` keeps its scroll position inside a `<KeepAlive>`: the browser dropped it while the view was detached, so it came back at the top

## [1.1.4] - 2026-10-21

### Added
- `MToolbar` collapses, as Compose's floating toolbar does (`v-model:expanded`, default `true`; floating toolbars only). With a FAB, the toolbar closes into it and the FAB grows from 56 to 80px, keeping the toolbar's footprint so nothing around it moves; a FAB that toggles `expanded` hides and shows its toolbar. Without one, the new `#leading` and `#trailing` slots close toward the center (the default slot), typically a filled button that stays. Expressive FastSpatial spring; what's hidden is `inert`; reduced motion jumps
- `MToolbar` `collapseOnScroll` (off by default): collapses a floating toolbar as the content scrolls down and expands it as it scrolls back up, 40px each way like Compose's `floatingToolbarVerticalNestedScroll`. `true` follows the window, or pass the scrolling element or a CSS selector; emits `update:expanded`
- `MIconButton` `iconFilled`: draws the icon filled (Material Symbols' FILL axis) without making the button a toggle, for media controls and the like
- `MContainerTransform` (Material's container transform motion pattern): whatever you tap (a card, a list item, an avatar, a FAB) grows into the view it opens and shrinks back into it, its bounds and corners morphing while its content fades into the new one. A port of Material Components for Android's `MaterialContainerTransform` with its defaults (fit to width or height, the open and return fade/scale/mask/shape thresholds, a 32% scrim, 500ms open and 400ms close on Android's emphasized path), every frame computed up front and played as Web Animations so the compositor runs it; the element is cloned for the transition (keeping its inherited custom properties, so an `MScheme`'s colors) and hidden meanwhile. `mode`: `fullscreen` (default) or `dialog` (a centered panel, `maxWidth`, scrim click closes unless `persistent`). Slots `#default` (`{ open, isOpen }`) and `#expanded` (`{ close, item }`), `v-model:open`, `label`; Escape, scroll lock, focus to the expanded view and back to the element; Android's back closes it (`closeOnBack`, through the browser's CloseWatcher where there is one, so the history and the router are left alone); turning around mid-way reverses it; reduced motion opens without it. Server rendering renders the element; the expanded view renders only in the browser, without hydration mismatches
- `useContainerTransform<T>()`: the controller for elements that live apart from the expanded view: `open($event, item)` from any element's click grows that element, and `<MContainerTransform :controller>` shows the `item`. Exports `ContainerTransformController`, `ContainerTransformOrigin`
- `MContainerTransform` `mode="custom"`: the classes you give it place, size and shape the expanded view anywhere over the page (a chat window in a corner, a side sheet…), and `scrim` (default `true`): without one the page stays usable (no scroll lock or `aria-modal`) and a press outside closes it, unless `persistent`. Its default background, shape and shadow are now in the base layer, so the consumer's classes win in every mode
- `MDialog` `bare` with `fullscreen`: the slot fills the screen and draws its own top bar, in any colors
- `MButton` `iconFilled`: draws the icon filled, like `MIconButton`'s

### Changed
- **An `MFab` in `MToolbar`'s `#fab` slot is sized by the toolbar (56px, 80px collapsed, whatever its `size`), takes the floating toolbar FAB's color (primary container, tertiary container on a colored toolbar; `color` still wins) and elevation (level 2, 3 on hover), and stays square with a `label`, which only names it. Before, it kept its own size (the docs used `size="small"`, 40px) and was extended with a label**
- **`MAnimatedNumber` shows currencies written with a plain `$` with their country, in any language: `AR$ 1.234,50` in Argentina, `MX$1,234.50` in Mexico, `US$1,234.50` in the US. Before, `Intl` gave the local peso a bare `$` and some foreign currencies their code (`MXN` in Argentina).** Symbols that already name their currency stay as `Intl` writes them (`€`, `R$`, `￥`, `CA$`); setting `currencyDisplay` in `format` gives `Intl`'s own output
- **`MSlider` range: a thumb no longer passes the other (the start one stays within [min, end], the end one within [start, max], as Compose's RangeSlider), so `v-model` is always `[low, high]`; before, dragging one past the other emitted the pair reversed. Each thumb is now a slider of its own for the keyboard and assistive technology (focusable, arrows, Home and End within the other thumb, named by the new locale keys `sliderRangeStart`/`sliderRangeEnd`, the `label` naming the pair); before, only the start thumb moved from the keyboard and it could cross the end one.** A press focuses the thumb it moves, without a focus ring unless the keys are used
- **`MSlider`'s keyboard focus ring takes the thumb's color (`color`, `thumbColor`) instead of always primary**
- **A selectable `MList` is a listbox of options: one Tab stop (the selected item, else the first), the arrows, Home and End move between items, Enter and Space select. A clickable `MListItem` that isn't a link is a button inside its list item (focusable, Enter and Space), and a link one an `<a>` inside its list item, which keeps its link role (`role="listitem"` on the `<a>` itself replaced it). A row's classes and attributes stay on the row; for these two the row is now inside an `<li>`. `@click` alone makes a row interactive (hover and press, its shape morph): the listener never reached the check, so it took `clickable` too**
- **`MNavigationRail`'s expanded rail fits its longest label, between 220 and 360px (WideNavigationRail's ExpandedRailMinWidth/MaxWidth), instead of always 220px, which cut long labels; labels longer still end in an ellipsis**
- `MAnimatedNumber` rolls with less work per frame: a column's mask switch is written only when it changes, and a rolling strip gets its own layer

### Fixed
- `MSlider`: near the ends of the track, the stop dot was left floating in the gap next to the thumb once the inactive piece got shorter than the dot's inset (at 98 on a wide slider). The dot now hides as soon as it no longer fits in its piece, and a piece shorter than its own corner goes too, as Compose's `drawTrack` does; for the end of a standard or centered slider and both ends of a range one. The slider measures its track for this (ResizeObserver); the server render looks as before
- `MSlider` range: a press beside two overlapping thumbs moved the start thumb whichever side it was on (`[50, 50]` tapped at 70 gave `[70, 50]`); it now moves the thumb on that side, and right on them the drag's direction picks one, like Compose's fix for taps and drags on overlapping thumbs
- An expandable `MListItem`'s header couldn't be reached or toggled from the keyboard: it's now a button (`role="button"`, focusable, Enter and Space, `aria-expanded`/`aria-controls`) with a focus ring
- `MDialog` dropped the consumer's `class`, `style` and other attributes (its root is a Teleport): they now go on the dialog's surface, normal or full screen, and its default background, shape and shadow are in the base layer so a `bg-*` given to it wins
- Keyboard users couldn't reach or activate clickable or selectable `MListItem` rows that aren't links (no tab stop, no Enter or Space)

## [1.1.3] - 2026-10-20

### Added
- `MScheme`: paints its content with a color scheme of its own, Material You's content color: from a `seed`, from the dominant color of an `image` (a URL; cross-origin needs CORS), or from one of the `palette`s (its own CSS through `data-palette` on the element, so a theme picker can preview every palette; `purple`, the `:root` baseline, and custom palettes without CSS are generated from their seed). Every M3 utility and component inside uses it, light or dark like the app, while the rest of the app keeps its palette; its text color is the scheme's `on-surface` (overridable, it lives in the base layer) and it sets no background. `variant` and `contrast` as for `generateScheme`; schemes and image seeds are cached; the slot gets `{ seed, ready }` and `seed` is emitted once read from the image
- `MAnimatedNumber` (not an M3 spec component): a value whose digits roll to their new value on a spring, like an odometer. Each digit rolls on its own column (up when the value grows, through 9 → 0, down when it shrinks), digits that appear or go away open and close (99 → 100), and unchanged digits stay still. `type`: `number` (`Intl.NumberFormat`: any currency with its country's symbol and separators via `locale`, percent, units, compact), `datetime` (`Intl.DateTimeFormat`, the default for a `Date`; the tens of minutes and seconds roll through 0-5 only, hours the short way) or `duration` (seconds as `[h:]mm:ss`, for timers). Formats in the app's language by default; tabular figures; screen readers read the formatted value, not the digits; the server renders the right digits. The roll is Standard SlowSpatial by default (`spring` takes any), with the column's edges fading only while it moves; `animate` and reduced motion jump instead
- `seedFromImage(source)` and `seedFromPixels(rgba)`: an image's seed color, picked as Android picks a wallpaper's (QuantizerCelebi + Score on the image scaled down to about 112×112 pixels, so big photos are fast). Takes a URL, an `<img>`, an `ImageBitmap` or a `Blob` (a picked file, read in the browser). The same image always gives the same seed: material-color-utilities' quantizer starts from `Math.random()`, so it runs on a generator seeded like Android's Java version (`0x42688`), and a Blob is decoded through an `<img>` like a URL (`createImageBitmap` decoded colors differently)
- `MListGroup`: groups items inside an `MList`. In a segmented list each group is a rounded run of its own (its first and last items take the large outer corners) set apart from what's around it by 12px, like the grouped cards of a settings screen; before, splitting runs took an empty element between items. An optional `title` (or `#title` slot, `inset` to align it) heads the group like `MListSubheader` and names it for assistive technology (a nested list labelled by it). The list's selection, `dense`, `dividers` and `nav` reach its items as usual
- `useConfetti()` / `fireConfetti()`: a burst of confetti in Material 3's expressive shapes (MShape's), for the end of a flow. `fire(event)` bursts from the pointer (from the element for a keyboard click), `fire(el)` from an element's center, `fire({ from: 'top' })` rains from the top of the screen; options for `count`, `shapes`, `colors`, `angle`, `spread`, `velocity`, `size`. The colors default to the theme's primary, secondary and tertiary roles and their containers read at the origin, so a burst inside an `MScheme` takes its scheme. One shared canvas over the page that ignores pointer events and assistive technology, created on the first burst and removed when the last piece lands; nothing happens under reduced motion. Exports `ConfettiOptions`, `ConfettiOrigin`
- `MSparkline` (not an M3 spec component): a small `line`, `area` or `bar` trend chart drawn as SVG, no chart library, for next to a number. It fills its box (96×28px by default, in the base layer so size classes win) and draws at its measured size so dots and bars don't stretch; monotone smoothing (never overshoots the points), a dot on the last point, a dashed `baseline`, `min`/`max`, `color` (an M3 role or any CSS color). New data springs into place (Standard DefaultSpatial). `interactive` follows the pointer with a dot and emits `hover` with the index. Screen readers get a summary in the app's language (new locale key `sparklineSummary`) or your `label`
- `MIcon` `label`: makes an icon that means something on its own an image with that name (`role="img"`)
- New locale keys `clear` and `collapse` (all 8 locales), naming the clear buttons of fields and the expand toggles of trees

### Changed
- **`MIcon` is hidden from assistive technology by default** (`aria-hidden`): a Material Symbol is a ligature, so screen readers read the icon's name aloud ("arrow_drop_down", "check") wherever one appeared, including inside buttons and select options. Give `label` to an icon that conveys something no text next to it says

### Fixed
- Icon-only buttons had no name of their own (they were announced by their icon's ligature, "close", or not at all): the clear buttons of `MSelect`, `MAutocomplete`, `MMultiSelect`, `MMultiAutocomplete`, `MTagInput`, `MTextField`, `MMaskField`, `MSearchBar`, `MSpotlightSearch`, `MTable` and `MDataTable`, chip remove buttons ("Remove Lo-fi"), the close buttons of `MBottomSheet`, `MSideSheet` and `MTour`, `MSimpleCarousel`'s arrows and indicator dots (which never had a name), `MSplitButton`'s menu toggle (now also `aria-haspopup`/`aria-expanded`), and `MTree`/`MTreeTable` expand toggles. `src/__tests__/iconButtonNames.test.ts` checks them
- `MSelect` and `MAutocomplete` lacked listbox semantics: their options weren't announced as options of a list. Now the combobox is named by its label and points at the open list (`aria-controls`) and the selected or highlighted option (`aria-activedescendant`); the list is a `listbox` of `option`s with `aria-selected`, and the modal mode is a labelled dialog. `MMultiSelect`'s trigger is named by its label and its options, checkboxes, form a labelled group
- `MSelect` and `MMultiSelect` drew the browser's focus outline (white in dark, black in light) when reached by keyboard: focused, they now show M3's focused field (2dp primary indicator, primary label) like when open

## [1.1.2] - 2026-10-20

### Fixed
- Server rendering (Nuxt, Vite SSR) failed with `ResizeObserver is not defined` on a page with an `MDialog` open on load (also `MConfirmDialog` and the picker dialogs, built on it), since 1.1.0: the dialog's open watcher now runs immediately so a dialog mounted open gets Escape and the scroll lock, and on the server it went on to observe its content's size

## [1.1.1] - 2026-10-20

### Fixed
- `MShape` ignored a position or display class passed to it: its root carried `relative inline-block` as utilities, so `class="absolute inset-0"` or `block` won or lost depending on Tailwind's stylesheet order (`relative` won, and a shape meant to sit behind an icon pushed it below instead). The defaults now live in `@layer base`, which any utility overrides
- `MShape`'s outline was wobbly on large shapes: the path was built at size 1 and `shape-morph` writes 2 decimals, so every point snapped to 1% of the shape (4px steps on a 400px shape). It's built at size 100 and scaled down in the clip path now, also while morphing

## [1.1.0] - 2026-10-20

### Added
- `MBottomSheet` `partial` (`true` = half the screen, or a ratio): a sheet taller than that share of the screen opens partially expanded, as Compose's `ModalBottomSheet` does, and expands to its full height by dragging the handle or the content up, tapping the handle (now a button with `sheetExpand`/`sheetCollapse` labels when there's a partial state, Enter/Space too) or scrolling the wheel down. The content scrolls once the sheet is expanded, and dragging it down from its top collapses or dismisses the sheet (touch events with `touch-action` narrowed to the possible scroll, like `MNavigationDrawer`). `v-model:expanded` reads and sets the state (back to `false` on close, so it reopens partially expanded). With `partial` the sheet may grow to the whole screen (minus the top safe area); `squareCornersWhenFull` squares its corners while the expanded sheet fills it, as Android's views sheet does
- `MBottomSheet` `maxHeight`: the tallest the sheet gets, as any CSS length; past it the content scrolls. Default 60vh as before (the whole screen with `partial`)
- `MSeekBar`, a media seek bar (not an M3 spec component; its default look is the M3 slider, as Media3's `ProgressSlider`): the position (`v-model`, in seconds) over `duration`, with `buffered` (a time or ranges like a media element's) and `chapters` (gaps in the track, titles in the preview). Dragging scrubs locally and seeks once on release (`seek`), or continuously with `live`; a tap or click seeks there, and a touch only scrubs after a horizontal move, leaving vertical swipes to the page. With `playing` (and `playbackRate`) it advances on its own between updates, so a 4Hz `timeupdate` moves it smoothly. `variant`: `slider` (the M3 slider), `line` (a line whose round thumb grows and that thickens under the pointer, as a video player's) or `wavy` (the played part waves while playing, as Android's media controls); `size`: `md` (16px, the smallest `MSlider`), `sm` (8px) or `xs` (4px). Elapsed and total time `below`, on the `sides` or `none`, `h:mm:ss` past an hour or your own `format`; clicking the total switches to the remaining time (`v-model:remaining`). A bubble shows the time and chapter above the pointer (a grace zone around the track catches it), replaceable through the `#preview` slot (a frame preview, say). Keys: arrows by `keyStep`, Page Up/Down by 10%, Home/End. `color`, `trackColor` and `timeColor` take an M3 role or any CSS color. New locale keys `seekBar`, `seekBarValue`, `seekBarShowRemaining`, `seekBarShowDuration`. Exports the `SeekBarChapter` type
- `MMapControl` expands in place: give it a `#panel` and a button in its default slot (scope `{ expanded, toggle }`) grows the control into a panel of your own (scope `{ close }`; `v-model:expanded`; Escape or a press outside closes it), on a surface of its own where your buttons keep their look. Its size springs (Standard DefaultSpatial) whenever its content resizes, expanding or otherwise, so the controls below it move along instead of jumping (`animate` turns it off), and switching `group` fades the surface instead of snapping
- `MDialog` `bare`: just the dialog's box (surface, shape, elevation), scrim, Escape, scroll lock and animation, with the default slot filling it edge to edge (clipped to its corners): no title row, padding, close button or actions, for dialogs that draw everything themselves. `title` then names it for assistive technology
- New locale keys `ok`, `dateToggleInput`, `dateToggleCalendar`, `dateInputLabel` (all 8 locales)

### Changed
- `MDatePickerModal`, `MDateRangePickerModal` and `MTimePickerModal` are built on `MDialog` (`bare`) instead of their own overlay: the same look and animation, plus dialog semantics, one Escape and scroll lock shared with other dialogs, and they shrink to fit screens narrower than their width
- **The picker dialogs' text comes from the locale**: their OK button, the date picker's input toggle and its text field were English whatever the app's language, and the time picker's AM/PM come from `Intl` (as `MTimeScroll`'s). **The date picker's text input follows the locale's date order** (MM/DD/YYYY in the US, YYYY. MM. DD in Korea…): it was DD/MM/YYYY everywhere. It also takes one-digit days and months and rejects dates that don't exist (31/02)
- **`MMap`'s attribution is a control of its own instead of MapLibre's compact one**: a round M3 icon button (surface, elevation 2, a centered `info` icon) that springs open into a pill with the credits, open when the map loads and folded once it's dragged. MapLibre's button sat over the text's padding with its icon off center. The credits are collected as MapLibre does (the attribution of the sources the style's layers use, without repeats)
- `MBottomSheet`'s `fullHeight` is deprecated: it equals `max-height="92vh"`
- Modal sheets' drag release (`MBottomSheet`, `MSideSheet`): a fast flick decides the direction even after a long drag, so flinging a sheet back after dragging it 100px out keeps it open instead of dismissing it

### Fixed
- Modal surfaces locked the page's scroll each on its own: with one over another (a select's or a date picker's modal inside an `MDialog`), closing the inner one let the page scroll under the outer one; a dialog removed while open left the page locked for good; and a select unmounting inside an open dialog unlocked it. The 14 components that lock it (`MDialog`, the picker dialogs, `MSelect`, `MMultiSelect`, `MAutocomplete`, `MMultiAutocomplete`, `MNavigationDrawer`, `MNavigationRail`, `MSearchBar`, `MLightbox`, `MCommandPalette`, `MSpotlightSearch`) now share one counted lock, which keeps an overflow the app had set
- One Escape closed every open `MDialog` (each listened on its own): it now closes the one on top only, and a persistent one on top keeps those under it open. A dialog mounted already open also listens for Escape and locks the scroll now
- `MDialog` had no dialog semantics: it's now `role="dialog"` with `aria-modal`, labelled by its title
- The date pickers skipped a month when moving from the 31st (31 March + 1 month landed on 1 May). The month grid is shared by `MDatePicker`, `MDatePickerModal`, `MDateRangePicker` and `MDateRangePickerModal` now instead of copied into each
- `MMapMarker`'s default pin sat about 20px above its point: it was anchored at its bottom while MapLibre still applied its own `[0, -14]` offset, meant for the pin centered (its tip is the middle of the shadow below it). The pin now keeps MapLibre's placement, with its tip on the point (`MMapIdentify`'s and `MMapSearch`'s markers too), and its popup gets MapLibre's per-side offsets instead of a fixed 32px, as does `MMapIdentify`'s popup over its marker (a fixed 40px before)
- **`MMapPopup`'s tip touches its point**: its default offset was 8px (MapLibre's is 0). `offset` also takes MapLibre's per-side form now, and follows changes while open
- `MMenu` went off screen when its `align` edge left no room (on a phone, the default right-aligned menu on a button near the left edge opened leftwards past it): it now keeps on screen as Compose's `DropdownMenuPositionProvider` does, trying the `align` edge of the trigger, then the other one, then the window edge on the trigger's side, 8px in from the edges, and centers a menu wider than that. Its width is capped at the window minus those margins, and it grows from the trigger wherever it ended up (from the bottom when it opens above). `MMenuItem`'s flyout submenus measure themselves too: right of the item, else left, else clamped, and moved up when they'd pass the bottom
- `MSplitButton`'s menu and the dropdowns of `MDatePicker`, `MDateRangePicker` and `MTimePicker` went off screen the same way: they always started at the left edge of their button or field (a picker's 360px panel ran past the right edge of a phone), and chose to open above from a guessed height (44px per split button item, so a custom `#menu` never moved up; a fixed 320–400px for the pickers). They now measure themselves and keep on screen like `MMenu`, and their width is capped at the window minus 16px
- **`MTooltip` on touch screens follows Compose's `BasicTooltip`**: a long press (500ms) shows it, swallows the click it ends in (a long-pressed button doesn't fire) and hides it 1.5s after the finger lifts, while a plain tap no longer shows it. It listened to the mouse events a browser emulates for a tap (and to the focus a tap gives a button), so every tap showed a tooltip that then stuck around. A mouse still shows it on hover; focus shows it only from the keyboard (`:focus-visible`), and Escape hides it. A long-pressed rich tooltip stays until a touch outside it, so its actions can be tapped
- `MContextMenu` could still leave the screen: it was only pulled back from the right and bottom edges (so one wider or taller than the window ran off the left or top, with no scrolling), slid under the finger instead of flipping, and was measured where it opened (near the right edge the browser narrowed it). It now opens right of and below the point, else flipped left or up, else clamped (centered when larger than the window), measured unconstrained, capped at the window minus 16px with its items scrolling, and grows from the point

## [1.0.3] - 2026-10-19

### Added
- `MMap`, a MapLibre GL map, in a new `/map` entry point with `maplibre-gl` (^5) as an optional peer dependency (the app imports `maplibre-gl/dist/maplibre-gl.css`). Not an M3 spec component. `mapStyle` takes any style URL or object (an MVT server like mvt-rs, OpenFreeMap, MapTiler…); `center`, `zoom`, `bearing` and `pitch` are v-models (on `moveend`); `persist` remembers the view in localStorage; `navigation`, `geolocate`, `fullscreen`, `scale` and `attribution` turn MapLibre's controls on or move them to a corner; `options` reaches MapLibre's `Map` constructor. The controls, popups and default marker take the M3 look and follow the theme (Material Symbols icons, surface colors, elevation), and MapLibre's strings come from `M3Locale` (new `map*` keys in every locale). MapLibre loads in the browser: server-side rendering renders the empty container. Inside it: `MMapMarker` (a theme-colored pin or your own content, `draggable` with a `lngLat` v-model, a `#popup` slot), `MMapPopup` (`open` v-model), `MMapGeoJson` (an object or URL, drawn by default in the theme's primary and redrawn on theme changes, or with your own layers; `click` with the features; re-added after a style change) and `MMapControl` (your own control in a corner, as an M3 control group or bare). `useMap()` gives components inside the map `onReady`, `on` and `onLayer`, with listeners removed on unmount
- `MMap`'s `adapter` reads a style's conventions into a model of its layers (names, groups, base layers, what to identify and show on hover): `genericAdapter` for any style, `orvianAdapter()` for the Orvian viewers' `metadata` keys (`alias`, `group`, `identify`, `fields` with `alias`/`prefix`/`suffix`/`mask`, `hover`, `isbaselayer` + `image`, `childs`, `show_in_layerlist`, `legend`, `download`, style `groups`), with legends from mvt-rs's `/services/legends`, or your own function. On that model: `MMapLayers` (a layer list with search, collapsible groups with partial visibility and a count, per-layer visibility, opacity, description, legend, download and an `#actions` slot), `MMapBaseLayers` (thumbnail switcher, one base layer at a time or none), `MMapIdentify` (click → the formatted properties of the features under it in a popup with a marker, or an `identify` event for your own panel; shown as text), `MMapFeatureInfo` (those results anywhere) and `MMapHover` (the hover fields under the pointer, with its own toggle among the map's controls). `useMapLayers()` and `identifyFeatures()` expose the same for UIs of your own; number masks format in the page's language (`<html lang>`). Buttons in an `MMapControl` group with `aria-pressed="true"` take the active look
- `MMap`'s controls (MapLibre's and yours in `MMapControl`) show an M3 plain tooltip (`MTooltip`'s look and 600ms delay, inside the map so it works in fullscreen, also on keyboard focus) instead of the browser's: their `title` becomes `data-m3-tip` and, when missing, `aria-label`
- `MMapMeasure`: distance and area measuring with its own control (distance, area, clear). Click to add points with a preview, finish with a double click, Enter, Escape, the first point (closing the shape) or the active button again; finished measurements stay editable (drag a vertex, or a midpoint to add one) and each total or area label has a ✕ that deletes that one. Labels are M3 chips (segments, total, area in m², ha or km², in the page's language) and the drawing follows the theme. Geodesic numbers equal to turf's, without depending on it. `v-model` is the mode, `change` reports each measurement (points, length in meters, area in m²), and it exposes `start`, `finish`, `clear` and `remove`. In fullscreen it keeps Escape for itself while measuring through Keyboard Lock (Chromium). While measuring it owns the map's clicks: `useMap().activeTool` (new) is `'measure'` and `MMapIdentify` waits; tools of your own can do the same
- `MMapFilter`: a simple filter for one layer, chips for the values of one property (given, or read from the loaded features), on top of the filter the style already has. `useMapFilter()` (`setFilter`, `valuesOf`) for filters of your own
- `MMapSearch`: a place search card in a corner, through a provider: `nominatimProvider({ url, limit, language, countryCodes, viewbox, bounded })` by default (searches on Enter, as Nominatim's usage policy requires) or any `(query, signal) => places` function; picking a place flies there (or fits its extent) and marks it. `instant` searches while typing for providers that allow it
- `createM3UI({ cookies, initialState })`, so a server renders with the user's theme choice. `cookies: true` also keeps the theme, the palette and the contrast level in cookies (`m3-theme`, `m3-palette`, `m3-contrast`; copied from `localStorage` when the plugin installs, so users from before get them on their next visit). `initialState` takes what the server read from them: `useTheme()` and `useColorPalette()` report it on the server, and on the client while hydrating (with `isHydrating`) before switching to what's stored, so UI built from them (a theme toggle's icon, the selected palette) hydrates without mismatches and needs no `<ClientOnly>`. What's missing or invalid falls back to the plugin's defaults, by the client's rules (a stored choice wins unless `persistPalette` is false). A `system` theme stays `system` and a `system` contrast resolves to `standard` on the server, which can't know the OS preferences. Exports the `M3InitialState` type
- `PaletteId` type, the ids of the 40 built-in palettes (derived from `palettes`). `createM3UI({ palette })`, `themeInitScript({ palette })` and `useColorPalette().set()` take `PaletteId | (string & {})`, so editors autocomplete the ids while custom palette ids still type-check
- `initialState.viewport` (`{ width, height }`), and with `cookies: true` an `m3-viewport` cookie (`<width>x<height>`, written on load and, debounced, on resize): the adaptive layouts (`MNavigationSuite`, `MListDetail`, `MSupportingPane`) and `useWindowSizeClass()` render for that window size on the server and while hydrating, so from a user's second visit on a desktop gets its rail from the first paint instead of compact then rail. Invalid sizes are ignored; without one nothing changes

### Fixed
- `MFab` extended and starting collapsed (`expanded: false`) rendered extended on the server: the collapsed width and hidden label were only written by its springs once mounted, so a server-rendered page showed the full label until it hydrated. It now renders collapsed from the start. The icon-to-label space is a class instead of an inline style
- **`MFab`'s large extended FAB centers its icon when collapsed**: Compose keeps the 28dp start padding, which leaves the 32dp icon 4dp off center in the 96dp square (the other sizes' padding already centers it). The start padding now lerps to 32dp with the width
- Leaving a page with an `MMap` threw from its components' cleanup (`this.style is undefined` from `MMapGeoJson`, measuring, filters, controls): the map was removed in `MMap`'s `beforeUnmount`, which runs before its children's. It's removed in `unmounted` now, after they've cleaned up
- `MIconButton`'s `label` docs (and `dist/API.md`) said it set a `title` too: it sets only `aria-label` (wrap the button in `MTooltip` for a visible tooltip)
- `MLightbox` open on load (`v-model` true) broke hydration of a server-rendered page: it renders closed on the server (1.0.2), but opened during setup on the client, so its first render didn't match. While hydrating (`createM3UI({ isHydrating })`) it now opens once mounted. Found by `@m3ui-vue/nuxt`'s new browser test, which happy-dom couldn't reproduce
- With `cookies`, a choice kept only in a cookie (storage cleared, or a cookie a server set to pick the user's theme) was ignored by the client and then erased by the plugin, which copied storage's empty values over it. `useTheme`, `useColorPalette` and `themeInitScript()` now fall back to the `m3-theme`, `m3-palette` and `m3-contrast` cookies when `localStorage` has nothing (storage still wins when it has a value), and the plugin no longer deletes them

## [1.0.2] - 2026-10-19

### Added
- `themeInitScript({ palette, contrast, persistPalette })`: a script to inline in `<head>` of a server-rendered page, so dark mode, the palette and the contrast level are on `<html>` before the first paint. It applies the stored choice or the given `createM3UI` defaults with the plugin's rules, plus the cached CSS of a generated palette (a `seed` default can't be generated that early: its first visit shows the baseline until the app loads)
- `createM3UI({ isHydrating })`: tells the components whether a server-rendered app is still hydrating (`@m3ui-vue/nuxt` passes Nuxt's). The adaptive layouts (`MNavigationSuite`, `MListDetail`, `MSupportingPane`) and `useWindowSizeClass()` render their first client frame at the server's size (compact: it has no window) and adapt once mounted. Before, they started from the window's width, didn't match the server's HTML and broke hydration (the content disappeared until the window was resized). Without the option nothing changes

### Fixed
- The library works under server-side rendering (Nuxt, Vite SSR): importing it read `localStorage`, `window` and `document` at module load, so the server crashed before rendering anything. `useTheme`, `useColorPalette` and `createM3UI` now apply the theme, palette, contrast and theme-color only in the browser (the plugin still provides the locale and registers `v-ripple` on the server), `MLightbox` rendered open on the server opens on the client, and `MChart` no longer reads computed styles during setup. A test renders every component, open overlays and the plugin with each option without a DOM. In the browser nothing changes
- `MShader` applies a new `pixelRatio` right away: changing it after mount only took effect on the next resize of the component. Its docs now list what it declares in front of your GLSL (`#version`, precision, `iTime`, `iResolution`, `iMouse`, `iFrame` and one uniform per `uniforms` key) and how custom uniforms map to WGSL
- `dist/API.md` cut descriptions short at any `@word` (TypeScript's JSDoc parser reads `@debounced`, `@click`, `@refresh` as tags): nine props had a truncated description, among them the `debounce` of the text, number and autocomplete fields and `MListItem`'s `clickable`. `MSearchBar`'s entry now says its expanded panel is teleported to `<body>` and attributes land on the collapsed bar

## [1.0.1] - 2026-10-17

### Added
- `MNavigationDrawer` `swipeEnabled` (default `true`): **the modal drawer can be swiped closed toward its edge**, like Compose's `ModalNavigationDrawer` (`gesturesEnabled`): released past half its size or faster than 400px/s (DrawerPositionalThreshold, DrawerVelocityThreshold) it closes, otherwise it springs back on DefaultSpatial carrying the finger's velocity, with the scrim following. Left/right drawers take horizontal drags and leave vertical ones to the list; top/bottom ones (which Compose doesn't have) scroll the list first and follow the finger once it's at its end, like a bottom sheet's nested scroll. A drag that started on an item doesn't select it; if the parent doesn't close it, it springs back open

### Changed
- `MBottomSheet`, `MSideSheet`, `MNavigationRail`'s `hideOnCollapse` panel, `MMenu`, `MContextMenu` and `MTransition` play their enter/exit springs as Web Animations (simulated up front, same curves and release velocity) instead of stepping them in a rAF loop, so the compositor runs them and the content mounting at the same moment no longer janks them on phones. Drags still follow the finger directly
- **`MSearchBar` has no shadow**, standalone or as the expanded docked panel: Compose's `SearchBarDefaults.ShadowElevation` is Level0 for every search bar (the Level3 `SearchBarTokens.ContainerElevation` isn't used by any of them), so it's told apart by its surface-container-high color alone
- **`MNavigationDrawer` (modal) opens and closes on Compose's springs** (DefaultSpatial in, FastEffects out) instead of a 300ms CSS transition. Each spring is simulated up front and played as a Web Animation, so it runs on the compositor like the old transition and isn't janked by the drawer mounting at the same moment (a rAF loop was, on phones)

### Fixed
- `MBottomSheetScaffold`'s drag and `MPullToRefresh`'s pull stuttered on 120Hz phones: wherever touch-action let the browser pan along the drag, Chrome delivered it at 60Hz (a possible scroll waiting on the listener), so they moved every other frame. The sheet is now touch-action none and its content allows only the scroll that can happen (none while it can't scroll, pan-down at its top, pan-y once scrolled); the pull-to-refresh scroller is pan-down while a pull can start. Browsers without directional pan values (Safari) keep pan-y

---

## [1.0.0] - 2026-10-17

### Added
- `MBottomAppBar`: M3's bottom app bar (port of Compose's `BottomAppBar`): 80px on `surface-container`, actions at the start, a `#fab` slot at the end (12dp from the top, 16dp from the end edge), bottom safe-area inset. `flexible` makes it M3 Expressive's `FlexibleBottomAppBar` (64px, 16px side padding, `DockedToolbarTokens`), with `arrangement` (`start` | `between` | `around` | `evenly` | `fixed`, the last centered 32px apart). `color` takes `surface` or a color's container for a vibrant bar. `scrollBehavior="exit-always"` (`BottomAppBarDefaults.exitAlwaysScrollBehavior`) shrinks the bar's height with the content scrolling down and grows it back scrolling up, following `scrollTarget` (an element or selector, the window by default); left half-way it snaps to the closer end on the FastSpatial spring. Not ported: dragging the bar itself, the fling decay (the browser's momentum scrolling drives it instead), and turning it off under a screen reader
- `MFab` `expanded` (default `true`): `false` collapses an extended FAB to a plain one, Compose's `expanded`: the width lerps from the square to the full width on FastSpatial, the label (with the icon-to-label space) fades on FastEffects and leaves the layout once collapsed, and becomes the button's `aria-label`
- `MFab` with a `label` takes `size`: `small`, `medium` and `large` are M3 Expressive's extended FABs (`ExtendedFab{Small,Medium,Large}Tokens`: 56/80/96px tall, 16/26/28px side padding, 24/28/32px icon, 8/12/16px to the label, title-medium/title-large/headline-small, 16/20/28px corners, minimum width equal to the height). `regular` stays the baseline extended FAB. Before, `size` was ignored on an extended FAB
- `MNavigationRail` `hideOnCollapse` (with `modal`): Compose's dismissible `ModalWideNavigationRail` (`hideOnCollapse = true`). No collapsed rail on screen; the expanded rail (items expanded from the start) slides in from off-screen on the DefaultSpatial spring with the scrim following it, and can be swiped away, the only modal rail Compose lets you drag (`gesturesEnabled = hideOnCollapse`): released past half its width or faster than 125px/s it closes (AnchoredDraggableDefaults), otherwise it springs back, keeping the finger's velocity. Vertical drags still scroll the items, and a drag that started on an item doesn't select it. Predictive back isn't ported
- `MBottomSheetScaffold`: M3's standard (non-modal) bottom sheet, a port of Compose's `BottomSheetScaffold`: `#top-bar`, the screen (default slot, padded by `peekHeight`) and the sheet (`#sheet`) over its bottom without a scrim. `v-model` is `'partial'` (default, `peekHeight` 56px showing), `'expanded'` or `'hidden'` (only with `skipHiddenState` false; true by default as in Compose). Dragged anywhere, it settles with AnchoredDraggable's rules and BottomSheetDefaults' thresholds (next state past 56px or above 125px/s) on DefaultSpatial, carrying the release velocity; hiding through v-model uses FastEffects. Its content scrolls only once fully expanded, and then a downward drag moves the sheet only from the content's top (ConsumeSwipeWithinBottomSheetBoundsNestedScrollConnection). The handle is a button (expand / collapse / dismiss). `swipeEnabled`, `maxWidth` (640). Exports the `BottomSheetValue` type. Not ported: the snackbar riding the sheet, and handing a gesture over from the content's scroll to the sheet mid-drag (decided when the drag starts)
- `MTopAppBar` `subtitle` (prop or `#subtitle` slot; label-medium in small and center-aligned bars), `flexible` (medium/large: Compose's `MediumFlexibleTopAppBar` / `LargeFlexibleTopAppBar`, headline-medium / display-small title, label-large / title-medium subtitle, 112/136px and 120/152px without/with a subtitle) and `titleAlignment` (`start` | `center`, medium/large)
- `MTopAppBar` `scrollBehavior` with `scrollTarget` (an element or selector, the window by default), Compose's three: `pinned` takes the scrolled container color once content is under the bar; `enter-always` hides the bar (collapses a medium/large one to the small bar) while scrolling down and brings it back on any scroll up, settling half-way positions on DefaultEffects (TopAppBarDefaults.snapAnimationSpec); `exit-until-collapsed` collapses a medium/large bar with the content and expands it only at the top. Collapsing cross-fades the big title out and the small one in (TopTitleAlphaEasing) and lerps the container color (FastOutLinearInEasing). Compose consumes the scroll before the content (nested pre-scroll); a web page scrolls natively, so with the last two the bar is sticky and grows its bottom margin as it shrinks, keeping its expanded height in the layout so its edge stays on the content, one to one: put it at the top of the scrolling element. Not ported: dragging the bar itself, fling decay (native momentum instead), and the bar's semantics changes under TalkBack
- `MAppBarWithSearch`: M3's app bar with a search bar (port of Compose's `AppBarWithSearch`; with `transparent`, `TopSearchBar`): navigation icon, a flat search bar (at most 720px, centered, 8px from the icons and 4px from the edges) and `#actions` in a 64px row. The search expands through MSearchBar (`searchVariant`: `fullscreen` by default, `fullscreen-contained` or `docked`), with v-model, v-model:expanded, `search` and the results slot passed through. Scrolled content under it turns the app bar surface → surface-container and the search bar surface-container-high → surface-container-highest (AppBarWithSearchColors); `scrollBehavior` `pinned` or `enter-always` (EnterAlwaysSearchBarScrollBehavior, settling on DefaultEffects, sticky like MTopAppBar's) with `scrollTarget`. Not ported: the expand morph from the bar's bounds (MSearchBar's fade is kept) and predictive back
- `MSearchBar` `variant="fullscreen-contained"`: M3 Expressive's `ExpandedFullScreenContainedSearchBar`, full screen on surface-container-low with the input kept as the collapsed pill (8dp from the sides, 4dp from the top, 8dp above the results) and no divider
- `MChip` `type`: M3's four chips (Compose's AssistChip, FilterChip, InputChip, SuggestionChip), styled by the spec and always interactive; without `type` the generic tone chip is unchanged. 32dp, label-large, 18dp icons, Compose's paddings. Assist: outline-variant border, on-surface label, primary icon, 8dp corners; suggestion: the same with an on-surface-variant label. Filter: v-model:selected (`update:selected`, `aria-pressed`), secondary-container while selected, and without its own icon a check that expands in (FastSpatial) and fades in (FastEffects) with the label sliding along; with an icon it turns filled. Input: an `#avatar` slot (24dp round) and, with `removable`, a remove button beside the chip's button instead of inside it; selectable like filter. Filter and input take the Expressive ChipShapes (12dp, a pill while selected, 8dp while pressed, on a spring) and ChipsTokens colors. `elevated` (assist, filter, suggestion: surface-container-low, elevation 1, 2 on hover, no outline) and `trailingIcon`
- Motion tokens (androidx MotionTokens, StandardMotionTokens, ExpressiveMotionTokens). In `theme.css`: the easings as `--ease-*` (Tailwind's `ease-emphasized`, `ease-emphasized-decelerate`, `ease-emphasized-accelerate`, `ease-standard`, `-decelerate`, `-accelerate`, `ease-legacy`, `-decelerate`, `-accelerate`) and the 16 durations as `--duration-short-1` … `--duration-extra-long-4`. In JS: `motionSprings` (fast/default/slow spatial and effects springs of the Standard and Expressive schemes), `motionEasings` (control points), `motionDurations` (ms), `cubicBezier()`, and `useSpring` (the library's own spring composable, now public) with the `SpringSpec` type. The components' internal spring constants now come from `motionSprings`
- Contrast levels for the built-in palettes: an optional stylesheet, `@m3ui-vue/m3ui-vue/palettes-contrast` (~27 KB gzipped), with medium and high contrast (light and dark) for all 40, under `[data-contrast='medium' | 'high']` on `<html>`. Generated by `scripts/generate-contrast-palettes.mjs` (`pnpm generate:contrast`): each palette's own tonal palettes from the classic algorithm, fed to material-color-utilities' DynamicScheme at contrast 0.5 and 1 (SchemeMonochrome for Monochrome), so hues stay put and only tones spread; the standard level is palettes.css unchanged. `createM3UI({ contrast })` (`'standard' | 'medium' | 'high' | 'system'`, `system` following `prefers-contrast: more` live; a first-visit default like `palette`) and `useColorPalette()`'s `contrast`, `activeContrast` and `setContrast()` (remembered in localStorage, `m3-contrast`); a seed or generated custom palette is regenerated at the active level. Exports the `ContrastLevel` type
- `M3Locale` keys `sheetExpand`, `sheetCollapse` and `sheetDismiss`, in all 7 bundled locales

### Changed
- **Scrollbars are visible again in Chromium and WebKit**: `theme.css` no longer hides every scrollbar (`scrollbar-width: none` on `*`, which also reached the app's own markup while Firefox showed them anyway). Every scroll container gets a thin scrollbar in the theme's colors (`scrollbar-color: outline`, transparent track), inside `@layer base` so utilities override it; phones keep their overlay scrollbars. New `scrollbar-none` utility hides one while keeping it scrollable; MNavigationDrawer's item lists, MNavigationRail's modal panel and MBreadcrumbs use it (MTabs, MEmojiSelector's category strip, MLightbox's thumbnails, MSimpleCarousel and MScrollable `scrollbar="none"` already hid theirs)
- **Theme, palette and contrast switches run smoothly in Chrome, Edge and Safari**: instead of transitioning six color properties on every element (`.theme-transitioning`, which Chromium recalculated element by element on every frame and stuttered), the color tokens themselves transition once on `<html>`, registered as `<color>` with `@property` only for the 250ms of the switch (so `getPropertyValue('--color-*')` still reads them as written). Components' own color transitions are paused meanwhile, so the navbar and buttons no longer trail behind the rest. Firefox (detected by `-moz-appearance` or its user agent) and browsers without `@property` keep `.theme-transitioning`; with `prefers-reduced-motion` nothing animates. `createM3UI({ themeColor })` also follows contrast changes and a seed palette regenerated in place
- `MChip`'s remove button is labeled from the locale (`remove`) instead of a hardcoded Spanish "Quitar"
- `MFab` inside an `MBottomAppBar` defaults to `secondary` and has no shadow (`bottomAppBarFabColor`, `bottomAppBarFabElevation`); an explicit `color` still wins. Elsewhere nothing changes
- `dist/API.md` (and `api.json`) covers the new foundations: its setup shows the optional `palettes-contrast` import, `data-contrast` / `setContrast()`, seed palettes and the global `v-ripple`, and its theme tokens list the easings (`ease-*`), durations (`--duration-*`) and the `scrollbar-none` utility

## [0.9.3] - 2026-10-17

### Added
- `v-ripple`: the library's first directive, M3's press ripple on any element (`v-ripple`, `v-ripple="false"`, `v-ripple="'#e91e63'"` or `v-ripple="{ disabled, color }"`). Exported as `vRipple` (with the `RippleOptions` and `RippleValue` types) and registered globally by `createM3UI()`. Each ripple draws in its own `.m3-ripple-layer` with `border-radius: inherit`, so the element needs no `overflow: hidden`; a statically positioned element is made `relative` on the first press
- `rippleColor` on `MButton`, `MIconButton`, `MFab` (main button and speed-dial items), `MSplitButton`, `MToggleButton` and `MButtonGroup`
- Icon toggle buttons: `MIconButton` takes `checked` (v-model:checked) and `checkedIcon`, a port of Compose's `IconToggleButton` family. Selected/unselected colors per variant from each `*IconButtonTokens` (unchecked filled is `surface-container`, checked outlined is `inverse-surface` with no border), `aria-pressed`, and the Expressive shape morph of `toggleableShapes()` on the `DefaultEffects` spring: a round button squares off while checked, a squared one turns round, both shrink to `PressedContainerShape` while pressed. The icon is filled while checked (an M3 guideline; Compose leaves it to the content). Without `checked` nothing changes
- `MIcon` `filled`: the Material Symbols FILL axis
- `MTimeScroll`: M3 Expressive's time scroll picker (port of Compose's `TimeScroll`): hour and minute `MScrollField`s (100×120) with a `:` separator and, in 12-hour mode, the vertical AM/PM toggle (two 56px ToggleButtons, circle → 12dp corners when checked or pressed, `primary-container` and bold when checked). v-model is 24-hour `HH:MM`; `use24h`, `minuteStep`, `disabled`. AM/PM labels come from `Intl` in the app language
- `M3Locale` keys `timeHourSelection`, `timeMinuteSelection` and `timePeriodToggle`, in all 7 bundled locales
- `MTimePickerModal` `mode` (`'dial'` | `'scroll'`, default `'dial'`): `scroll` picks the time with MTimeScroll's wheels instead of the clock dial (Compose's `TimePickerDisplayMode.Scroll`); the footer toggle then switches between the wheels and keyboard input (`keyboard` / `swipe_vertical` icons, as `ScrollDisplayModeToggle`). The minute starts on the nearest lower multiple of `minuteStep`, the one the wheel shows
- `M3Locale` keys `timeToggleKeyboard`, `timeToggleDial` and `timeToggleScroll`, in all 7 bundled locales
- M3 Expressive's corner steps in `theme.css`: `--radius-lg-increased` (20px), `--radius-xl-increased` (32px) and `--radius-xxl` (48px), so `rounded-lg-increased`, `rounded-xl-increased`, `rounded-xxl` and their side/corner variants (ShapeKeyTokens `CornerLargeIncreased`, `CornerExtraLargeIncreased`, `CornerExtraExtraLarge`). Named `xxl` because `2xl`/`3xl` are Tailwind's own defaults, left untouched. `MFab`'s medium size uses `rounded-lg-increased` (same 20px)
- `MMenuItem` `selected` and `checked` (v-model:checked): ports of Compose's `SelectableDropdownMenuItem` (`menuitemradio`, closes the menu) and `CheckableDropdownMenuItem` (`menuitemcheckbox`, keeps it open unless `keepOpen` is false). While on: `tertiary-container`, `on-tertiary-container` content, corners morphing to 12dp on the FastSpatial spring. Without an `icon` a check (or `selectedIcon`) expands in beside the label (FastSpatial width, FastEffects fade); with one, the icon turns filled or swaps to `selectedIcon`. Runs of consecutive selectable items get MenuDefaults' leading/middle/trailing/standalone shapes (12dp outer corners of the run, 4dp elsewhere), found from their siblings. Items sit 4dp in from the menu edges with their label aligned to plain items. Without either prop nothing changes
- `MTabs` `iconPosition` (`'top'` | `'leading'`): `leading` puts the icon beside the label in a 48px tab (Compose's `LeadingIconTab`: 16px side padding, 8px from icon to label), `top` stacks it above in a 64px tab. Defaults to `top` for primary tabs and `leading` for secondary ones, as they already looked

### Changed
- Those six buttons draw their ripple with `v-ripple` instead of six copies of the same function, so a right click no longer starts one
- **Secondary `MTabs` with icons have 16px side padding instead of 24px**, LeadingIconTab's; text-only tabs keep 24px

### Fixed
- `MTimePickerModal`'s mode toggle had its accessible label hardcoded in English; it now comes from the locale
- `MScrollField` treated its own value, handed back through `v-model` while it was still moving, as an outside change and retargeted the snap: flings stopped short, and on a short wheel (e.g. 4 items) it kept scrolling back and forth forever
- The package now includes the licenses of the code it bundles (`@material/material-color-utilities`, Apache-2.0; `shape-morph`, `@lezer/highlight`, MIT; `highlight.js`, BSD-3-Clause) in `dist/THIRD_PARTY_LICENSES.md`, as those licenses require. `scripts/third-party-licenses.mjs` writes it on every `build:js`, finding the bundled packages from `src/` imports and `vite.config.ts`'s externals, and fails the build if one has no license file. It also credits the Unicode emoji data and CLDR annotations behind MEmojiSelector (Unicode License v3, now noted in the generated data files too) and the Android Open Source Project for MCarousel's ported keyline engine (Apache-2.0, noted in `_carouselStrategy.ts`)

## [0.9.2] - 2026-10-16

### Added
- `MColorPicker` and `MColorPickerModal`: `alpha` (opacity slider; the value becomes `#rrggbbaa` when the color isn't opaque), `recent` and `recentLimit` (recently picked colors above the presets, stored in localStorage under `m3-color-recent` and shared by every picker), and `eyedropper` (pick a color from the screen where the browser has the EyeDropper API). HEX/RGB/HSL fields, a preview of the original color next to the new one (click it to go back), and keyboard control of the area and sliders
- `MScrollField`: M3 Expressive's scroll field, an endless wheel to pick a number or option (port of Compose's `ScrollField`): drag, fling (at most one item past the start, as the pager does), wheel, arrow keys or click; the centered item grows from display-medium to display-large emphasized. `format`, `height`, `label`, `#item` slot
- `MSwipeToDismiss`: port of Compose's `SwipeToDismissBox`, content swiped left or right to dismiss over a `#background` slot (`{ direction, target, progress }`); 56px positional threshold, 125px/s fling, stays dismissed until `v-model` goes back to `'settled'`. Exports the `SwipeToDismissValue` type
- `MTransition`: Compose's `MaterialTransitions` for `<Transition>` content, `shared-axis` (with `reverse` for back navigation) and `fade-through`; predictive back isn't ported
- Dynamic color: `createM3UI({ seed, seedOptions: { variant, contrast } })` generates the whole scheme (light and dark) from one color with Google's `material-color-utilities` (HCT; `tonal-spot` by default, 9 variants, contrast levels), and `useColorPalette().setSeed(seed, options)` does it at runtime (`palette` becomes `'seed'`, `seed` holds the active one). A named `palette` wins over `seed` in `createM3UI`; at runtime the last choice wins. A custom palette with a `seed` and no CSS of its own is generated too. The generator is bundled and loaded on demand (about 20 KB gzipped, only when a seed is used), and the generated CSS is cached so a reload doesn't flash. Exports `generateScheme`, `schemeToCss`, `schemeRoles`, `SEED_PALETTE` and the `SchemeVariant`, `SeedOptions`, `GeneratedScheme`, `ActiveSeed` types
- `createM3UI({ themeColor })`: keeps `<meta name="theme-color">` (the browser and status bar color on phones) in sync with a color role of the active palette (`'surface'`, `'primary'`, any role), following palette, seed and dark mode changes; off by default. Chrome and Samsung Internet on Android ignore it in a regular tab while the system is dark
- Fixed accent color roles: `primary-fixed`, `primary-fixed-dim`, `on-primary-fixed`, `on-primary-fixed-variant` and the same for secondary and tertiary (tones 90/80/10/30, identical in light and dark), in the baseline theme and all 39 palettes
- `--shadow-elevation-5` (M3 level 5); `MBox` `elevation` takes 4 and 5
- Emphasized type scale: `text-display-large-emphasized` … `text-label-small-emphasized`, M3 Expressive's `*Emphasized` styles (same size and line height, weight 500 or 700, their own letter spacing)
- `MDragHandle`: M3's drag handle (Compose's `VerticalDragHandle`), `orientation` and `dragging`; 4×48px in Outline at rest, 12×52px in OnSurface pressed or dragged, sprung between them (Compose switches instantly)
- `MSplitter` draws `MDragHandle` on its bar and is a keyboard separator (`role="separator"`, arrow keys, Shift for 10%, Home/End)
- `MScrollable`: `scrollbar` (`'native'` | `'indicator'` | `'none'`) and `scrollbarFade`; `indicator` is Compose's `nonInteractiveScrollbar`, a 4px visual-only thumb that shows while scrolling and fades out 400ms after
- `M3Locale` keys `selectColor`, `colorHue`, `colorSaturation`, `colorBrightness`, `colorAlpha`, `colorEyedropper`, `colorOriginal`, `colorFormat`, `colorRecent` and `colorPresets`, in all 7 bundled locales

### Changed
- **`MColorPicker` and `MColorPickerModal` redesigned**: swatches are rounded squares that morph into a circle when selected, thick hue/opacity tracks with a bar handle, a wide preview showing the hex, filled fields and a format toggle. Both now share one internal panel, and `MColorPickerModal` is built on `MDialog`
- **`MColorPicker` updates `v-model` live while dragging the saturation/brightness area** (it used to wait for release), and its dropdown stays inside the viewport horizontally. Escape closes it and returns focus to the field
- **`MListItem` morphs its corners by interaction, as the current Compose `ListItem` does**: 4px at rest, 8px hovered, 16px pressed, focused or selected (clickable items; selected ones always), on the Standard `FastSpatial` spring. Nav lists keep their pill
- **`MList` `segmented` follows `SegmentedListItem`**: items 2px apart (was 8px), 16px outer corners on the first and last item of each run (a subheader starts a new run) and 4px inner ones (every item was 28px all round)
- **`MButtonGroup` shapes morph as in Compose's `ButtonGroup`**: standard items are a pill that squares off when selected and more while pressed, and the pressed one grows by 15% into its neighbors; connected inner corners go from 8px to 4px while pressed and a selected button becomes a full pill (it used to keep its inner corners). Springs replace the old size-dependent CSS transitions
- **Recent colors show by default** (`recent: true`)
- **The default presets add grey, black and white** (21 swatches, 3 rows of 7)
- **`MColorPickerModal`'s title and confirm button come from the locale** (`selectColor`, `confirm`) instead of a hardcoded "Select color" / "OK"

### Fixed
- `createM3UI({ palette })`: on the first visit the palette was reset to purple as soon as a component called `useColorPalette()`, whose state had been read before the plugin set it
- `MColorPicker`: dragging to black or to a gray reset the hue to red
- `MColorPicker` / `MColorPickerModal`: a preset given in a different case than the value (`#F44336` vs `#f44336`) wasn't marked as selected; the check mark was always white, unreadable on light swatches

## [0.9.1] - 2026-10-16

### Added
- `dist/API.md`: a compact API reference for AI coding agents, generated from the source on every build by `scripts/generate-api.mjs` (vue-component-meta): every component's props with types and defaults, events, slots with their bindings, exposed methods and types, plus composables, locale keys, theme tokens and palettes. `dist/api.json` holds the same data for tooling. New `build:api` script, run at the end of `pnpm build`
- JSDoc descriptions on every component, prop, event and slot, shown on hover in editors; components describe themselves, their slots (`@slot`) and events (`@event`) in a JSDoc block at the top of `<script setup>`

### Fixed
- Toasts (`useToast`) and notifications (`useNotification`) now use the locale given to `createM3UI()`. Their hosts are mounted in an app of their own, which the plugin's `provide` didn't reach, so their built-in text was always English; the plugin now also registers the locale as an app-wide fallback for `useLocale()`
- `MNotificationHost`: the close button had no accessible name; it now reads the locale's `close`
- `MHotkeys`: shortcuts with a modifier never fired. `mod` counted as a modifier of its own on top of Ctrl/Cmd, so `mod+s` was rejected for having Ctrl held and `ctrl+s` for having `mod` held; only single keys worked. `mod` now resolves to Ctrl (Cmd on Mac) and the held modifiers must match the combo exactly

## [0.9.0] - 2026-10-16

### Added
- `MEmojiSelector`: `recent`, `recentLimit`, `skinTones`, `preview` and `height` props, and a `focus()` method. Exports `withSkinTone()`, `toneableEmojis` and `skinTones` alongside the emoji data. 16 `M3Locale` keys for it (`emojiSearch`, `emojiNoResults`, `emojiRecent`, `emojiSkinTone`, `emojiSkinTones` and `emojiCategory*`) in all 7 locales
- `scripts/generate-emoji-data.mjs` regenerates the emoji data from Unicode's emoji-test.txt and CLDR annotations
- `MLightbox`: `zoom` (default `true`) and `maxZoom` props, and an `#actions` slot for buttons in its top bar
- `MDialog` `maxWidth` and `maxHeight` take a CSS value (`420px`, `min(90vw, 40rem)`, `50vh`) as well as a Tailwind class
- `MScheduler`: `v-model:date` (`YYYY-MM-DD`, to open on any date and follow navigation) and `v-model:view`; all-day events (`allDay` on `SchedulerEvent`, dates with an inclusive end) in a new all-day row, where events spanning several days also run as bars (clipped with an arrow past the visible range); `weekStartsOn` (Sunday or Monday), `hourHeight`, `nowIndicator`; an `#event` slot; clicking a day header opens that day; `M3Locale` key `allDay` in all 7 locales
- `MCarousel` `variant` prop with the four M3 layouts: `multi-browse` (default), `uncontained`, `hero` (centered) and `full-screen`, plus `orientation` (`horizontal`/`vertical`), `contentPadding`, `flingBehavior` (`single-advance`/`multi-browse`/`no-snap`), `userScrollEnabled`, `label`, `v-model` on the current item, an `itemClick` event, an `#item` slot (with `--m3-carousel-mask-start`/`--m3-carousel-mask-size` CSS variables describing the visible part) and `scrollToItem(index, animate)`
- `M3Locale` keys `carousel` and `carouselItem` (`'{index} of {count}'`), in all 7 bundled locales

### Changed
- **`MEmojiSelector` rebuilt.** The data is now the full Unicode set up to Emoji 15.0 (1,870 emoji in the same 11 categories), with names and keywords from CLDR in the 8 bundled languages, loaded on demand one language per chunk. Search matches emoji names and keywords in the app's language (ignoring accents) and in English, instead of category names; recently used emoji come first; emoji that take a skin tone offer them on long press, right click or Shift+Enter, and a footer button sets a default tone; the footer previews the hovered or focused emoji with its name; the grid is navigable with the arrow keys and every emoji is announced by name; the category bar follows the scroll. All of its text now comes from the locale. **Default appearance changed:** columns fit the width (`columns` still fixes them), the panel uses `surface-container-high` without a border, the search field is a pill, and the footer adds some height
- **`MLightbox` rebuilt as a gesture-driven image viewer, and marked beta.** It now has a top bar (close, position, `#actions`) and a bottom area (caption, thumbnails) that a tap on the image hides; swiping shows the neighboring image as you drag and takes velocity into account; zoom by double tap / double click, pinch, wheel or the `+` `-` `0` keys, and pan while zoomed; drag the image down to close; it opens out of and closes back into the image it came from with a container transform that keeps the thumbnail's crop and corners (auto-scanned images, or `open(index, el)`), and scales and fades otherwise. It's a modal dialog with a focus trap that gives focus back on close, and announces the position. Images get an explicit size from their measured ratio, so SVGs without `width`/`height` display. The API is backward compatible
- **`MScheduler` looks different by default**: it's laid out on a CSS grid instead of a table, hour labels sit on the hour lines, a line marks the current time in today's column (`:now-indicator="false"` hides it), week columns have a minimum width so a narrow scheduler scrolls sideways instead of squeezing them, and the header wraps on narrow widths
- **`MCarousel` rewritten as a port of Compose Material3's carousel** (keyline arrangement, start/end keyline shifting and snapping). Items now keep one size and are masked and translated as they scroll, instead of changing width, which made scrolling jumpy and fought `scroll-snap`. Scrolling is driven by drag (touch and mouse), wheel/trackpad and arrow keys, and a release moves at most one item, except `uncontained`, which scrolls freely. **Breaking:** `showArrows`, `autoplay`, `interval` and the `change` event are gone (they're not part of the M3 carousel; `MSimpleCarousel` keeps them, and `v-model` replaces `change`); `itemWidth` is now `itemSize` and `minSmallItemWidth`/`maxSmallItemWidth` are `minSmallItemSize`/`maxSmallItemSize`. **Defaults changed:** `itemSpacing` 0 → 8, large item size 280 → 186, height 220px → 205px, and items have 28dp (`--radius-xl`) corners

### Fixed
- `MTerminal` kept the colors of the theme and palette it was mounted with: xterm draws on a canvas, so it can't follow the CSS variables, and the component read them only once. It now re-reads them when the theme (`.dark`) or the palette (`data-palette`) changes. It also no longer creates a terminal that's never disposed when unmounted while xterm is still loading
- `MScheduler`: an event spanning several days only showed on its first day, with a height running past the grid; minutes were ignored (a 9:30 event sat at 9:00 and durations were rounded up to hours); overlapping events were drawn on top of each other; events starting before `startHour` weren't shown; changing the `view` prop after mount did nothing
- **`MDialog` (and `MConfirmDialog`), `MDatePickerModal`, `MTimePickerModal`, `MDateRangePickerModal`, `MBottomSheet`, `MSideSheet`, `MCommandPalette`, `MSpotlightSearch`, `MOverlay`, `MTour`, `MLightbox`, the modal `MNavigationDrawer` and `MLoadingOverlay` skipped their enter animation when mounted already open** (e.g. `v-if` and `v-model` set in the same tick, or `MLoadingOverlay` visible from the first render); they now animate in
- **`MCodeEditor` (and `MJsonEditor`/`MMarkdown`, which use it) rendered lines at CodeMirror's 1.4 line height instead of its own 1.6**, because CodeMirror's base theme sets it on `.cm-scroller`, which beat the value inherited from `.cm-editor`. Lines are now a bit more spaced
- `createM3UI({ customPalettes })` did nothing: the option was declared but never read. The palettes are now added to `useColorPalette().palettes`, so pickers built from that list show them (an entry with a built-in palette's `id` replaces it). Their CSS is still yours to write
- **`class`, `style`, `id`, `data-*` and `aria-*` passed to `MMenu`, `MContextMenu`, `MTooltip`, `MFab`, `MSplitButton`, `MLightbox`, `MBarcode`, `MLoadingOverlay` (fullscreen), `MNavigationDrawer` or `MNavigationRail` were silently dropped**, because these components render more than one root node (an element plus a `Teleport`, or a `v-if`/`v-show` pair). They now land on the visible element: the trigger for menus and tooltips, the FAB's wrapper, the split button's container, the barcode's `svg` (or its error message), the fullscreen overlay, and the drawer's or rail's `nav` (the panel for a modal drawer)

---

## [0.8.8] - 2026-10-14

### Added
- Four `M3Locale` keys for `MPagination`, `paginationRange` (`'{from}–{to} of {total}'`), `paginationPage` (`'Page {page} of {pages}'`), `previousPage` and `nextPage`, translated in all 7 bundled locales

### Fixed
- `MNavigationRail` (and `MNavigationSuite`'s rail): a regular or extended `MFab` in the `#fab` slot overflowed the header's fixed 40×56 box, poking past the rail's top and left edges. The box is now a minimum and grows with the FAB
- **`MPagination` texts were hardcoded in Spanish** ("1-10 de 25", "Página 1 de 3", "Página anterior/siguiente", "0 resultados"). They now come from the locale, so **without one it shows English** ("1–10 of 25", "Page 1 of 3"), with an en dash in the range; an empty list uses `noResults`
- `MPullToRefresh`: with a mouse, clicking an item while the list was scrolled to the top did nothing (e.g. a link or a row never opened). The component captured the pointer on `pointerdown` in case a pull followed, which sent the click to the scroller instead; it now captures only once the mouse has dragged down a few pixels

---

## [0.8.7] - 2026-10-14

### Added
- `MWindow` `maximizable` prop (default `true`): a maximize button between minimize and close, and double-click on the title bar, fill the container (square corners, no resize) and restore to the previous geometry, animated. Dragging a maximized window by its title bar detaches it after ~40px and eases it back to its size, keeping the grab point under the pointer. New `maximize` event (`true`/`false`)
- `MWindow` `snap` prop (default `false`): GNOME-style edge snapping while dragging. Holding the pointer at the container's top edge previews and applies a maximize, at its left/right edge that half. Dragging a snapped window away restores its size. Pushed into a top corner, the side wins over maximize
- `MWindow` `offscreen` prop (default `false`): the window can be dragged partly out of its container like on a desktop, up to 3/4 of its width past either side and down until only the title bar shows, never above the top. The container should clip it (`overflow: hidden`)
- `MWindow` exposes `focus()` (plus `toggleMaximize()` / `toggleMinimize()`) through a template ref and emits `focus` when it comes to the front, for taskbars and launchers that need to raise a window and know which one is active
- Three `M3Locale` keys for `MWindow`'s title bar buttons, `windowMinimize`, `windowMaximize` and `windowRestore`, translated in all 7 bundled locales
- `MTransferList` `#item` slot for custom rows, scoped with `{ item, checked, side, toggle, move }` (`side` is `'source'` or `'target'`; `move()` sends just that item across). On its own it replaces the icon and text and keeps the checkbox, checked highlight and hover
- `MTransferList` `bare` prop: the `#item` slot draws the whole row (no checkbox, padding, min height or background). Rows stay clickable, animated and focusable, exposed as checkboxes (`Space` checks, `Enter` moves)
- `MTransferList` is generic over its items (`T extends TransferItem`), so `#item` gets your own item type with its extra fields
- Buttons, links, fields and `[data-transfer-action]` elements inside an `MTransferList` row keep their own clicks and keys instead of checking or moving the row
- `useWindowSizeClass(target?)`: M3 window size classes as refs (`width`, `height`, `widthClass`, `heightClass`) with the androidx `WindowSizeClass` breakpoints: width compact < 600, medium < 840, expanded < 1200, large < 1600, extra-large; height compact < 480, medium < 900, expanded. Tracks the window, or an element's own size when given one. Also exports `widthSizeClass(px)` / `heightSizeClass(px)`
- `MNavigationSuite`: adaptive navigation after M3's `NavigationSuiteScaffold`. Picks by its own size (`navigationSuiteType`): `MShortNavigationBar` at compact width, the same bar with `centered`/`start` items at compact height, `MNavigationRail` otherwise; `layout` forces one (`bar`, `bar-medium`, `rail`, `rail-expanded`, `none`). Content keeps its state when the navigation swaps; a `#fab` slot goes in the rail's header or floats above the bar
- `MListDetail`: M3 list-detail layout. From the expanded width class (840px) list and detail sit side by side (24px spacer, list 360px, 412px from large, or `listWidth`); below that one pane shows, chosen by `v-model:showDetail`, with the detail sliding over the list and `back()` in the slot scope. Both panes stay mounted, so the list keeps its scroll position
- `MSupportingPane`: M3 supporting pane layout. From 840px the supporting pane sits beside the main one (360px / 412px, or `supportingWidth`); below that it reflows under it (`singlePane="below"`, M3's default) or moves into an `MBottomSheet` (`singlePane="sheet"` with `v-model:open`, closed automatically once both panes fit)
- `to` on `MNavigationRail`, `MShortNavigationBar` and `MNavigationSuite` items: the item becomes a real link (middle-click, open in a new tab), a `RouterLink` when vue-router is installed or a plain `<a href>` without it. Clicking still updates `v-model`; items without `to` stay buttons
- `MShortNavigationBar` item `disabled`: not selectable, icon and label at 38% of the unselected color with no hover (`ShortNavigationBarItemDefaults`' `DisabledAlpha`). Also applies to `MNavigationSuite` in its bar layouts

### Changed
- **`MWindow` title bar and motion.** The window in front now looks focused (`surface-container-high` bar, `on-surface` title, `primary` icon, elevation 3) while the others step back (`surface-container`, `on-surface-variant`, elevation 1). **Title bar buttons are 32dp** with M3 state layers, a focus ring, `aria-label`s and tooltips from the locale, and `type="button"`. **Windows scale and fade in/out when opened and closed, minimizing folds the height to the title bar**, and a dragged window lifts to elevation 4. Dragging and resizing use Pointer Events (pen works too)
- **`MBottomSheet` and `MSideSheet` now slide in when opened** (they only faded in: the drag's reactive `transform` style overrode the enter animation). Motion follows androidx `BottomSheet.kt`: the panel enters from fully off-screen with the `DefaultSpatial` spring (0.9 / 700), leaves with `FastEffects` (1.0 / 3800), and the scrim fades with `DefaultEffects` (1.0 / 1600). **The panel no longer fades in or out, it only slides.** Releasing a drag now springs from where the finger left it, carrying its speed: past 100px or flung it closes, otherwise it settles back. Animations are skipped under `prefers-reduced-motion`

### Fixed
- `MChart` kept the previous palette's axis, legend and tooltip colors after a palette switch (`useColorPalette().set()`), until the theme changed or the page reloaded: it now also watches `data-palette` on `<html>`
- `MWindow` couldn't be resized from its top edge or top corners: the directions were declared but had no handles and no resize logic
- `MWindow`s that were closed when mounted didn't follow later size changes of their container
- `MTransferList`: rows leaving a pane (e.g. on "move all") no longer stack on top of each other while fading out. Each leaving row is now pinned at its own position instead of falling back to a static position that shifted as its siblings left too

## [0.8.6] - 2026-10-13

### Added
- `MChatBubble` `typing` prop (`'text' | 'audio'`): shows a live indicator in place of the message, either three bouncing dots while the other person types or a pulsing mic with a moving waveform while they record audio. It keeps the bubble's side, avatar, sender, tail and `color`, and hides the content, time and status. Exposed as `role="status"` labelled with two new `M3Locale` keys, `chatTyping` and `chatRecordingAudio` (English defaults, translated in all 7 bundled locales), prefixed with `sender` when set. Animations stop under `prefers-reduced-motion`
- `MFileUpload` optional `v-model` (`UploadFile[]`): bind it to own the file list (clear it with `[]`, read or update entries). Unbound, the component keeps the list itself as before
- `MFileUpload` `#actions` slot: a right-aligned row below the list, shown only while it has files, scoped with `{ files, clear }`, for Upload/Clear buttons
- `MFileUpload` exposes `clear()` and `files` through a template ref
- `MDragDropList` `disabled` prop: turns pointer and keyboard reordering off and dims the list
- `MDragDropList` `bare` prop for fully custom rows (e.g. one card per item): removes the row's padding, min height, state layers and background so the slot draws the whole item. Dragging, keyboard support and the lift remain; the lift shadow is a `drop-shadow`, so it follows the slot's own shape. Spacing between items comes from a `gap-*` class on the list, which the drag accounts for
- `MDragDropList` slot scope gains `dragging` (true while the row is lifted) and `handleProps` (with `handle`, spread onto your own grip element with `v-bind`; needed in `bare` mode, where the built-in grip button isn't rendered)
- `MDragDropList` keyboard reordering: `Space`/`Enter` picks a row (or its handle) up, `↑`/`↓` move it, `Space`/`Enter` drops it, `Esc` restores the original order. Each step is announced through an `aria-live` region using five new `M3Locale` keys (`reorderHandle`, `reorderGrabbed`, `reorderMoved`, `reorderDropped`, `reorderCancelled`, with `{pos}`/`{total}` placeholders), translated in all 7 bundled locales
- `MTransferList` select-all checkbox in each pane's header (indeterminate when only some are checked, acts on the search results), a checked/total counter, and double-click or `Enter` on a row to move just that item across
- `MTransferList` `TransferItem.description`: optional second line under the label, also matched by the search
- `MTransferList` `listHeight` prop (default `'280px'`) for each pane's scroll area
- `MCheckbox` `ariaLabel` prop: accessible name on the input for checkboxes without visible text
- `MKanban` column `limit` (WIP limit): the header count shows as `count/limit`, tertiary when the column is full and error when it's exceeded. Cards can still be moved in
- `MKanban` `#column-header` (`{ column, count }`) and `#column-footer` (`{ column }`) slots, and a `dragging` flag in the `#card` slot scope
- `MKanban` keyboard support: `Space` picks a card up, `↑`/`↓` move it within its column, `←`/`→` to the neighboring column, `Space` drops it, `Esc` restores it, and `Enter` fires `cardClick`. Moves are announced with the new `kanbanMoved` locale key (`{column}`/`{pos}`/`{total}`), translated in all 7 bundled locales
- `MKanban` `data-kanban-action` attribute: mark any element inside a card (a badge, a span, a whole action row) so clicking it neither fires `cardClick` nor starts a drag, letting it do something else (open its own menu, copy a key, toggle a flag) instead of opening the card

### Changed
- `MRating` rebuilt with the same API (same props, same `update:modelValue`). It isn't in the official M3 spec, so it's now built from M3 primitives. **Changes the default look:** empty icons are the outlined glyph in `on-surface-variant` (was the same glyph at 40% opacity). The `hover:scale-110` is gone, replaced by a 40px circular state layer (8% hover / 10% pressed) tinted with the rating's `color`, and the component's footprint stays the same. Disabled now uses `on-surface/38` on the icons instead of 38% opacity on the whole component
- `MRating` now supports dragging to rate, with mouse or touch. Dragging past the first icon clears the rating to 0
- `MRating` keyboard support: arrow keys step by 1 (or 0.5 with `halfIncrements`, RTL-aware), `Home`/`End` go to 0/`max`, and a `secondary` focus ring shows on keyboard focus. Interactive ratings are `role="slider"` with `aria-valuenow`/`aria-valuetext`. Readonly ratings are `role="img"`, labelled with the value, and no longer a tab stop
- `MPullToRefresh` is no longer beta: the touch-drag problem that was its known limitation is fixed (see below)
- **`MResult` default texts now come from the locale.** They were hardcoded in Spanish ("Operación exitosa", "Página no encontrada", …) and ignored `createM3UI({ locale })`. 14 new `M3Locale` keys (`resultSuccessTitle`/`resultSuccessDesc` through `result500Title`/`result500Desc`) with English defaults and translations in all 7 bundled locales. An app with no locale now gets English; an app using `esLocale` keeps the same Spanish texts. The `info` status, which had no default description, now has one ("Here is something you should know.")
- **`MDragDropList` rebuilt on Pointer Events with real drag motion, same API.** The dragged row lifts with M3's dragged list item values (`ListTokens`: `ItemDraggedContainerElevation` = Level4, `ItemDraggedContainerExpressiveShape` = CornerLarge 16dp, `DraggedStateLayerOpacity` = 0.16) and follows the pointer, the other rows spring out of its way (Standard `DefaultSpatial`, dampingRatio 0.9 / stiffness 700, rAF-driven), and on drop it springs into its slot. Reorders made by keyboard or by the parent changing the array animate the same way. **Default rows now follow the M3 one-line list item (56dp min height, 16dp side padding, `body-large` text, 8% hover state layer)**, so they're taller than the old `px-3 py-2` rows. The container is now `role="list"` (was `listbox`, which announced it as a selection list)
- **`MTransferList` redesigned, same API.** Panes are `surface-container-low` surfaces with 16dp corners instead of bordered boxes; rows follow the M3 list item (56dp, `body-large`, icon in a round container, 8% hover state layer, `secondary-container` background when checked); search is an M3 pill field with a clear button; move-selected buttons are tonal and move-all outlined. When the component itself is narrower than 36rem (a container query, not a viewport breakpoint), the panes stack vertically and the arrows point down/up. Items animate in and out of each pane. Lists now have a fixed height (`listHeight`, 280px) instead of a 240px max height, keeping both panes the same size
- **`MKanban` rebuilt on Pointer Events with real drag motion, same API.** The dragged card lifts with `ElevatedCardTokens.DraggedContainerElevation` (Level4), a slight tilt and scale, and follows the pointer across columns (it switches to `position: fixed` so the board's scroll container can't clip it); a dashed slot marks where it will land while the other cards spring aside (Standard `DefaultSpatial`, rAF-driven), the target column gets a subtle tint, and on drop the card springs into its slot. Any reorder, including keyboard moves and changes made by the parent, animates with FLIP. The board auto-scrolls sideways near its edges while dragging and snaps columns when scrolled. **New default look:** columns are `surface-container` with 16dp corners, cards follow the M3 elevated card (`surface-container-low`, CornerMedium 12dp, elevation 1 → 2 on hover), headers use `title-medium`, and empty columns show a dashed drop zone with an icon
- `MKanban`: buttons, links, inputs and labels inside a card no longer fire `cardClick` when clicked (they already didn't start a drag), so a menu or button in the `#card` slot doesn't also open the card

### Fixed
- `MRating` with `halfIncrements` never actually showed a half icon: a half value rendered as a fully filled icon. Now each icon draws its outlined glyph with the filled glyph on top, clipped to the exact fraction, so halves (and any fraction, e.g. a readonly `4.3` average fills 30% of the 5th icon) render with any Material Symbol, not just `star`. A fractional `modelValue` now also renders as a fraction when `halfIncrements` is off (before, `3.5` showed as 3)
- `MRating`: clicking the current value again reset the rating to 0. It now keeps the value
- `MPullToRefresh`: a touch drag in a real mobile browser couldn't pull. The indicator started to follow the finger, then jumped back up. The drag ran only on Pointer Events, and `touch-action: none` was set inside `pointerdown`, but the browser decides how to handle a touch from its `touch-action` as soon as the finger lands, before that handler runs. So it treated the drag as a native scroll and fired `pointercancel`, which ended the pull. Touch now goes through `touchstart`/`touchmove` with a non-passive `touchmove` whose `preventDefault()` actually blocks the native scroll. The first move decides the gesture: dragging down with the list at the top becomes a pull, and anything else stays a normal scroll. Mouse and pen still use Pointer Events
- `MChatBubble`: the default slot was wrapped in a `<p>`, so custom content with block elements (images, buttons, cards) ended up as invalid markup inside a paragraph. It's now a `<div>`; it looks the same, since preflight already resets paragraph margins
- `MChatBubble`: the status checks on sent messages were always `on-primary` tinted. **With `color="secondary"` or `"tertiary"` they now use that bubble's on-color**
- `MNavigationRail` with `expanded`: collapsing made the label jump. It vanished, popped back for a few frames and then disappeared. The pill switched from `width: auto` to a fixed `w-14`, which can't be transitioned, so it snapped to 56px on the first frame and flex-shrink squeezed the still-visible label to 0. Separately, the label's `max-width` went 200px → 0 while the text itself is ~40px, so most of the transition did nothing visible. The pill now never gets an explicit width (collapsed it's still exactly 56px from its padding + icon), and the label is revealed with `grid-template-columns: 0fr ↔ 1fr`, which animates straight to the text's real width. Same fix in the `modal` panel's item copy
- `MFileUpload`: setting `status`/`progress` on an entry never updated the UI, so the documented progress bar, spinner and done/error icons couldn't actually be driven. The entries emitted in `select` were plain objects while the list rendered Vue's reactive copies of them, so writes to the emitted objects were invisible. Entries are now created with `reactive()`, so the emitted object is the rendered one
- `MFileUpload`: in single-file mode, a pick or drop where every file was rejected (wrong type, over `maxSize`) wiped the file already selected. It now leaves the list alone
- `MFileUpload`: image preview object URLs were only revoked via a row's remove button. They're now revoked whenever an entry leaves the list (including `clear()` or the parent emptying its `v-model`), and on unmount
- `MDragDropList` didn't work with touch: it used native HTML5 drag-and-drop, which doesn't fire for a finger on most mobile browsers. Touch now drags after a long press on the row (so a normal swipe still scrolls the page), or immediately from the grip with `handle`
- `MDragDropList`: controls inside a row (checkboxes, switches, buttons, links) could start a drag. They now work normally and never start one
- `MDragDropList`: the drop-target ring flickered while dragging over a row's content, since `dragleave` fired for every child element. The ring is gone; the other rows now move aside to show where the item will land
- `MTransferList`: clicking right on a row's checkbox toggled it twice, once from the checkbox and once from the row's `<button>` as the click bubbled up, so it showed checked while the component's state wasn't and the move button stayed disabled. Rows are no longer `<button>`s (which also made the nested checkbox invalid markup), and the checkbox is the only control in them
- `MKanban` didn't work with touch (native HTML5 drag-and-drop never fires for a finger on most mobile browsers). Touch now drags after a long press on a card, so a plain swipe still scrolls the board
- `MKanban`: reordering within a column landed one slot too far when moving a card down (dragging A onto C in A,B,C,D gave B,C,A,D although the indicator showed "before C"), because the target index wasn't adjusted after removing the card from the same list
- `MKanban`: dropping on a column's empty area after passing over a card used that stale card's index instead of the end of the column
- `MKanban`: `cardMove` fired even when a card was dropped back where it was, and the drop indicator flickered as the pointer crossed a card's content (`dragleave` firing for each child)

## [0.8.5] - 2026-10-04

### Changed
- `MTable` with `selectable`: same change as `MDataTable` in 0.8.4. Clicking a row no longer toggles its selection by default. Selection now happens only through the row checkbox, and a row click emits the new `rowClick` event (`MTable` had no row-click event at all before). The old click-anywhere-to-select behavior is still available with the new `selectOnRowClick` prop. The checkbox cell no longer runs its own toggle on click either, which removes the same triple-toggle that `MDataTable` had

### Fixed
- `MMenu`/`MContextMenu`: if the menu unmounted while its close animation was still playing, the panel stayed stuck in `<body>`, either still open or half-closed. This happened with an item that closes the menu and then navigates away, e.g. "Log out" → `router.push('/login')`. The unmount cancelled the animation loop without calling the leave transition's `done()`, and Vue only removes the Teleported panel inside that callback. An unmount mid-close now finishes the leave right away

## [0.8.4] - 2026-10-04

### Changed
- `MDataTable` with `selectable`: clicking a row no longer toggles its selection by default. Selection now happens only through the row checkbox, and a row click emits `rowClick`. The old behavior (click anywhere on the row to toggle it, no `rowClick`) is still available with the new `selectOnRowClick` prop. Before, `rowClick` never fired while `selectable` was on, so a table couldn't both select rows and open them on click. The checkbox cell no longer runs its own toggle on click (it only stops propagation): a single click on the checkbox's label also fired the cell's handler once for the label and once for the input's synthetic click, and only came out right because the three toggles cancelled to one

## [0.8.3] - 2026-09-27

### Added
- `--font-mono` token in `theme.css` (default `'Roboto Mono', ui-monospace, 'Fira Code', Consolas, monospace`), alongside the existing `--font-sans`, so the monospace face used by `MCodeEditor` and `MMarkdown` can be swapped the same way

### Fixed
- Overriding `--font-sans` didn't reach every component: `MChart` (legend, tooltips) and `MCircleProgressBar` (percentage label) hardcoded `'Roboto'`, and `MCodeEditor`/`MMarkdown` hardcoded `'Roboto Mono'`. All now read the tokens. `MChart` resolves `--font-sans` at runtime (Chart.js draws on a canvas, which can't read CSS vars), re-reads it when `<html>`'s `style` changes, and redraws once web fonts finish loading so the first paint doesn't stay stuck on the fallback face
- `MChart`'s axis ticks and radar labels never set a font family at all, so they rendered in Chart.js's own default (Helvetica) instead of the app font
- `MCodeEditor` never actually rendered in Roboto Mono (or any `--font-mono`): the font was set on `.cm-editor`, but CodeMirror's base theme declares `font-family: monospace` on `.cm-scroller` itself, which beats inheritance — so code always showed in the browser's generic monospace. The font is now set on `.cm-scroller`
- Scrolling inside a menu nested in another menu (e.g. a long picker in a submenu, or inside a mobile overflow menu) closed the whole menu tree — `MMenu`'s close-on-scroll check only exempted its *own* panel, not a nested menu's Teleported one, so the parent treated it as an outside scroll and unmounted the child mid-scroll. It now uses the same shared panel registry as the outside-click check. `MContextMenu` closed on *any* scroll, even inside its own panel; it now gets the same check. `MMenu`'s scroll area also gets `overscroll-behavior: contain`, so reaching the end of a long menu no longer chains the scroll to the page behind it (which would count as an outside scroll and close the menu)

### Docs
- README: self-hosting Roboto/Roboto Mono via `@fontsource/*`, and how to use a different font (build time or runtime)

## [0.8.2] - 2026-09-21

### Fixed
- `MMenu`/`MContextMenu` submenus were effectively unusable on touch: `MMenuItem`'s flyout submenu opened and closed purely off `mouseenter`/`mouseleave`, and a tap on a submenu item fires a synthetic `mouseleave` on the parent item first, with `relatedTarget: null` — the existing `related?.closest('.m3-submenu')` guard only protects real pointer moves between elements, so on touch it always fell through and hid (unmounted, since the submenu is `Teleport`ed) the submenu before its own `click` event could reach the tapped item. Switched the hover handlers from `mouse*` to `pointer*` events gated on `pointerType === 'mouse'`, so touch/pen never trigger the hover-driven open/close in the first place, and added click-to-toggle on the parent item itself (previously a no-op for items with `#children`) so submenus have a real touch (and keyboard — `Enter`/`Space` on the trigger button now works too) entry point instead of relying on hover alone
- `MMenu`/`MContextMenu` nested inside another `MMenu`/`MContextMenu`'s own slot (e.g. a "Language" or "Color palette" picker menu living inside a "More options" overflow menu) — clicking anything inside the nested menu's panel closed the outer menu first, on `mousedown`, before the click could reach its target, so the pick never applied. Both `Teleport` straight to `<body>` as independent siblings, so the outer menu's own-panel `contains()` check never recognized the inner one's Teleported DOM as "inside," and treated the click as outside. Replaced the per-instance check with a panel registry shared across the whole *logical* (component-tree, not DOM-tree) menu nesting via `provide`/`inject`, so an outside-click check now correctly recognizes clicks landing in any descendant menu's panel at any nesting depth
- `MSpotlightSearch`/`MCommandPalette`: every mounted instance listens for its own hotkey (`/`, `Cmd/Ctrl+K`) independently with no coordination between instances — if more than one was mounted at once (e.g. an app-wide spotlight plus a page-local demo of the same component), a single keypress opened all of them simultaneously. The handler now checks `e.defaultPrevented` before acting and the instance that claims the keypress calls `preventDefault()`, so only the first instance to see it opens
- `MMenu`/`MContextMenu`'s `submenuMode="push"` navigation never actually animated: with direction-dependent (`:enter-from-class`/`:leave-to-class`) bindings on a mode-less `<Transition>`, Vue's CSS-class enter/leave swap got stuck straddling the "from" and "active" state indefinitely — both the entering and leaving content froze at their starting position/opacity and the leaving one was never cleaned up from the DOM. Rewritten to drive the slide with the Web Animations API directly (`@enter`/`@leave` JS hooks, `:css="false"`) instead of relying on Vue's CSS-class transition machinery, matching this library's existing convention of animating real interactive motion in JS rather than CSS
- `variant="expressive"` grouped menus (`<MMenuDivider gap />`) had their shadow clipped on the left/right, and each group's background color (`SurfaceContainerLow`, straight from `SegmentedMenuTokens`) read as an unintended inconsistency next to the rest of the menu's `SurfaceContainer` — the padding fix for the shadow-clipping bug above didn't leave any horizontal room for the *group boxes'* own shadows since they sat flush against the same clipping wrapper. Added horizontal breathing room around the group stack and unified group boxes to the same `SurfaceContainer` color as the rest of the menu instead of the spec's separate (very close, easily mistaken for a bug) token
- A menu nested inside another menu's content (e.g. "Language" and "Color palette", both inside the same "More options" overflow menu) could both end up open at once — the panel-registry fix above (this same version) that stopped a nested menu's clicks from closing its ancestor also stopped *sibling* menus sharing that ancestor from closing each other, since a click on either sibling's trigger falls inside the shared ancestor's own registered panel. Added a separate, narrower registry (also via `provide`/`inject`) scoped to only a menu's *direct* children, so opening one now closes any other already-open sibling under the same parent — unrelated top-level menus elsewhere on the page are unaffected
- `MMenu`/`MContextMenu`'s open/close animation still read as an abrupt snap on close despite 0.8.1's fix — turns out that fix's premise was wrong: the real `DropdownMenuContent` (`Menu.kt`) animates scale and alpha with actual springs (`MotionSchemeKeyTokens.FastSpatial`/`FastEffects` on the Standard scheme, `StandardMotionTokens`: scale dampingRatio 0.9/stiffness 1400, alpha dampingRatio 1.0/stiffness 3800 — confirmed directly in source), not a duration+easing tween, which a cubic-bezier stand-in (0.8.1's fix) can't reproduce. Running open and close as two independent forward springs toward opposite targets *still* looked wrong once ported faithfully, though: alpha (stiffness 3800) settles much faster than scale (stiffness 1400), so on close the panel fades to fully invisible before the shrink finishes — the shrink itself is never actually seen, which is exactly the "shrinks a little abruptly, then disappears" look. Fixed by simulating the open spring once and playing that exact trajectory forwards for enter, backwards for leave (true time-reversal, not a second forward simulation toward swapped targets), via `requestAnimationFrame` like the rest of this library's physics-driven animations — close now visibly mirrors open
- That same open/close animation flickered (rapidly alternating opacity/scale) when toggled quickly — Vue interrupts an in-flight `@enter`/`@leave` JS hook by calling the *other* hook on the same still-mounted element without waiting for the first one's `done()`, but each hook call started its own independent `requestAnimationFrame` loop with no way to cancel the previous one, so an interrupted and a new loop ran concurrently, each overwriting the other's `style.transform`/`opacity` every frame. Now tracks the in-flight loop's cancel function (and the trajectory's current position, so a reversal continues smoothly from wherever it currently is instead of snapping back to a fixed start) outside the hook so a new call always cancels the previous one first
- The close animation (reverse playback, see above) had a noticeable dead pause before any visible shrink — a damped spring settles exponentially, so roughly the last third of the recorded open trajectory is values within a fraction of a percent of the fully-open target, indistinguishable from it visually but still technically "in motion" under a tight 0.001 position+velocity tolerance. Reversed, that flat tail becomes a ~80ms lead-in of no visible motion before close appears to actually start. Trimmed the recorded trajectory on a much looser, position-only "visually settled" threshold instead of the tight physical-settling one, cutting that dead tail without introducing a visible jump at the very end

### Changed
- `MMenu` used to reposition itself to keep following its trigger while the page scrolled, only closing once the trigger scrolled fully out of view — inconsistent with `MSelect`/`MAutocomplete`/`MMultiSelect` (and `MContextMenu`), which already close immediately on any outside scroll. Aligned `MMenu` to the same close-on-scroll behavior for consistency across the library

### Added
- `MMenu`/`MContextMenu` gained a `submenuMode` prop (`'flyout' | 'push'`, default `'flyout'`, matching prior behavior). `'push'` is a mobile-oriented alternative to the hover flyout: instead of a side panel positioned off `getBoundingClientRect()`, clicking an item with `#children` replaces the menu panel's own content in place with the submenu plus a back header row (`chevron_left` + the parent item's icon/label), supporting unlimited nesting depth via an internal navigation stack, with a real directional slide (not a cross-fade) — pushing a level in slides the new panel in from the right while the previous one slides out left, popping back reverses it. `Escape` pops one level instead of closing the whole menu when inside a pushed submenu; closing the menu (or, for `MContextMenu`, reopening it elsewhere) always resets back to the root level
- `MMenuItem` gained a `keepOpen` prop (default `false`) — when `true`, clicking the item still emits `click` but no longer closes the menu, for checkable/toggle items (e.g. a "Columns"/"Sort by" menu where the user picks several without the menu closing after each tap)
- `MMenu`/`MContextMenu` gained a `variant` prop (`'standard' | 'expressive'`, default `'standard'`). M3's real baseline menu shape is deliberately square-ish (`MenuTokens.ContainerShape`/`CornerExtraSmall`, 4dp — confirmed directly against `MenuDefaults.kt`, which is what this library already had), while its newer "vertical menu" Expressive styling uses a rounder 16dp corner (`SegmentedMenuTokens.ContainerShape`/`CornerLarge`) and can split into independently-rounded, separately-elevated groups at each divider. `variant="expressive"` switches the panel to the 16dp radius; combined with a new `gap` prop on `MMenuDivider` (default `false`, a no-op outside an expressive menu), that specific divider splits the panel into two separate rounded boxes with a small gap between them instead of rendering an in-line divider line — matching the real spec's "group" concept, ported here as a flat gap-only split (not the real source's further per-item leading/middle/trailing corner blending within a group, or its hover/focus/press per-item shape morphing, both scoped out for now)

## [0.8.1] - 2026-09-20

### Fixed
- `MTopAppBar`: the navigation icon (and trailing action icons) sat too close to the bar's edge — the row's `px-1` only accounted for `AppBar.kt`'s explicit `TopAppBarHorizontalPadding` (4dp), missing the extra 4dp the real `IconButton()` composable gets for free from `Modifier.minimumInteractiveComponentSize()` (it centers its 40dp visible container inside a 48dp touch target). `MIconButton` doesn't implement that invisible expansion, so the row padding is now `px-2` to land the icon glyph at the correct 16dp inset from the edge
- `MCalendar`, `MScheduler`, `MDatePicker`, `MDatePickerModal`, `MDateRangePicker`, and `MDateRangePickerModal`: the `locale` prop used for month/weekday/time formatting (`Intl.DateTimeFormat`) defaulted to a hardcoded `'es-ES'`, completely disconnected from the app's actual configured locale — a consumer using `createM3UI({ locale: frLocale })` (or any non-Spanish locale) still got Spanish month/day names from these six components regardless. `MRelativeTime` already had the right pattern (`props.locale ?? useLocale().lang`, reading the `lang` field `M3Locale`/`createM3UI` populate); all six now follow it, so month/weekday/time names track the app's actual locale by default and the `locale` prop becomes a true per-instance override rather than the only way to get correct output
- `MMenu`/`MContextMenu`'s open/close animation (identical hand-copied `<Transition>` block in both) read as stiff on open and janky on close. The real `DropdownMenu` (`Menu.kt`) drives both directions with the *same* symmetric spring (`FastSpatial`/`FastEffects`, scaling `0.8 → 1.0`) — ours instead used a barely-there 5% scale bump (`scale-95`) and, worse, an asymmetric 100ms-ease-out enter vs. 75ms-ease-in leave, so closing didn't mirror opening at all and read as an abrupt cut rather than a collapse. Now both directions use the real `0.8 → 1.0` scale amplitude at a matching 150ms duration, with M3's own emphasized-decelerate/accelerate cubic-beziers standing in for the spring (CSS transitions can't do real spring physics)
- `MKanban`'s empty-column state was hardcoded in Spanish (`"Sin tarjetas"`) with no locale wiring at all — while auditing that bug, found the same problem in `MTree` (its `emptyText` prop's *default value* was hardcoded to `'Sin elementos'` rather than falling back to the locale) and `MTreeTable` (hardcoded `"Sin datos"`, no `emptyText` prop and no `useLocale()` import at all — its sibling `MDataTable` already did this correctly). All three now follow the same pattern `MDataTable`/`MTransferList` already established: `emptyText ?? locale.noResults` (`MTreeTable`, matching its sibling) or `emptyText ?? locale.noItems` (`MKanban`/`MTree`, matching `MTransferList`), with `emptyText` as a per-instance override
- `MCodeEditor`: selecting text on the current line made the selection highlight invisible — CodeMirror renders its selection layer at `z-index: -1` by design (`@codemirror/view`'s `selectionLayer` has `above: false`, so it always sits behind the line content), and `.cm-activeLine`'s background was a fully opaque solid color, painting straight over that layer on whichever line happened to be active. Changed it to a translucent `color-mix()` tint (5% `on-surface` over transparent) so a selection on the active line now actually shows through, instead of being hidden underneath it
- `MSelect`, `MAutocomplete`, `MMultiSelect`, `MMultiAutocomplete`, `MSearchBar`: a `class` (or any other attribute) passed to any of these five was silently discarded — each one's template renders a fragment (the field `<div>` plus a sibling `<Teleport>` for the dropdown/panel), and Vue only auto-applies attrs fallthrough to a *single*-root component. Without `inheritAttrs: false` + an explicit `v-bind="$attrs"` on the field div, nothing told Vue which of the two roots should receive it, so it was dropped entirely — a consumer trying `<MSelect class="w-64" />` to give it a fixed width got no error, just a field that silently kept sizing itself off its own content (in practice: it resized every time the selected option's label changed length). Now forwards correctly on all five. The same fragment-root shape exists in several other components too (`MMenu`, `MContextMenu`, `MTooltip`, `MFab`, `MSplitButton`, `MTabs`, `MStepper`, `MListItem`, `MNavigationDrawer`, `MNavigationRail`, `MLightbox`, `MLoadingOverlay`, `MSkeleton`, `MDivider`, `MQRCode`, `MBarcode`) — not yet audited for the same bug, scoped out here since none of them are field/input components
- The `monochrome` palette's own 0.8.0 changelog entry claimed "pure black/white primaries, zero hue tint at every role", but its `primary`/`surface`/`background` roles (and their `on-*`/`inverse-*` counterparts) were actually near-black/near-white grays (`#1A1A1A`/`#FAFAFA`-ish) rather than truly pure — code didn't match the claim. Pushed those specific roles to literal `#000000`/`#ffffff`; left the secondary/tertiary/container grayscale ramp as its existing graduated steps, since those need to stay visually distinguishable from each other rather than all collapsing to the same two values
- `MCarousel` left dead space between items while scrolling — its first cut used a fixed-width outer "slot" (the flex item) wrapping a separately-shrinking inner "mask" element, so as a neighboring item's mask shrank, the outer slot stayed reserved at the full large width instead of letting flex reflow the next item up against it. The item element's own width is now the animated mask width directly, closing the gap

### Changed
- **Breaking:** `MCarousel` (the old fixed-width slide carousel) is renamed to `MSimpleCarousel`, and its exported `CarouselItem` type to `SimpleCarouselItem` — `MCarousel` now names the real M3 multi-browse carousel described below, and both couldn't keep the same name. Update `import { MCarousel } from '@m3ui-vue/m3ui-vue'` to `MSimpleCarousel` if you were using the old fixed-width one

### Added
- `MButton` gained an `iconPos` prop (`'leading' | 'trailing'`, default `'leading'`) — real M3 buttons support both via `ButtonDefaults.contentPaddingFor(hasStartIcon/hasEndIcon)` (padding ends up identical either way at every tier, confirmed against `Button.kt`), but this library only ever rendered `icon` before the slot content, with no way to get a trailing icon (e.g. a "Next" button) without hand-composing one inside the slot yourself
- New component: `MShape` — clips its default slot content (or renders a filled shape with no slot) into one of M3's 35 real "expressive" shapes (`MaterialShapes.kt`: `Cookie9Sided`, `Clover4Leaf`, `Gem`, `Sunny`, `Heart`, etc.), fully responsive via an SVG `clipPath` with `clipPathUnits="objectBoundingBox"` rather than a fixed pixel size. Changing the `shape` prop spring-morphs into the new outline (real per-frame physics via `requestAnimationFrame`, matching this library's established spring convention — not a CSS transition), using `ExpressiveMotionTokens.DefaultSpatial` (dampingRatio 0.8, stiffness 380) converted into the underlying morphing library's damping-coefficient parameterization, and a `speed` multiplier (scales stiffness by speed² and damping by speed, time-scaling the spring uniformly without changing its character). Built on the new `shape-morph` dependency (MIT, zero deps), a faithful TypeScript port of `androidx.graphics.shapes` — this is the library's first-ever hard runtime dependency, everything else heavy is an optional peer behind its own entry file, but this one is small (~50KB) and core enough to ship on the main entry directly
- New component: `MShortNavigationBar` — M3 Expressive's `ShortNavigationBar.kt`, a genuinely separate composable from the classic `NavigationBar` (`MNavigationBar` here), not just a variant: real container height is `64dp` (`NavigationBarTokens.ContainerHeight`) against the classic bar's `80dp` (`TallContainerHeight`). Two independently real props: `arrangement` (`'equal'`, the default — items fill the bar edge to edge, recommended for small screens — or `'centered'`, which groups items with horizontal padding computed straight from the real closed-form formula in `ShortNavigationBar.kt`, `((100 - 10×(itemCount+3)) / 2)%` per side for 3–6 items, `0` beyond 6 — recommended for medium/landscape screens) and `iconPosition` (`'top'`, icon stacked above the label in a `56×32dp` pill, matching `MNavigationBar`'s existing pattern — or `'start'`, icon beside the label inside one `40dp`-tall pill with `16dp` leading/trailing padding, where the *selected label* deliberately uses the icon's own color (`OnSecondaryContainer`) rather than `'top'`'s separate `Secondary` label color, per `ShortNavigationBarItemDefaults.colors()`'s own doc comment)
- New component: `MToggleButton` — M3 Expressive's standalone checked/unchecked button (`ToggleButton.kt`, `variant`: `filled`/`tonal`/`elevated`/`outlined`, matching `MButton`'s naming). Distinct from `MSegmentedButton`/`MButtonGroup`, which are groups — this is a single button. Morphs its own corner radius between three states on a real per-frame spring (not a CSS transition — `MotionSchemeKeyTokens.FastSpatial`, which resolves to the *Standard* scheme's dampingRatio 0.9/stiffness 1400, since `ToggleButton.kt` is a stable composable, not gated behind `@ExperimentalMaterial3ExpressiveApi` despite belonging to the Expressive redesign): a full pill when unchecked and idle, a per-tier squared radius (reusing `MButton`'s own already-audited `ContainerShapeSquare` values — 12/12/16/28/28px xs→xl) when checked, and a tighter per-tier radius while actively pressed (8/6/12/16/16px — the small tier's `6px` is a literal hardcoded override in the real source, not derived from its own token). Checked-state colors are genuinely different tokens per variant, not just "swap to a highlighted version of the same color" — filled/tonal swap their *container* role entirely (e.g. filled: `SurfaceContainer` unchecked → `Primary` checked), while checked `outlined` is the odd one out and fills solid with `InverseSurface`/`InverseOnSurface` rather than any primary/secondary tone
- **Beta:** `MCarousel` is now the real M3 `HorizontalMultiBrowseCarousel` (`Carousel.kt`/`Keylines.kt`), not a fixed-width slide deck (see the **Changed** section — the old component is `MSimpleCarousel` now). Its defining behavior: one large "focal" item at rest, with neighboring items continuously masked/resized toward a small "peek" size the further they scroll from the focal position — items grow and shrink live as you scroll, not fixed-size slides. Ported exactly from the real source: `minSmallItemWidth`/`maxSmallItemWidth` default to `40`/`56` (`CarouselDefaults.MinSmallItemSize`/`MaxSmallItemSize`), `itemSpacing` defaults to `0` (`CarouselDefaults.ItemSpacing`), `targetSmallSize = clamp(largeSize / 3, min, max)`, and the focal item sits at the scroll container's *left* edge, not centered (`createLeftAlignedKeylineList`). Deliberately not ported: the real `Arrangement.findLowestCostArrangement` combinatorial search that decides exactly how many large/medium/small items fit a given width to the pixel — used a direct triangular falloff from the focal position instead, which converges to the same look for realistic item counts/widths without that search's complexity

## [0.8.0] - 2026-09-18

### Fixed
- Text-field-shaped components — `MTextField`, `MSelect`, `MAutocomplete`, `MMultiSelect`, `MMultiAutocomplete`, `MNumberField`, `MMaskField`, `MTagInput`, `MPinInput`, and the trigger fields of `MDatePicker`/`MDateRangePicker`/`MTimePicker`/`MColorPicker` (plus `MDatePickerModal`/`MColorPickerModal`'s manual-entry inputs) — all shared the same hand-copied deviations from `FilledTextFieldTokens`/`OutlinedTextFieldTokens`, now fixed everywhere:
  - Corner radius was `8px` (this project's `--radius-sm`), spec's `ContainerShape`/`MenuTokens.ContainerShape` is `CornerExtraSmall` (`4px`, `--radius-xs`) — also fixed on `MSelect`/`MAutocomplete`'s dropdown/menu panels
  - Leading icon was `20px`, spec's `LeadingIconSize`/`TrailingIconSize` is `24dp`
  - Disabled state used one blanket `opacity-[0.38]` on the whole field instead of the spec's split values: text/label/icon/border at on-surface 38%, but the *filled* container background only 4% and the *outlined* border only 12% — the old blanket opacity made filled fields look far more washed-out and outlined borders far more visible than spec. The floating `<label>` now actually dims when disabled too — it didn't before, since it sat outside the old opacity class. `MMultiSelect`/`MTagInput` had no disabled styling at all before this, not even the old blanket opacity
  - No `caret-color` — the text cursor now tints `primary`/`error` (`CaretColor`/`ErrorFocusCaretColor`) instead of the browser default, on every real `<input>`/`<textarea>`
- `MSelect`'s empty-dropdown state ("Sin opciones") was hardcoded in Spanish, ignoring the `useLocale()` composable already used elsewhere in the same file — now uses a new `noResultsText` prop with the existing `noResults` locale key as fallback, matching the pattern `MAutocomplete` already had
- `MMultiSelect`/`MMultiAutocomplete`'s per-chip remove button wasn't gated by `disabled` — a disabled multi-select still let you remove individual chips. The button no longer renders at all when the field is disabled
- `MNavigationBar`/`MNavigationRail`'s active item's label was tinted the same color as its icon (`on-secondary-container`); M3's `ItemActiveLabelTextColor` is `secondary`, a *different* color from `ItemActiveIconColor`. Also removed an active-label bold-weight toggle neither token file defines (only color changes)
- `MNavigationBar` had no `shadow-elevation-2` on the bar itself (`ContainerElevation = Level2`)
- `MNavigationDrawer`: default width was `288px`, spec's `ContainerWidth` is `360px`; the modal variant used `surface-container` + elevation level 3, spec's `ModalContainerColor`/`ModalContainerElevation` are `surface-container-low` + level 1 (far less shadow); active item row height was ~`44px` against the `56dp` `ActiveIndicatorHeight`; the far edge (opposite the screen edge) had no corner rounding against `ContainerShape = CornerLargeEnd`/`BottomContainerShape = CornerLargeTop`
- `MTabs`: label typography was `label-large`, spec's `LabelTextFont` is `title-small` in both variants — not just a size difference, a different type-scale entirely; icon size was `20px`/`18px` (primary/secondary) against the spec's `24dp` in both; primary's icon+label tab height was `56px` against `IconAndLabelTextContainerHeight = 64dp`; secondary's indicator was `2px` thick against the real `3dp` (confirmed via `TabRow.kt` — there's no separate lower value for the underline style despite the "Secondary" naming)
- `MMenu`/`MMenuItem`/`MContextMenu`'s dropdown/submenu panels used `16px` corner radius against `MenuTokens.ContainerShape = CornerExtraSmall` (`4px`) — same bug as the text-field dropdown panels above, independently hand-copied
- `MMenuItem` had no visible keyboard focus indicator at all (only a hover background) — added a `focus-visible` ring using `MenuTokens.FocusIndicatorColor = secondary`
- `MDialog` (and `MConfirmDialog`, which wraps it): bottom padding below the actions row was `16px`, spec's `AlertDialogDefaults.dialogPadding` is `24dp` on all four sides; default `maxWidth` was `max-w-md` (448px) against `AlertDialogDefaults.DialogMaxWidth = 560dp`, and there was no `min-width` at all against `DialogMinWidth = 280dp`
- `MButton`'s `size` prop (`xs`/`sm`/`md`/`lg`/`xl`) is implementing M3's newer 5-tier "expressive" button sizing (`Button{XSmall,Small,Medium,Large,XLarge}Tokens.kt`), and several tiers had the wrong values: `xs` used a `16px` icon and `label-medium` text against the real `20dp`/`label-large`; `md` used a `20px` icon against `24dp`; `lg` and `xl` were especially far off since the real jump to those tiers is large by design — `lg` was `64px` tall with a `22px` icon and `title-large` text against the real `96px`/`32dp`/`headline-small`, and `xl` was `80px` with a `24px` icon and `headline-small` text against the real `136px`/`40dp`/`headline-large`. The icon-label gap was a flat `8px` for every size; real spec varies it (`4/8/8/12/16dp` for xs→xl). Horizontal padding was also off at most tiers, and previously had a separate (wrong) reduced value for when an icon was present — the real tokens use the *same* padding whether or not there's an icon at every tier, so that split was removed. `shape="squared"`'s corner radius was a flat `12px` for every size; now scales per tier (`12px` xs/sm, `16px` md, `28px` lg/xl, matching each tier's own `ContainerShapeSquare`)
- `MButton`'s `variant="outlined"` border was `border-outline`; `OutlinedButtonTokens.OutlineColor` is actually `OutlineVariant`, a different (more subtle) color role — fixed to `border-outline-variant`
- `MButton`'s disabled container/border opacity was `12%` (`disabled:bg-on-surface/12` / `disabled:border-on-surface/12`) for filled/tonal/elevated/outlined; spec's `DisabledContainerOpacity = 0.1f` (`10%`) — also, the outlined variant's disabled border was tinted `on-surface`, but per the fix above it should follow its own (`outline-variant`, or `error` for the error color) border color rather than on-surface
- `MIconButton` has the same 5-tier size system as `MButton` (`{XSmall,Small,Medium,Large,XLarge}IconButtonTokens.kt`), with the same kind of deviations: `md`/`lg`/`xl` container sizes were `48/56/64px` against the real `56/96/136px` (again, `lg`/`xl` are a genuinely large jump in the real spec), `xs`/`sm`/`lg`/`xl` icon sizes were off by a few px each, and `shape="squared"`'s corner radius was a flat `12px` instead of scaling per tier (12/12/16/28/28px). `variant="outlined"`'s border was `border-outline`; the real (non-"vibrant") `outlinedIconButtonBorder` actually tracks the button's own content color (`LocalContentColor`, i.e. `on-surface-variant`) rather than a fixed border token, so it's now `border-current` — which also means its disabled state no longer needs a separate class, since it dims automatically along with the icon's own `disabled:text-on-surface/38`. `disabled:bg-on-surface/12` → `/10` for filled/tonal, matching `DisabledContainerOpacity`. Filled/tonal variants also had a `hover:shadow-elevation-1` that doesn't exist in the real spec at all (`IconButton.kt` has zero elevation tokens for any variant) — removed, and replaced with an actual state-layer overlay (an 8%/12% `before:bg-current` layer on hover/press, the same technique `MButton` already uses) since filled/tonal previously had no hover/press feedback whatsoever besides that incorrect shadow
- `MCard` (`clickable`): hover/pressed elevation was the same `hover:shadow-elevation-2`/`active:shadow-elevation-1` for all three variants, copied from `elevated`'s own values — `Filled{,Elevated,Outlined}CardTokens` actually differ per variant: only `elevated` reaches Level2 on hover and stays elevated (Level1) while pressed; `filled`/`outlined` only reach Level1 on hover and drop back flat (Level0) while pressed
- `MCheckbox`: the touch/state-layer target was `48px` (`h-12 w-12`) against `CheckboxTokens.StateLayerSize = 40dp`; the check icon was `14px` against `IconSize = 18dp` (it should fill the whole 18px box, not sit inside it with visible padding); corner radius was `3px` against `ContainerShape`'s `2dp`
- Fixed a real regression introduced while adding `MCheckbox`'s hover/focus state layer below: the hidden (`sr-only`) checkbox `<input>` had been hoisted up to be a direct child of `<label>`, away from any nearby `position: relative` ancestor. Clicking it made the browser's native "scroll the newly focused element into view" behavior treat a distant unrelated `overflow: hidden` ancestor (in the consuming app's own layout, not anything in this library) as a real scroll container and scroll it to its maximum — visually blowing the whole page off-screen. Moved the input back to being nested inside the same `relative` span as before (a true sibling of the state-layer/focus-ring spans, so `peer-*` styling still works) — this is exactly how `MSwitch`'s input is nested, which never had the bug
- `MChip`: corner radius was a flat `rounded-sm` (8px) at every state; spec's `ChipsTokens.UnselectedShape`/`SelectedShape` are `CornerMedium` (12dp) unselected but `CornerFull` (a full pill) once selected — chips now morph shape when `selected` toggles, not just color. The neutral/unselected border was `border-outline`; spec's `UnselectedOutlineColor` is `OutlineVariant` (same mixup `MButton` had). Disabled neutral/unselected border opacity was `12%`; spec's `UnselectedDisabledOutlineOpacity` is `10%` (the disabled-and-filled/selected case was already correctly `12%`, matching `SelectedDisabledContainerOpacity` — only the outline case was off)
- `MRadio`: same missing-interactivity gaps `MCheckbox` had before its own fix — touch/state-layer target was `48px` against `RadioButtonTokens.StateLayerSize = 40dp`; the unselected ring+dot stayed a fixed `on-surface-variant` instead of darkening to `on-surface` on hover/focus/press (`Unselected{Hover,Focus,Pressed}IconColor`)
- `MSwitch`: the on-check icon color used the raw `color` prop tone (`text-primary` etc.) instead of `SwitchTokens.SelectedIconColor`, which is the *container* variant of that tone (`on-primary-container` etc. — a different role from the handle's own `on-primary` fill it sits on top of). Neither the track outline nor the handle changed color on interaction the way the real tokens define (`Unselected{Hover,Focus,Pressed}HandleColor` = `on-surface-variant` instead of the resting `outline`; `Selected{Hover,Focus,Pressed}HandleColor` = `{color}-container` instead of the resting `on-{color}`). The handle also didn't grow to `28dp` while pressed (`Pressed{Handle}Width/Height`, the same for both selected/unselected)
- `MBadge`: dot badge was `10px` against `BadgeTokens.Size = 6dp`; the labeled/large badge was `20px` against `LargeSize = 16dp` (including the "99+" case's `min-width` floor); label typography was a raw `10px` instead of the semantic `text-label-small` (`LabelSmall` = `11px`/`16px` line-height in this project's own type scale) every other text role in the library already uses
- `MListItem`: container height wasn't enforced against `ItemOneLineContainerHeight`/`TwoLine`/`ThreeLine` (`56`/`72`/`88dp`, a real `max(minHeight, contentHeight)` floor, not just padding) — 1-line rows landed around `40px`, 2-line around `60px`. The selected-state `SecondaryContainer`/`OnSecondaryContainer` treatment (`ItemSelectedContainerColor`, which applies to any selected list item per spec) was only wired up for `nav`/`segmented` contexts — a plain selectable list item fell back to a flat `on-surface/8` tint with no text/icon recolor at all, and even the nav/segmented branches never actually recolored the leading/trailing icons or title/subtitle/description, which stayed hardcoded regardless of state
- `MTooltip` (plain variant): had a `shadow-elevation-2`, real default elevation is `0dp`; padding was `12px`/`6px` against `PlainTooltipContentPadding`'s `8px`/`4px`; max-width was `220px` against `plainTooltipMaxWidth = 200dp`; the `24dp`/`40dp` min-height/min-width floor (`TooltipMinHeight`/`TooltipMinWidth`) wasn't enforced; the anchor gap was `8px` against `SpacingBetweenTooltipAndAnchor = 4dp`; typography was `text-label-medium` instead of the real `BodySmall` role (pixel-identical in this project's scale, but semantically wrong)
- `MTooltip` (rich variant): elevation was `shadow-elevation-3` against `RichTooltipTokens.ContainerElevation = Level2`; the subhead/title color was `on-surface` against `SubheadColor = OnSurfaceVariant`; dropped a `ring-1 ring-outline-variant` border with no backing token in `RichTooltipTokens` (elevation + `SurfaceContainer` alone differentiate it per spec)
- `MSnackbar`/`MNotificationHost`: structural tokens brought in line with `SnackbarTokens` — shape `rounded-2xl` (16px) against `ContainerShape = CornerExtraSmall` (4dp); elevation `shadow-elevation-2` against `ContainerElevation = Level3`; icon size `20px` against `IconSize = 24dp`; action-button typography `label-medium` against `ActionLabelTextFont = LabelLarge`; no `48dp` single-line height floor (`SingleLineContainerHeight`). The color-variant/badge-count/progress-bar toast system has no equivalent in the real (single-color) Snackbar spec and was deliberately left as a library extension
- `MSegmentedButton`: disabled state applied one blanket `opacity-[0.38]` to the whole button; real `SegmentedButtonColors` differentiates content (`OnSurface` at 38%) from the border/divider (`Outline` at only 12%) — the divider read far more prominent than the content when disabled. Also fixed `color="primary"` being a dead option that fell through to the exact same `bg-secondary-container` treatment as `color="secondary"` — now maps to `bg-primary-container`/`text-on-primary-container`, making all 3 declared color options actually distinct (**this changes the default appearance**, since `color` defaults to `'primary'`)
- `MSplitButton`: `lg`/`xl` container height was stuck at the same undersized `64px`/`80px` `MButton` had before its own expressive-tier fix (real `SplitButtonLargeTokens`/`XLargeTokens.ContainerHeight` = `96dp`/`136dp`) — carries the identical correction, plus the outer pill radius scaling with it. Icon sizes (main + trailing arrow) were off across all 5 tiers, not just `lg`/`xl`. Horizontal padding was short on `md`/`lg`/`xl` in the same proportion as the height bug. Resting inner-corner radius (where the two buttons meet) corrected on `sm`/`md`/`lg`/`xl`. Disabled state now splits content (`on-surface` 38%) from container (`on-surface`/`outline-variant` 10%) opacity instead of a blanket 38% on everything
- `MButtonGroup`: real M3 `ButtonGroup` only defines one size tier (`Small`, `40dp`) — there is no official `Medium`/`Large`/`XLarge`/`XSmall`, unlike `Button`/`SplitButton`. On the spec-verified `sm` tier: standard variant's gap between buttons was `6px` against `ButtonGroupSmallTokens.BetweenSpace = 12dp`; connected variant's resting inner-corner radius was a hardcoded `6px` against `ConnectedButtonGroupSmallTokens.InnerCornerCornerSize = CornerValueSmall` (`8dp`)
- `MBottomSheet`: corners were `rounded-t-xl` (12px) against `SheetBottomTokens.DockedContainerShape = CornerExtraLargeTop` (28dp); elevation was `shadow-elevation-3` against `DockedModalContainerElevation = Level1`; there was no `640dp` max-width cap (`BottomSheetDefaults.SheetMaxWidth`) at all, so the sheet always spanned the full viewport width even on wide/desktop screens; the drag handle was tinted `on-surface-variant` at 40% opacity against the real full-opacity `DockedDragHandleColor`; the handle's touch-target row was `36px` against the real `48dp` (`DragHandleVerticalPadding` 22dp top+bottom around the 4dp handle)
- Library-wide: the scrim overlay used by 16 components (`MDialog`, `MNavigationDrawer`, `MNavigationRail`, `MSideSheet`, `MSelect`/`MMultiSelect`, `MAutocomplete`/`MMultiAutocomplete`, `MDatePickerModal`/`MDateRangePickerModal`/`MTimePickerModal`/`MColorPickerModal`, `MFab`, `MCommandPalette`, `MTour`, `MBottomSheet`) was `bg-scrim/40`; real `ScrimTokens.ContainerOpacity = 0.32f`, now `bg-scrim/32` everywhere. `MOverlay`/`MSpotlightSearch` use a distinct `bg-scrim/50` not covered by this token, left as-is
- `MToolbar`: never enforced the real `64dp` container thickness (`FloatingToolbarTokens`/`DockedToolbarTokens.ContainerHeight`) on either variant, sizing purely off content + padding; floating variant's shape was `rounded-2xl` (16px) against `ContainerShape = CornerFull` (a true pill); floating variant always had a `shadow-elevation-2`, but the real default elevation is `0` (`ContainerExpandedElevation = Level0`) — only bumping to `Level1` when a FAB is attached; leading/trailing padding didn't differ by variant (both `12px`) against the real `8dp` (floating) vs `16dp` (docked)
- `MDialog`'s title was pushed off-center when both the `#icon` slot and the close button were showing (the default `closable`): centering (`text-center`) combined with a right-only `pr-10` (reserved to clear the close button) shifts the visual center left of the dialog's actual midpoint. Now uses symmetric `px-10` in that combination, keeping the title truly centered under the icon

### Added
- `MCodeEditor` gained C, C++, Rust, and Assembly language support (`language="c" | "cpp" | "rust" | "asm"`). C and C++ share the same `@codemirror/lang-cpp` parser (there's no separate C-only package upstream). Rust uses the official `@codemirror/lang-rust`. Assembly has no dedicated CodeMirror 6 package, so it's the GNU/AT&T-syntax mode ported from CodeMirror 5 via `@codemirror/legacy-modes` (`StreamLanguage.define(gas)`) — highlighting is more basic than the tree-sitter-backed languages, but still distinguishes registers, directives, comments, and strings. All three new peer deps are optional, matching the rest of the code-editor entry point's dependencies
- 10 new color palettes (`useColorPalette()`'s `palettes` array + `src/styles/palettes.css`, now 40 total): `monochrome` (a hand-authored true grayscale — pure black/white primaries, zero hue tint at every role, distinct from the library's existing muted-gray palettes like `graphite`/`charcoal`, which still carry a faint residual hue from their seed colors), and 9 new jewel-tone hues generated the same way as the existing 30 (Google's `@material/material-color-utilities`, `themeFromSourceColor`) chosen to fill real gaps in the existing hue spectrum: `rust`, `gold`, `emerald`, `turquoise`, `cobalt`, `sapphire`, `amethyst`, `magenta`, `mauve`
- `MTabs` gained a `scrollable` prop (default `false`) matching M3's two separate `TabRow` composables: `false` (new default) evenly distributes tabs across the available width with no scrolling (M3's *Fixed* `TabRow`, meant for 2-5 tabs); `true` restores the previous natural-width + horizontal-scroll-on-overflow behavior (M3's *Scrollable* `TabRow`). **This changes the default visual behavior** for any existing usage with more tabs than comfortably fit — pass `scrollable` to keep the old look
- `MMenu`/`MContextMenu` now support keyboard navigation: opening a menu focuses its first item automatically, and ArrowUp/ArrowDown move focus between items (wrapping at both ends) — previously only Escape-to-close was handled
- `MNavigationRail` gained an `expanded` prop, mirroring M3's `WideNavigationRail`: items switch from a narrow centered icon-only pill (`NavigationItemIconPosition.Top`) to a full-width pill with the icon and a `text-label-large` label side by side (`NavigationItemIconPosition.Start`), and the rail itself widens from 80px to 220px (`NavigationRailCollapsedTokens.NarrowContainerWidth`/`NavigationRailExpandedTokens.ContainerWidthMinimum`). Every item row keeps a constant 64dp height in both states (`NavigationRailBaselineItemTokens.ContainerHeight`) so toggling never reflows sibling items, and the icon's horizontal position never moves — only the pill grows around it. The label reveals through a `overflow-hidden` box whose width (and opacity) animates left-to-right from the icon's edge, rather than a plain fade or the real component's hard position-snap-at-alpha-zero (verified against `NavigationItem.kt`'s `placeAnimatedLabelAndIcon` — the literal Compose behavior doesn't slide/reveal the label at all, this is a deliberate simplification for the CSS-transition-based approach used here). Does **not** implement the real `WideNavigationRail`'s draggable resize handle (220-360dp) — scoped down to match the simpler boolean-toggle pattern `MNavigationDrawer.collapsed` already uses. Expanded pill width was initially implemented as `w-full` (stretched to the rail's own width); fixed to hug its content instead (`ActiveIndicatorLeadingSpace`/`TrailingSpace` = 16dp each) like the real `WideNavigationRailItem`, leaving empty space in the rail after a short label rather than a full-bleed bar
- `MNavigationRail` gained a `modal` prop mirroring M3's `ModalWideNavigationRail` (default `hideOnCollapse = false` behavior): the collapsed rail stays on screen and never reflows the app's layout, while `expanded` instead opens a Teleported, scrim-backed panel flush against the screen edge (`ModalContainerColor` = surface-container, `ModalContainerElevation` = Level2), closable via the scrim, Escape, or picking an item, and emitting `update:expanded`. The panel's open/close is a real width spring (rAF, semi-implicit Euler) using `MotionSchemeKeyTokens.FastSpatial` (dampingRatio 0.9, stiffness 1400 — the literal token `WideNavigationRailLayout` uses for the modal variant), producing the spec's slight overshoot/bounce on open; items animate through the same collapsed → expanded transition as the non-modal rail rather than mounting pre-expanded
- `MDialog` gained an `#icon` slot mirroring `AlertDialog`'s optional `icon` param (`IconColor = Secondary`, expects 24dp content, `IconPadding` bottom `16dp`) — its presence also centers the title, per spec ("Align the title to the center when an icon is present"). Also gained a `closable` prop (default `true`) to opt out of the header close ("X") button, which isn't actually part of the `AlertDialog` spec (the spec expects only Cancel/Confirm text buttons in the actions row) — kept as a library addition but now toggleable. The actions row now wraps (`flex-wrap`) instead of overflowing when button labels are too long to fit on one line, approximating `AlertDialogFlowRow`. `MConfirmDialog` (which wraps `MDialog`) got the same `closable` prop, passed straight through
- `MCard` gained a `disabled` prop, matching M3's per-variant disabled container tokens: `elevated` swaps to a plain `surface` background, `filled` to `surface-variant`, both at 38% container opacity (applied via a `/38` color-opacity modifier on the background color itself, not a blanket `opacity-*` on the whole element — Compose's real disabled Card only dims the container, not its content/text); `outlined` instead keeps its background and only dims its border, to `outline` at 12% (not the resting `outline-variant`, and a much lighter fade than the other two variants' 38%). `clickable` cards also gained real keyboard accessibility they never had before — `role="button"`, `tabindex`, and Enter/Space triggering the same click a mouse would (there was previously no way to reach or activate a clickable card without a mouse) — plus a `focus-visible` indicator (a `secondary` ring for elevated/filled, matching `FocusIndicatorColor`; the border itself darkening to `on-surface` for outlined, matching `FocusOutlineColor`, rather than a separate ring on top of the border it already has). `disabled` combined with `clickable` blocks all of this (mouse via `pointer-events-none`, keyboard via removing `tabindex` and no-op'ing the Enter/Space handler)
- `MCheckbox` gained real hover/press/focus feedback it never had before: a circular state-layer overlay (8%/12%, tinted with the checkbox's own indicator color) using `group-hover`/`group-active` off the `<label>` so hovering the row's text also triggers it, not just the 18px glyph; a `focus-visible` ring (`secondary`, matching `CheckboxTokens.FocusIndicatorColor`) via a `peer`-based input; and the unselected border now darkens from `on-surface-variant` to `on-surface` on hover/press, matching `Unselected{Hover,Pressed}OutlineColor` (previously a fixed color at every state)
- `MChip`'s `clickable` chips gained a `focus-visible` ring (`secondary`, matching `ChipsTokens.FocusedIndicatorColor`) and a real hover/press state layer (the `before:`-overlay technique used elsewhere in the library, now including a proper `active`/press state which didn't exist before) — the previous hover feedback was a direct `hover:bg-on-surface/8` that would have replaced, not overlaid on top of, a filled/selected chip's own background color
- `MRadio` gained the same kind of hover/press/focus-visible state-layer feedback as `MCheckbox`, tracking `RadioButtonTokens`' real per-state icon colors (`Unselected{Hover,Focus,Pressed}IconColor`) — but *without* a focus ring, since real `RadioButtonTokens` has no `FocusIndicatorColor` at all, unlike `MCheckbox`/`MChip`
- `MSwitch` gained a `focus-visible` ring (`secondary`, matching `SwitchTokens.FocusIndicatorColor`) and a `StateLayerSize` 40dp state-layer circle that — unlike `MCheckbox`/`MRadio`'s static one — tracks the thumb's own animated position, since the switch's interactive point moves; the handle now also grows to `28dp` while pressed (`Pressed{Handle}Width/Height`), via the same `scale()` technique already used for the 16dp unselected size, driven by real pointerdown/up tracking since the transform is JS-computed and CSS `active:` can't reach into it. The handle and track now also recolor correctly on hover/focus/press per `Unselected{Hover,Focus,Pressed}HandleColor`/`Selected{Hover,Focus,Pressed}HandleColor`
- `MSwitch` gained an `icon` prop (default `true`, preserving this component's existing look) for M3's second official Switch variant — Compose's `Switch` composable actually defaults to *no* icon at all (`thumbContent = null`); the checkmark-in-thumb look is the opt-in variant, not the baseline. Pass `icon="false"` for the plain variant
- `MListItem` gained an `overline` prop + `#overline` slot, the real M3 list item's third text region (above the headline, `LabelSmall`/`OnSurfaceVariant`) that was previously missing entirely — folded into the existing line-count auto-detection (`overline` alone counts as 2-line, `overline`+`subtitle` as 3-line, matching the real "two-line has either supporting OR overline" rule)
- `MFab` gained a `medium` size tier (`size="medium"`, 80dp container / 28dp icon / 20dp corner radius), the newer expressive M3 FAB size that sits between `regular`(56dp) and `large`(96dp) — the library previously only had 3 of the real 4 size tiers
- `MDialog` gained the optional divider from M3's official dialog anatomy (there's no reference implementation in Compose's `AlertDialog.kt` to port — this is a spec element with no built-in Material3 behavior to copy): shown automatically above the actions row only while the content has more to scroll to, hidden once scrolled to the bottom. No new prop
- `MDialog` gained a `maxHeight` prop mirroring the existing `maxWidth` (default `max-h-[90vh]`, matching the value that was previously hardcoded) — `AlertDialogDefaults` has no max-height token at all, so there's no spec value being matched here, just a configurable version of the library's own existing cap
- `MTopAppBar`: edge padding was `16px` against `TopAppBarHorizontalPadding = 4dp`; medium/large title bottom padding was a flat `12px` for both against the real (and different per tier) `MediumTitleBottomPadding = 24dp`/`LargeTitleBottomPadding = 28dp`; the `elevated` prop only added a shadow, but real `AppBarTokens` swap container color *and* elevation together when scrolled (`Surface`→`SurfaceContainer` + `Level0`→`Level2`); the navigation icon inherited `MIconButton`'s default `on-surface-variant` tone, but real `LeadingIconColor = OnSurface` is a different, more prominent role than the trailing/action icons' `OnSurfaceVariant`
- `MSelect`/`MAutocomplete`: the selected option (in both the dropdown and the mobile fullscreen modal) used a translucent `bg-primary/8`/`text-primary` wash; real `MenuTokens.ListItemSelectedContainerColor`/`ListItemSelectedLabelTextColor` are a solid `SecondaryContainer`/`OnSecondaryContainer` fill, matching the same selected-state treatment `MListItem` now uses
- `MDatePicker`/`MDateRangePicker` (dropdown): panel was `320px`/`8px`-radius/`surface-container` against real `DatePickerModalTokens.ContainerWidth=360dp`/`ContainerShape=CornerExtraLarge`(28dp)/`ContainerColor=SurfaceContainerHigh` — their Modal siblings already had these right. Day cells were `36px` against `DateContainerHeight=40dp`. Weekday header (`WeekdaysLabelTextFont`/`Color`=`BodyLarge`/`OnSurface`) was wrong in all 4 picker files (dropdown + Modal, both Date and DateRange), and `MDatePickerModal`'s header supporting text/big date headline were off in typography (and, for the headline, color too — real `HeaderHeadlineColor=OnSurfaceVariant`)
- `MTimePickerModal`: time-selector digit boxes were `72px` against real `TimeSelectorContainerHeight=80dp` with `DisplayMedium` typography against `DisplayLarge`; box/period-selector radius was `16px` against `CornerSmall`(8dp); the AM/PM period selector was `label-large` against `TitleMedium`; clock-dial number labels were `body-medium` against `BodyLarge`; the drag handle's end circle was `40px` against `ClockDialSelectorHandleContainerSize=48dp`. `MTimePicker` (dropdown)'s outer shell had the same color/shape bug as the DatePicker dropdown siblings, fixed to `SurfaceContainerHigh`/`CornerExtraLarge`
- `MFab`: elevation was wrong at every interaction state — resting `shadow-elevation-1` against real `ContainerElevation=Level3`, hover `shadow-elevation-2` against `HoveredContainerElevation=Level4` (required adding a new `--shadow-elevation-4` token to `theme.css`, the project's elevation scale previously stopped at Level3), and pressed dropped *below* resting instead of staying at `PressedContainerElevation=Level3`. `size="small"`'s icon was `20px` against real `24dp` and its shape was `16px` against `CornerMedium`(12dp); `size="large"`'s icon was `36px` against real `32dp`. The `items` speed-dial's mini-FAB buttons had the same elevation bug, fixed identically
- `MFabMenu`'s item rows had the same resting-elevation bug MFab had: `shadow-elevation-1` against real `FabMenuBaselineTokens.ListItemContainerElevation=Level3`
- `MLoadingIndicator`: the bare (non-contained) shape filled its whole container with no inset, against real `ActiveSize=38dp` vs `ContainerHeight/Width=48dp`; the `contained` variant kept the bare `ActiveIndicatorColor` tone instead of switching to `ContainedActiveColor` (`OnXContainer`, a different role meant to read against the colored circle behind it)
- `MSearchBar`: collapsed-bar elevation was `shadow-elevation-1` against real `ContainerElevation=Level3`; the expanded panel's divider was `outline-variant` against real `DividerColor=Outline`; the panel's back button inherited `MIconButton`'s default `on-surface-variant` tone against real `HeaderLeadingIconColor=OnSurface`; the collapsed bar had no keyboard-focus indicator at all against real `FocusIndicatorColor=Secondary` — added a `focus-within` ring matching the pattern already used elsewhere in the library
- `MProgressBar`'s wavy variant defaulted to `3px` thickness against real `ActiveThickness=4dp` (now unified with the linear variant's own default); the plain `linear` variant had no gap between the active bar and the track at all — real `TrackActiveSpace=4dp` is the modern M3 gapped-track design, already implemented on this component's `wavy` variant but missing here, now added (measured at exactly 4px in the DOM)
- `MCircleProgressBar` defaulted to a flat `80px` regardless of variant and `3px` thickness; real tokens are `Size=40dp`(circle)/`WaveSize=48dp`(wavy) and `ActiveThickness=4dp` for both — `size` is no longer a static default, it's now computed per variant when not explicitly passed
- `MOverlay`/`MSpotlightSearch` were the two components the earlier library-wide scrim sweep (see the `bg-scrim/32` entry above) explicitly skipped as "not spec-checked this round" — now brought in line with the same `ScrimTokens.ContainerOpacity = 0.32f`, matching every other scrim in the library
- `MCodeEditor`'s `placeholder` prop was declared but never wired to anything — CodeMirror's own `placeholder()` view extension now renders it when the document is empty
- `MChatBubble`'s `avatarSrc` prop was dead code — removed. It was never referenced in the component's template, and the `MAvatar` it renders internally has no image-src prop to route it to
- `JsonEditorLabels`/`JsonViewerLabels` (the label-override types for `MJsonEditor`/`MJsonViewer`) weren't re-exported from `index.ts`/`code-editor.ts`, breaking the library's own stated type-export convention — now exported alongside their components, matching every other component that defines a public prop type
- `MCodeEditor`'s line-number gutter didn't reach the full height of the editor — it only grew as tall as the visible line content, leaving a mismatched blank strip below it whenever the editor had more empty vertical space than lines of code (most visible with few lines, a tall `minHeight`, or a consumer stretching the whole component with `class="h-full"`). Root cause was two-fold: (1) CodeMirror's internal `.cm-editor`/`.cm-scroller`/`.cm-gutters` chain relies on `height: 100%`, which only resolves against a genuinely *definite* ancestor height — this component's own container only had a `min-height` (needed so it can still grow with content up to `maxHeight`), which CSS doesn't treat as definite for that purpose; (2) even once given a definite height, the gutter still didn't stretch because CodeMirror sets `align-items: flex-start !important` on `.cm-scroller` and an explicit (non-`auto`) `height: 100%` directly on `.cm-gutters` itself, both of which have to be fought individually since neither `align-items: stretch` alone nor a definite parent height is sufficient on its own. Fixed by making the component's root and its editor container real flex boxes (`flex: 1` growth instead of percentage heights) and forcing the gutter's stretch back on explicitly. The root element and its inner container now also participate properly in a `class="h-full"`-style stretch from a consumer (e.g. matching a taller sibling in a grid) instead of just sitting at `minHeight` regardless of how much space was actually available

## [0.7.1] - 2026-09-18

### Added
- New `--color-scrim` design token in `theme.css`. M3 defines `scrim` as a role distinct from `shadow`, even though both resolve to black in the baseline scheme — previously only `shadow` was exposed. 17 components that render a backdrop now use `bg-scrim` instead of a hardcoded `bg-black/40`/`bg-black/50`: `MDialog`, `MBottomSheet`, `MSideSheet`, `MNavigationDrawer`, `MOverlay`, `MFab`, `MTour`, `MCommandPalette`, `MSpotlightSearch`, `MColorPickerModal`, `MDatePickerModal`, `MDateRangePickerModal`, `MTimePickerModal`, `MSelect`, `MAutocomplete`, `MMultiSelect`, `MMultiAutocomplete`. `MLightbox`'s black backgrounds were left untouched — they're the viewer's own persistent chrome (fullscreen backdrop, control pills), not a scrim over other page content
- `MCheckbox`/`MSwitch` gained a `color` prop (`'primary' | 'secondary' | 'tertiary' | 'error'`, default `'primary'`), matching the prop `MRadio` already had — the checked/on-state fill, border, and check icon now follow it instead of being hardcoded to primary

### Fixed
- `MCheckbox`, `MRadio`, `MSwitch` now have an invisible 48×48px hit area centered on their visual control (18px/20px/32px respectively, via negative-margin wrappers), matching M3's minimum touch target. Previously the visible control itself was the only clickable/hoverable area, well under the minimum
- Disabled state on `MButton`, `MIconButton`, `MChip`, `MCheckbox` no longer applies a single blanket `opacity-[0.38]` to the whole element, which just rendered each variant's own color as translucent (a disabled filled-primary button still read as visibly blue). Now matches M3's actual token split: content (label/icon) at on-surface 38% opacity, container (background for filled/tonal/elevated, border for outlined) at on-surface 12%
- `MCard`'s `clickable` state now shows an M3 state-layer overlay (8% hover / 12% pressed, over `on-surface`) in addition to the elevation change it already had, matching the pattern already used by `MButton`/`MIconButton`/`MFab`/`MListItem`/`MChip`
- `MFab`'s extended (icon+label) layout used symmetric 16px padding on both sides; now matches the real `ExtendedFloatingActionButton` composable exactly — 16dp leading / 12dp icon-to-label gap (already correct) / 20dp trailing — plus the missing 80dp minimum width (`ExtendedFabMinimumWidth`)
- `MSlider`'s inactive track and stop-indicator color no longer derives from the active/`color` prop's own container tone (e.g. `color="tertiary"` tinting the unfilled track tertiary-container). M3's `SliderTokens` fix `InactiveTrackColor`/`StopIndicatorColor` to `secondary-container` regardless of the active color
- `MSlider`'s disabled state is no longer a single blanket opacity — active track/handle at on-surface 38%, inactive track at on-surface 12%, matching `SliderTokens.DisabledActiveTrackOpacity`/`DisabledInactiveTrackOpacity`
- `MSlider` had no visible focus indicator at all when tabbed to via keyboard (`outline-none` with nothing in its place). It now narrows the handle to 2dp on focus — the same treatment it already had for an active pointer drag, matching `SliderTokens.FocusHandleWidth`/`PressedHandleWidth` — plus a visible ring around the handle for keyboard navigation
- `MSlider`'s default (`xs`) size corrected against `SliderTokens`/`Slider.kt`: handle height 32px → 44dp (`HandleHeight`), the pressed/focused narrow ratio ×0.6 → the exact ×0.5 (`PressedHandleWidth`/`FocusHandleWidth` = 2dp), thumb-to-track gap 7px → 6dp (`ActiveHandleLeadingSpace`). The touch-target height (`hitArea`) was bumped from 38 to 46px as a consequence, so the now-taller handle stays contained instead of overflowing it

## [0.7.0] - 2026-09-17

### Fixed
- `MTabs` `primary`/`secondary` indicator animation ported from `androidx.compose.material3.TabRow`'s `TabIndicatorOffsetNode`: the offset and width are now two independent spring simulations (dampingRatio 0.9, stiffness 700, M3's `DefaultSpatial` motion token) driven by a real per-frame rAF physics step, not a hand-choreographed CSS "expand-to-union-box, hold 150ms, then snap" — the natural "stretch" look comes from the two springs covering different distances under identical physics, not from manual bounding-box math, and switching tabs again mid-animation now carries velocity over smoothly instead of restarting
- `MTabs`' separate `tabs`-prop watcher (for reacting to the tab list itself changing) was re-snapping the indicator with no animation on every change, including a plain reference swap with identical content — which raced with, and could silently cancel, an in-flight `modelValue`-triggered animation (most visibly if a consumer passes an inline `:tabs="[...]"` array literal, recreated on every unrelated re-render). It now animates too, which is a no-op when the target hasn't actually moved

### Added
- New component: `MLoadingIndicator` — M3 Expressive loading indicator that continuously morphs through a cycle of rounded shapes (soft burst, cookie, pentagon, pill, sunny, cookie, oval) while rotating. Timing/physics mirror `androidx.compose.material3.LoadingIndicator`: an underdamped spring (dampingRatio 0.6, stiffness 200, ~650ms per shape) drives both the morph and a synced +90° rotation swing on top of a slow constant spin, so the turn visually carries the shape change instead of the two reading as separate animations
- `MLoadingIndicator` `contained` prop wraps the active shape in a filled container circle (M3's "contained" variant)
- `MLoadingIndicator` `size` (default `48`) and `color` (`'primary' | 'secondary' | 'tertiary' | 'error'`, default `'primary'`) props, matching the conventions of `MProgressBar`/`MCircleProgressBar`
- New component (beta): `MPullToRefresh` — wraps its own scrollable container and lets the user drag down from the top (mouse or touch, via Pointer Events) past a `threshold` to trigger a refresh; shows an `MLoadingIndicator` (contained variant) that scales/fades in with the pull and settles in place, inside the container with a gap from its edge, while `refreshing` is true. Controlled the same way as `MInfiniteScroll`'s `loading`/`load`: a `refreshing` prop the caller flips on in its `@refresh` handler and back off once the fetch resolves. Mainly relevant for a scroll container that isn't the page/window itself (the browser's native pull-to-refresh never fires inside a nested `overflow-y: auto` element) or for app shells (Capacitor/Electron/installed PWAs) where the OS/browser gesture may not fire at all. **Beta**: reliable on desktop and in Capacitor/Electron-style shells; in an actual mobile browser tab the touch drag can occasionally lose the race against the browser's own scroll/overscroll gesture recognition and release early — a known hard problem with drag-based pull-to-refresh on the open mobile web
- New component: `MFabMenu` — the M3 "FAB Menu": a thin wrapper around `MFab`'s `#content` slot rather than a separate implementation, so opening/closing, the trigger icon's 45° morph, outside-click/scroll-away closing, and `persistent` are all inherited from `MFab` for free. Renders each `items` entry as a full icon+label pill (distinct from `MFab`'s existing `items`-driven speed dial, which uses small circular buttons). The reveal animation is ported from `androidx.compose.material3.FloatingActionButtonMenuItem`: each row wipes in via `clip-path` from the FAB's side (approximating its width-growth spring, dampingRatio 0.6/stiffness 800) while fading in faster and without bounce (approximating its dampingRatio 1.0/stiffness 3800 alpha spring), staggered starting from the item closest to the FAB. Rows are rendered through a `<TransitionGroup>` so closing also animates (a simultaneous fade for all rows, rather than a reverse stagger) instead of just vanishing
- `MFabMenu` `color` prop applies the same role/container pairing to every item row (`bg-{color}-container text-on-{color}-container`, matching `androidx.compose.material3.FloatingActionButtonMenuItem`'s default `primaryContainer` tone) in addition to the trigger FAB, instead of a fixed neutral surface color; a `FabMenuItem`'s own `color` overrides the menu's for just that row (e.g. calling out a destructive action)
- `MFabMenu` `label` prop shows the trigger as an extended FAB (icon + text) instead of icon-only, same as `MFab`'s own `label`
- `MFabMenu` `itemSize` prop (`'small' | 'regular' | 'large'`, default `'large'`) scales the menu item rows' padding/icon/text — independent from the trigger FAB's own `size`, so e.g. a small trigger can open into larger, easier-to-tap rows. Defaults to `'large'` to match the real `FabMenuBaselineTokens`: 56dp row height, 24dp icon, `titleMedium` text
- `MFabMenu` `scrim` prop (default `true`) dims the rest of the screen while open; set to `false` for a lighter inline reveal with no dimming
- `MFab` gained an `align` prop (`'start' | 'end'`, default `'start'`) for its `up`/`down` `#content` panel positioning — `'end'` anchors the panel's right edge to the FAB's right edge instead of the left edges, which keeps a panel wider than the FAB (like `MFabMenu`'s item list) from running off-screen when the FAB sits in a bottom-right corner, a common placement
- `MFab` gained a `scrim` prop (default `false`) — renders as a plain sibling of the `#content` panel with its own independent opacity fade, not nested inside the panel's own enter/leave transition (which would otherwise visually shrink/lag it along with the panel's transform). `MFabMenu` uses this internally instead of rendering its own scrim
- `MFab` gained a `contentTransition` prop (`'scale' | 'fade' | 'none'`, default `'scale'`, matching prior behavior) controlling how the `#content` panel itself animates open/closed — `'fade'` drops the scale for content that already animates its own entrance (like `MFabMenu`'s rows), while still giving Vue a real transition duration to wait on before removing the panel from the DOM, so the content's own close animation has time to play instead of being cut off. `MFabMenu` uses `'fade'`
- New component: `MSearchBar` — the M3 search bar. Collapses to a 56dp pill (matching `SearchBarTokens`); expanding grows it into either a `'docked'` panel anchored below the bar (28dp corners, matching `SearchViewTokens.DockedContainerShape`, click-outside/scroll-away/Escape to collapse — same Teleport + positioning convention as `MAutocomplete`'s dropdown) or a `'fullscreen'` overlay with a 72dp header and a back button (matching `SearchViewTokens.FullScreenContainerShape`/`FullScreenHeaderContainerHeight`). It's a plain standalone component with no special host awareness needed — drop it in `MTopAppBar`'s `#title` slot for the common "search bar embedded in the app bar" layout
- `MSearchBar` `modelValue` (v-model), `expanded` (v-model:expanded, also works uncontrolled), `variant`, `leadingIcon`, `loading`, `clearable`, `disabled` props; `#leading`/`#trailing` slots and a default slot for results/suggestions content; emits `search` on Enter
- `MSearchBar` `iconPosition` (`'start' | 'end'`, default `'start'`) moves the leading icon to the end of the collapsed bar — the expanded panel's back button always stays at the start regardless, matching the near-universal "go back" convention
- `MSearchBar` `textAlign` (`'start' | 'center'`, default `'start'`) centers the input/placeholder text (an iOS-style look) instead of the M3-standard start alignment

### Fixed
- `MTopAppBar`'s navigation icon button had a hardcoded Spanish aria-label (`"Navegación"`) regardless of the active locale — now uses a new `menu` locale key (translated across all seven shipped locales), overridable via a new `navigationLabel` prop for when `navigationIcon` is a back arrow rather than a drawer toggle
- `MTopAppBar` `medium`/`large` variants now use the exact M3 container heights (112dp/152dp total, i.e. 48px/88px added below the 64px top row) instead of an approximation that came out a bit short

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
