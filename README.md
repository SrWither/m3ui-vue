# @m3ui-vue/m3ui-vue

Material 3 component library for Vue 3 + Tailwind CSS v4.

80+ components following [Material Design 3](https://m3.material.io/) guidelines with 20 built-in color palettes, dark mode, and full TypeScript support.

## Install

```bash
pnpm add @m3ui/vue
```

Add the Google Fonts link to your `index.html`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
  rel="stylesheet"
/>
```

Import the theme CSS in your main stylesheet (after Tailwind):

```css
@import 'tailwindcss';
@import '@m3ui/vue/theme';
@import '@m3ui/vue/palettes'; /* optional — 20 color palettes */
```

Tell Tailwind to scan the library's source for class names:

```css
@source '../node_modules/@m3ui/vue';
```

## Usage

```vue
<script setup>
import { MButton, MCard, MTextField, useToast, useTheme } from '@m3ui/vue'

const toast = useToast()
</script>

<template>
  <MCard>
    <MTextField v-model="name" label="Nombre" />
    <MButton icon="save" @click="toast.success('Guardado')">
      Guardar
    </MButton>
  </MCard>
</template>
```

### Vue Plugin (optional)

```ts
import { createApp } from 'vue'
import { createM3UI } from '@m3ui/vue'

const app = createApp(App)
app.use(createM3UI({ palette: 'teal' }))
```

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
MContainer, MGrid, MStack, MSplitter, MMasonry, MDivider

### Advanced
MRichTextEditor, MCodeEditor, MJsonEditor, MKanban, MScheduler, MChart, MTerminal, MFileUpload, MTour, MCommandPalette, MSpotlightSearch, MHotkeys, MDragDropList, MTransferList, MInfiniteScroll

### Composables
`useTheme()`, `useColorPalette()`, `useToast()`, `useFieldBg()`

## Optional Dependencies

Some components require additional packages. Install only what you use:

| Component | Install |
|---|---|
| MRichTextEditor | `pnpm add @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-link @tiptap/extension-image @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight` |
| MCodeEditor, MJsonEditor | `pnpm add codemirror @codemirror/view @codemirror/state @codemirror/commands @codemirror/language @codemirror/lang-javascript @codemirror/lang-json @codemirror/lang-html @codemirror/lang-css @codemirror/lang-python @codemirror/theme-one-dark` |
| MTerminal | `pnpm add @xterm/xterm @xterm/addon-fit` |
| MMarkdown | `pnpm add markdown-it` |
| MChart | `pnpm add chart.js vue-chartjs` |

## License

MIT
