<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'

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
let view: any = null
let cmModules: any = null

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

async function loadModules() {
  if (cmModules) return cmModules

  const [viewMod, stateMod, commandsMod, languageMod, oneDarkMod, jsMod, jsonMod, htmlMod, cssMod, pyMod] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/state'),
    import('@codemirror/commands'),
    import('@codemirror/language'),
    import('@codemirror/theme-one-dark'),
    import('@codemirror/lang-javascript'),
    import('@codemirror/lang-json'),
    import('@codemirror/lang-html'),
    import('@codemirror/lang-css'),
    import('@codemirror/lang-python'),
  ])

  cmModules = { viewMod, stateMod, commandsMod, languageMod, oneDarkMod, jsMod, jsonMod, htmlMod, cssMod, pyMod }
  return cmModules
}

function getLangExtension(mods: any) {
  switch (props.language) {
    case 'javascript': return mods.jsMod.javascript()
    case 'typescript': return mods.jsMod.javascript({ typescript: true })
    case 'json': return mods.jsonMod.json()
    case 'html': return mods.htmlMod.html()
    case 'css': return mods.cssMod.css()
    case 'python': return mods.pyMod.python()
    default: return []
  }
}

function buildExtensions(mods: any) {
  const { viewMod, stateMod, commandsMod, languageMod, oneDarkMod } = mods

  const exts = [
    viewMod.keymap.of([...commandsMod.defaultKeymap, ...commandsMod.historyKeymap, commandsMod.indentWithTab]),
    commandsMod.history(),
    languageMod.bracketMatching(),
    languageMod.indentOnInput(),
    languageMod.foldGutter(),
    viewMod.highlightActiveLine(),
    viewMod.highlightActiveLineGutter(),
    languageMod.syntaxHighlighting(languageMod.defaultHighlightStyle, { fallback: true }),
    getLangExtension(mods),
    viewMod.EditorView.updateListener.of((update: any) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
    stateMod.EditorState.readOnly.of(props.readonly),
  ]

  if (props.lineNumbers) exts.push(viewMod.lineNumbers())
  if (props.theme === 'dark') exts.push(oneDarkMod.oneDark)

  return exts
}

async function createEditor() {
  if (!containerRef.value) return
  const mods = await loadModules()
  const { viewMod, stateMod } = mods

  view?.destroy()

  view = new viewMod.EditorView({
    state: stateMod.EditorState.create({
      doc: props.modelValue,
      extensions: buildExtensions(mods),
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
