<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'

type Language = 'javascript' | 'typescript' | 'json' | 'html' | 'css' | 'python' | 'plain'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: Language
    readonly?: boolean
    lineNumbers?: boolean
    theme?: 'light' | 'dark'
    minHeight?: string
    maxHeight?: string
    placeholder?: string
  }>(),
  {
    language: 'javascript',
    readonly: false,
    lineNumbers: true,
    theme: 'light',
    minHeight: '200px',
    maxHeight: '600px',
  },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const containerRef = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const langLabel = computed(() => {
  const labels: Record<Language, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    python: 'Python',
    plain: 'Texto',
  }
  return labels[props.language]
})

function getLangExtension() {
  switch (props.language) {
    case 'javascript': return javascript()
    case 'typescript': return javascript({ typescript: true })
    case 'json': return json()
    case 'html': return html()
    case 'css': return css()
    case 'python': return python()
    default: return []
  }
}

function buildExtensions() {
  const exts = [
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    history(),
    bracketMatching(),
    indentOnInput(),
    foldGutter(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    getLangExtension(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
    EditorState.readOnly.of(props.readonly),
  ]

  if (props.lineNumbers) exts.push(lineNumbers())
  if (props.theme === 'dark') exts.push(oneDark)

  return exts
}

function createEditor() {
  if (!containerRef.value) return
  view?.destroy()

  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: buildExtensions(),
    }),
    parent: containerRef.value,
  })
}

onMounted(createEditor)

watch(() => props.modelValue, (val) => {
  if (view && view.state.doc.toString() !== val) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: val } })
  }
})

watch([() => props.language, () => props.theme, () => props.readonly, () => props.lineNumbers], createEditor)

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-outline-variant">
    <!-- Header bar -->
    <div class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-2">
      <span class="text-label-medium text-on-surface-variant">{{ langLabel }}</span>
      <slot name="actions" />
    </div>

    <!-- Editor -->
    <div
      ref="containerRef"
      class="code-editor-container overflow-auto bg-surface"
      :style="{ minHeight, maxHeight }"
    />
  </div>
</template>

<style scoped>
.code-editor-container :deep(.cm-editor) {
  height: 100%;
  min-height: inherit;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.875rem;
}

.code-editor-container :deep(.cm-editor.cm-focused) {
  outline: none;
}

.code-editor-container :deep(.cm-scroller) {
  min-height: inherit;
}

.code-editor-container :deep(.cm-gutters) {
  background: var(--color-surface-container);
  border-right: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.code-editor-container :deep(.cm-activeLineGutter) {
  background: var(--color-surface-container-high);
}

.code-editor-container :deep(.cm-activeLine) {
  background: var(--color-surface-container-lowest);
}

.code-editor-container :deep(.cm-selectionBackground) {
  background: var(--color-primary-container) !important;
}

.code-editor-container :deep(.cm-cursor) {
  border-left-color: var(--color-primary);
}

.code-editor-container :deep(.cm-matchingBracket) {
  background: var(--color-tertiary-container);
  color: var(--color-on-tertiary-container);
}

.code-editor-container :deep(.cm-foldGutter span) {
  color: var(--color-on-surface-variant);
}
</style>
