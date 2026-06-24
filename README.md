<p align="center">
  <strong>M3UI Vue</strong>
</p>

<p align="center">
  Material Design 3 component library for Vue 3 + Tailwind CSS v4
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@m3ui-vue/m3ui-vue"><img src="https://img.shields.io/npm/v/@m3ui-vue/m3ui-vue?color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@m3ui-vue/m3ui-vue"><img src="https://img.shields.io/npm/l/@m3ui-vue/m3ui-vue" alt="license"></a>
  <img src="https://img.shields.io/badge/vue-3.5+-42b883" alt="vue 3.5+">
  <img src="https://img.shields.io/badge/tailwindcss-v4-38bdf8" alt="tailwind v4">
  <img src="https://img.shields.io/badge/typescript-strict-3178c6" alt="typescript">
</p>

---

120+ tree-shakeable components following [Material Design 3](https://m3.material.io/) guidelines. Ships with 20 color palettes, dark mode, i18n support, and full TypeScript coverage.

## Getting Started

### Install

```bash
pnpm add @m3ui-vue/m3ui-vue
```

### Fonts

Add to your `index.html` `<head>`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
  rel="stylesheet"
/>
```

### CSS

In your main stylesheet (e.g. `src/style.css`):

```css
@import 'tailwindcss';
@import '@m3ui-vue/m3ui-vue/theme';
@import '@m3ui-vue/m3ui-vue/palettes'; /* 20 color palettes */
@import '@m3ui-vue/m3ui-vue/styles';   /* component transitions & animations */
```

### Plugin (optional)

```ts
import { createApp } from 'vue'
import { createM3UI } from '@m3ui-vue/m3ui-vue'
import App from './App.vue'

const app = createApp(App)
app.use(createM3UI({ palette: 'teal' }))
app.mount('#app')
```

Without the plugin the default `purple` palette is used.

## Usage

```vue
<script setup>
import { MButton, MCard, MTextField, useToast } from '@m3ui-vue/m3ui-vue'

const toast = useToast()
const name = ref('')
</script>

<template>
  <MCard>
    <MTextField v-model="name" label="Name" />
    <MButton icon="save" @click="toast.success('Saved!')">
      Save
    </MButton>
  </MCard>
</template>
```

## Components

### Actions

| | |
|---|---|
| `MButton` | Primary, outlined, tonal, text, elevated variants |
| `MIconButton` | Icon-only actions |
| `MFab` | Floating action button with optional speed dial |
| `MButtonGroup` | Grouped button options |
| `MSplitButton` | Button with dropdown actions |
| `MSegmentedButton` | Toggleable segmented options |

### Inputs

| | |
|---|---|
| `MTextField` | Text input with label, icons, validation |
| `MNumberField` | Numeric input with stepper |
| `MMaskField` | Input with mask presets (phone, currency, etc.) |
| `MTagInput` | Tag/chip input |
| `MSelect` | Single select dropdown |
| `MMultiSelect` | Multi-select with chips |
| `MAutocomplete` | Single-value autocomplete |
| `MMultiAutocomplete` | Multi-value autocomplete |
| `MCheckbox` | Checkbox |
| `MSwitch` | Toggle switch |
| `MRadio` / `MRadioGroup` | Radio options |
| `MSlider` | Range slider |
| `MRating` | Star rating |
| `MDatePicker` | Inline date picker |
| `MDatePickerModal` | Modal date picker |
| `MDateRangePicker` | Inline date range picker |
| `MDateRangePickerModal` | Modal date range picker |
| `MTimePicker` | Inline time picker |
| `MTimePickerModal` | Modal time picker |
| `MColorPicker` | Inline color picker |
| `MColorPickerModal` | Modal color picker |
| `MFileUpload` | Drag & drop file upload |

### Data Display

| | |
|---|---|
| `MCard` / `MStatCard` | Content cards |
| `MChip` | Chips / tags |
| `MBadge` | Notification badges |
| `MAvatar` | User avatars |
| `MIcon` | Material Symbols icons |
| `MTable` | Simple table with sorting, pagination |
| `MDataTable` | Server-side data table |
| `MVirtualTable` | Virtualized table for large datasets |
| `MTreeTable` | Hierarchical table |
| `MTree` | Tree view |
| `MList` / `MListItem` / `MListSubheader` | Lists |
| `MTimeline` | Vertical timeline |
| `MCalendar` | Event calendar |
| `MCarousel` | Image/content carousel |
| `MJsonViewer` | JSON tree viewer |

### Feedback

| | |
|---|---|
| `MAlert` | Inline alerts |
| `MSnackbar` | Toast notifications (via `useToast`) |
| `MNotificationHost` | Rich notifications (via `useNotification`) |
| `MDialog` / `MConfirmDialog` | Modal dialogs |
| `MBottomSheet` | Bottom sheet |
| `MSideSheet` | Side sheet |
| `MProgressBar` | Linear progress |
| `MSpinner` | Circular spinner |
| `MLoadingOverlay` | Full-area loading |
| `MSkeleton` | Content skeleton loader |
| `MEmptyState` | Empty state placeholder |
| `MResult` | Success/error/info result pages |
| `MTooltip` | Tooltips |

### Navigation

| | |
|---|---|
| `MTabs` | Tab navigation |
| `MMenu` / `MMenuItem` | Dropdown menus |
| `MContextMenu` | Right-click context menu |
| `MBreadcrumbs` | Breadcrumb trail |
| `MStepper` | Step-by-step wizard |
| `MPagination` | Page navigation |
| `MNavigationBar` | Bottom navigation bar |
| `MNavigationRail` | Side navigation rail |
| `MNavigationDrawer` | Collapsible side drawer |
| `MTopAppBar` / `MAppBar` | Top app bar |
| `MToolbar` | Action toolbar |

### Layout

| | |
|---|---|
| `MContainer` | Centered max-width container |
| `MAppLayout` | Full app layout scaffold |
| `MGrid` | Responsive grid |
| `MStack` / `MFlex` / `MBox` | Flexbox utilities |
| `MCenter` | Center content |
| `MSpacer` | Flexible spacer |
| `MSplitter` | Resizable split panes |
| `MMasonry` | Masonry grid |
| `MDivider` | Horizontal/vertical divider |
| `MExpansionPanel` | Collapsible panel |
| `MSection` | Semantic section |
| `MScrollable` | Scrollable area |
| `MAbsolute` / `MRelative` / `MFixed` / `MSticky` | Positioning |
| `MFullscreen` | Fullscreen wrapper |
| `MAspectRatio` | Aspect ratio container |
| `MResponsive` | Responsive breakpoint slots |
| `MOverlay` | Overlay backdrop |
| `MWindow` | Window/panel container |
| `MFooter` | Page footer |

### Typography

| | |
|---|---|
| `MText` | Body text with variants |
| `MTitle` | Section title |
| `MSubtitle` | Section subtitle |

### Emoji

| | |
|---|---|
| `MEmoji` | Render emoji by shortcode |
| `MEmojiButton` | Emoji picker trigger |
| `MEmojiSelector` | Full emoji picker panel |

### Chat

| | |
|---|---|
| `MChatBubble` | Chat message bubble |

### Advanced

| | |
|---|---|
| `MKanban` | Kanban board |
| `MScheduler` | Week/day scheduler |
| `MCommandPalette` | Command palette (Cmd+K) |
| `MSpotlightSearch` | Spotlight-style search |
| `MHotkeys` | Keyboard shortcut handler |
| `MDragDropList` | Drag & drop sortable list |
| `MTransferList` | Dual-list transfer |
| `MInfiniteScroll` | Infinite scroll wrapper |
| `MTour` | Feature tour / onboarding |

### Separate Entry Points

These components have heavy peer dependencies and are imported from dedicated sub-paths:

```ts
import { MRichTextEditor } from '@m3ui-vue/m3ui-vue/rich-text-editor'
import { MCodeEditor, MJsonEditor } from '@m3ui-vue/m3ui-vue/code-editor'
import { MMarkdown } from '@m3ui-vue/m3ui-vue/markdown'
import { MTerminal } from '@m3ui-vue/m3ui-vue/terminal'
import { MChart } from '@m3ui-vue/m3ui-vue/chart'
```

## Composables

| | |
|---|---|
| `useTheme()` | Light / dark / system theme with `cycle()` |
| `useColorPalette()` | Switch between 20 palettes at runtime |
| `useToast()` | Programmatic toast notifications |
| `useNotification()` | Rich notifications with actions |
| `useFieldBg()` | Context-aware field background color |
| `useLocale()` | i18n locale switching |
| `useDevice()` | Responsive breakpoint detection |

## Color Palettes

20 built-in palettes with light and dark variants:

`purple` (default) `indigo` `navy` `blue` `cyan` `teal` `green` `lime` `olive` `amber` `sand` `orange` `deep-orange` `brown` `red` `coral` `crimson` `pink` `violet` `slate`

### Switch at Runtime

```vue
<script setup>
import { useColorPalette } from '@m3ui-vue/m3ui-vue'

const { palette, palettes, set } = useColorPalette()
</script>

<template>
  <select @change="set(($event.target as HTMLSelectElement).value)">
    <option v-for="p in palettes" :key="p.id" :value="p.id" :selected="p.id === palette">
      {{ p.label }}
    </option>
  </select>
</template>
```

Selection is persisted to `localStorage`.

## Dark Mode

```vue
<script setup>
import { useTheme } from '@m3ui-vue/m3ui-vue'

const { theme, cycle } = useTheme()
</script>

<template>
  <MButton @click="cycle">Theme: {{ theme }}</MButton>
</template>
```

Supports `light`, `dark`, and `system`. Persisted to `localStorage` and respects `prefers-color-scheme`.

## Peer Dependencies

Install only the packages you need:

| Component | Packages |
|---|---|
| `MRichTextEditor` | `@tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-link @tiptap/extension-image @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight` |
| `MCodeEditor` `MJsonEditor` | `codemirror @codemirror/view @codemirror/state @codemirror/commands @codemirror/language @codemirror/lang-javascript @codemirror/lang-json @codemirror/lang-html @codemirror/lang-css @codemirror/lang-python @codemirror/theme-one-dark` |
| `MTerminal` | `@xterm/xterm @xterm/addon-fit` |
| `MMarkdown` | `markdown-it` (+ optional `highlight.js` for syntax highlighting) |
| `MChart` | `chart.js vue-chartjs` |

## License

MIT
