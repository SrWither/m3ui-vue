<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import MIcon from './MIcon.vue'

type Language = 'javascript' | 'typescript' | 'json' | 'html' | 'css' | 'python' | 'vue' | 'c' | 'cpp' | 'rust' | 'asm' | 'plain'

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
    wrap?: boolean
  }>(),
  {
    language: 'javascript',
    readonly: false,
    lineNumbers: true,
    theme: 'light',
    minHeight: '200px',
    maxHeight: '600px',
    wrap: true,
  },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const containerRef = ref<HTMLElement | null>(null)
let view: any = null
let cmModules: any = null
const copied = ref(false)

async function copyCode() {
  await navigator.clipboard.writeText(props.modelValue)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

const langLabel = computed(() => {
  const labels: Record<Language, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    python: 'Python',
    vue: 'Vue',
    c: 'C',
    cpp: 'C++',
    rust: 'Rust',
    asm: 'Assembly',
    plain: 'Texto',
  }
  return labels[props.language]
})

async function loadModules() {
  if (cmModules) return cmModules

  const [viewMod, stateMod, commandsMod, languageMod, highlightMod, oneDarkMod, jsMod, jsonMod, htmlMod, cssMod, pyMod, vueMod, cppMod, rustMod, asmMod] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/state'),
    import('@codemirror/commands'),
    import('@codemirror/language'),
    import('@lezer/highlight'),
    import('@codemirror/theme-one-dark'),
    import('@codemirror/lang-javascript'),
    import('@codemirror/lang-json'),
    import('@codemirror/lang-html'),
    import('@codemirror/lang-css'),
    import('@codemirror/lang-python'),
    import('@codemirror/lang-vue'),
    import('@codemirror/lang-cpp'),
    import('@codemirror/lang-rust'),
    import('@codemirror/legacy-modes/mode/gas'),
  ])

  cmModules = { viewMod, stateMod, commandsMod, languageMod, highlightMod, oneDarkMod, jsMod, jsonMod, htmlMod, cssMod, pyMod, vueMod, cppMod, rustMod, asmMod }
  return cmModules
}

function buildM3HighlightStyle(languageMod: any, tags: any) {
  return languageMod.HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--color-primary)' },
    { tag: tags.controlKeyword, color: 'var(--color-primary)', fontWeight: '500' },
    { tag: tags.operatorKeyword, color: 'var(--color-primary)' },
    { tag: tags.definitionKeyword, color: 'var(--color-primary)' },
    { tag: tags.moduleKeyword, color: 'var(--color-primary)' },

    { tag: tags.string, color: 'var(--color-tertiary)' },
    { tag: tags.regexp, color: 'var(--color-tertiary)' },

    { tag: tags.number, color: 'var(--color-error)' },
    { tag: tags.bool, color: 'var(--color-error)' },

    { tag: tags.function(tags.variableName), color: 'var(--color-secondary)' },
    { tag: tags.function(tags.definition(tags.variableName)), color: 'var(--color-secondary)', fontWeight: '500' },

    { tag: tags.typeName, color: 'var(--color-primary)', fontStyle: 'italic' },
    { tag: tags.className, color: 'var(--color-primary)', fontStyle: 'italic' },
    { tag: tags.namespace, color: 'var(--color-on-surface-variant)' },

    { tag: tags.propertyName, color: 'var(--color-on-surface)' },
    { tag: tags.definition(tags.propertyName), color: 'var(--color-on-surface)' },

    { tag: tags.variableName, color: 'var(--color-on-surface)' },
    { tag: tags.definition(tags.variableName), color: 'var(--color-on-surface)' },

    { tag: tags.comment, color: 'var(--color-outline)', fontStyle: 'italic' },
    { tag: tags.lineComment, color: 'var(--color-outline)', fontStyle: 'italic' },
    { tag: tags.blockComment, color: 'var(--color-outline)', fontStyle: 'italic' },

    { tag: tags.meta, color: 'var(--color-on-surface-variant)' },
    { tag: tags.tagName, color: 'var(--color-primary)' },
    { tag: tags.attributeName, color: 'var(--color-tertiary)' },
    { tag: tags.attributeValue, color: 'var(--color-secondary)' },

    { tag: tags.atom, color: 'var(--color-error)' },
    { tag: tags.null, color: 'var(--color-error)' },

    { tag: tags.punctuation, color: 'var(--color-on-surface-variant)' },
    { tag: tags.bracket, color: 'var(--color-on-surface-variant)' },
    { tag: tags.operator, color: 'var(--color-on-surface-variant)' },
    { tag: tags.separator, color: 'var(--color-on-surface-variant)' },
  ])
}

function getLangExtension(mods: any) {
  switch (props.language) {
    case 'javascript': return mods.jsMod.javascript()
    case 'typescript': return mods.jsMod.javascript({ typescript: true })
    case 'json': return mods.jsonMod.json()
    case 'html': return mods.htmlMod.html()
    case 'css': return mods.cssMod.css()
    case 'python': return mods.pyMod.python()
    case 'vue': return mods.vueMod.vue()
    case 'c': case 'cpp': return mods.cppMod.cpp()
    case 'rust': return mods.rustMod.rust()
    case 'asm': return mods.languageMod.StreamLanguage.define(mods.asmMod.gas)
    default: return []
  }
}

