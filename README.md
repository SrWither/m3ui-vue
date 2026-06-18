# M3UI Vue

Material 3 component library for Vue 3 + Tailwind CSS v4.

80+ components following [Material Design 3](https://m3.material.io/) guidelines with 20 built-in color palettes, dark mode, and full TypeScript support.

## Quick Start

### 1. Install

```bash
pnpm add @m3ui-vue/m3ui-vue
# or
npm install @m3ui-vue/m3ui-vue
```

### 2. Add Google Fonts

Add the following to your `index.html` `<head>`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
  rel="stylesheet"
/>
```

### 3. Configure CSS

In your main stylesheet (e.g. `src/style.css`):

```css
@import 'tailwindcss';
@import '@m3ui-vue/m3ui-vue/theme';
@import '@m3ui-vue/m3ui-vue/palettes'; /* optional — includes 20 color palettes */

/* Required: tells Tailwind to scan the library for class names */
@source '../node_modules/@m3ui-vue/m3ui-vue';
```

### 4. Register the Plugin (optional)

```ts
// main.ts
import { createApp } from 'vue'
import { createM3UI } from '@m3ui-vue/m3ui-vue'
import App from './App.vue'

const app = createApp(App)
app.use(createM3UI({ palette: 'teal' })) // sets initial palette
app.mount('#app')
```

The plugin is optional — without it the default purple palette is used.

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

## Color Palettes

M3UI ships with 20 pre-built color palettes, each with light and dark variants:

`purple` (default), `indigo`, `navy`, `blue`, `cyan`, `teal`, `green`, `lime`, `olive`, `amber`, `sand`, `orange`, `deep-orange`, `brown`, `red`, `coral`, `crimson`, `pink`, `violet`, `slate`

### Switching Palettes at Runtime

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

The selection is persisted to `localStorage` automatically.

## Dark Mode

```vue
<script setup>
import { useTheme } from '@m3ui-vue/m3ui-vue'

const { theme, cycle } = useTheme()
// theme: 'light' | 'dark' | 'system'
</script>

<template>
  <MButton @click="cycle">
    Theme: {{ theme }}
  </MButton>
</template>
```

The theme is persisted to `localStorage` and respects `prefers-color-scheme` when set to `system`.

## Components

### Inputs
MButton, MIconButton, MFab, MTextField, MSelect, MMultiSelect, MCheckbox, MSwitch, MRadio, MRadioGroup, MSlider, MRating, MDatePicker, MDateRangePicker, MTimePicker, MColorPicker

### Data Display
MCard, MChip, MBadge, MAvatar, MIcon, MTable, MDataTable, MVirtualTable, MTreeTable, MTree, MStatCard, MTimeline, MCalendar, MJsonViewer, MMarkdown

### Feedback
MAlert, MSnackbar (toast), MDialog, MConfirmDialog, MBottomSheet, MSideSheet, MProgressBar, MSpinner, MLoadingOverlay, MSkeleton, MEmptyState, MResult, MTooltip

### Navigation
MTabs, MMenu, MMenuItem, MContextMenu, MBreadcrumbs, MStepper, MPagination, MNavigationBar, MNavigationRail, MNavigationDrawer, MTopAppBar, MAppBar, MSegmentedButton

### Layout
MContainer, MGrid, MStack, MSplitter, MMasonry, MDivider, MExpansionPanel

### Advanced
MRichTextEditor, MCodeEditor, MJsonEditor, MKanban, MScheduler, MChart, MTerminal, MFileUpload, MTour, MCommandPalette, MSpotlightSearch, MHotkeys, MDragDropList, MTransferList, MInfiniteScroll

### Composables
- `useTheme()` — light/dark/system theme with `cycle()`
- `useColorPalette()` — switch between 20 palettes at runtime
- `useToast()` — programmatic toast notifications
- `useFieldBg()` — context-aware field background color

## Optional Dependencies

Some components require peer packages. Install only what you need:

| Component | Install |
|---|---|
| MRichTextEditor | `pnpm add @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-link @tiptap/extension-image @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight` |
| MCodeEditor, MJsonEditor | `pnpm add codemirror @codemirror/view @codemirror/state @codemirror/commands @codemirror/language @codemirror/lang-javascript @codemirror/lang-json @codemirror/lang-html @codemirror/lang-css @codemirror/lang-python @codemirror/theme-one-dark` |
| MTerminal | `pnpm add @xterm/xterm @xterm/addon-fit` |
| MMarkdown | `pnpm add markdown-it` |
| MChart | `pnpm add chart.js vue-chartjs` |

## License

MIT
