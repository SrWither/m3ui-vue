# Changelog

All notable changes to `@m3ui-vue/m3ui-vue` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