function buildExtensions(mods: any) {
  const { viewMod, stateMod, commandsMod, languageMod, highlightMod, oneDarkMod } = mods

  const m3Style = buildM3HighlightStyle(languageMod, highlightMod.tags)

  const exts = [
    viewMod.keymap.of([...commandsMod.defaultKeymap, ...commandsMod.historyKeymap, commandsMod.indentWithTab]),
    commandsMod.history(),
    languageMod.bracketMatching(),
    languageMod.indentOnInput(),
    languageMod.foldGutter(),
    viewMod.drawSelection(),
    viewMod.highlightActiveLine(),
    viewMod.highlightActiveLineGutter(),
    languageMod.syntaxHighlighting(m3Style),
    languageMod.syntaxHighlighting(languageMod.defaultHighlightStyle, { fallback: true }),
    getLangExtension(mods),
    viewMod.EditorView.updateListener.of((update: any) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
    stateMod.EditorState.readOnly.of(props.readonly),
  ]

  if (props.wrap) exts.push(viewMod.EditorView.lineWrapping)
  if (props.lineNumbers) exts.push(viewMod.lineNumbers())
  if (props.theme === 'dark') exts.push(oneDarkMod.oneDark)
  if (props.placeholder) exts.push(viewMod.placeholder(props.placeholder))

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

watch([() => props.language, () => props.theme, () => props.readonly, () => props.lineNumbers, () => props.wrap, () => props.placeholder], createEditor)

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-lg border border-outline-variant">
    <!-- Header bar -->
    <div class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-2">
      <span class="text-label-medium text-on-surface-variant">{{ langLabel }}</span>
      <div class="flex items-center gap-2">
        <slot name="actions" />
        <button
          type="button"
          class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-label-medium text-on-surface-variant transition-colors hover:bg-on-surface/8"
          :title="copied ? 'Copied!' : 'Copy code'"
          @click="copyCode"
        >
          <MIcon :name="copied ? 'check' : 'content_copy'" :size="16" :class="copied ? 'text-primary' : ''" />
          <span v-if="copied" class="text-primary">Copied</span>
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div
      ref="containerRef"
      class="code-editor-container overflow-auto bg-surface text-on-surface"
      :style="{ minHeight, maxHeight }"
    />
  </div>
</template>

<style scoped>
.code-editor-container {
  /* .cm-editor/.cm-scroller/.cm-gutters all use height:100%, which only ever
     resolves against a genuinely definite ancestor height — a min-height (what
     this container has, so it can grow with content up to maxHeight) doesn't
     count as definite for that percentage chain, so .cm-gutters silently fell
     back to sizing off its own content instead of the real editor height.
     Making this a flex column and letting .cm-editor grow via flex instead of
     a % height gives the whole chain a real definite size to resolve against. */
  display: flex;
  flex-direction: column;
  /* Also grow to fill the outer wrapper (see the root element's own flex-col
     above) rather than just sitting at minHeight, whenever a consumer stretches
     the whole component taller than that — e.g. `class="h-full"` in a grid
     cell next to taller content. Still hard-capped by maxHeight either way. */
  flex: 1 1 auto;
  min-height: 0;
}

.code-editor-container :deep(.cm-editor) {
  flex: 1;
  min-height: 0;
  font-family: 'Roboto Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
}

.code-editor-container :deep(.cm-editor.cm-focused) {
  outline: none;
}

.code-editor-container :deep(.cm-scroller) {
  /* .cm-scroller normally sizes itself off a height:100% against .cm-editor,
     but that's a percentage-height-in-nested-flex-column case that browsers
     don't reliably resolve — grow it directly instead so it has a real,
     laid-out height for .cm-gutters to stretch against below. */
  flex: 1 !important;
  min-height: 0;
  /* .cm-scroller lays out .cm-gutters/.cm-content in a row (gutter | content),
     so .cm-gutters' height comes from cross-axis stretch, not flex-grow —
     CodeMirror's own base theme sets align-items: flex-start !important here,
     which is exactly what stops the gutter from stretching to full height in
     the first place. */
  align-items: stretch !important;
}

.code-editor-container :deep(.cm-content) {
  padding: 12px 0;
}

.code-editor-container :deep(.cm-line) {
  padding: 0 16px;
}

.code-editor-container :deep(.cm-gutters) {
  background: var(--color-surface-container);
  border-right: 1px solid var(--color-outline-variant);
  color: var(--color-outline);
  font-size: 0.75rem;
  padding: 0 4px;
  /* .cm-gutters ships with an explicit height:100% rather than auto, so the
     align-items:stretch above (on .cm-scroller) never actually kicks in —
     stretch only applies to items whose cross-size computes to auto. Forcing
     height back to auto here is what makes that stretch take effect. */
  height: auto !important;
  align-self: stretch !important;
}

.code-editor-container :deep(.cm-activeLineGutter) {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface-variant);
}

.code-editor-container :deep(.cm-activeLine) {
  background: var(--color-surface-container-lowest);
}

.code-editor-container :deep(.cm-selectionBackground) {
  background: var(--color-primary-container) !important;
}

.code-editor-container :deep(.cm-cursor) {
  border-left-color: var(--color-primary);
  border-left-width: 2px;
}

.code-editor-container :deep(.cm-matchingBracket) {
  background: var(--color-tertiary-container);
  color: var(--color-on-tertiary-container);
  border-radius: 2px;
}

.code-editor-container :deep(.cm-foldGutter span) {
  color: var(--color-on-surface-variant);
}
</style>
