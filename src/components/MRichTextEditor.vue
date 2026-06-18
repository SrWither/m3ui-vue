<script setup lang="ts">
import { watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    disabled?: boolean
    minHeight?: string
  }>(),
  { placeholder: 'Escribe aquí...', disabled: false, minHeight: '200px' },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ openOnClick: false }),
    Image,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: props.placeholder }),
    TextStyle,
    Color,
  ],
  onUpdate: ({ editor: e }) => emit('update:modelValue', e.getHTML()),
})

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) editor.value.commands.setContent(val)
})

watch(() => props.disabled, (v) => editor.value?.setEditable(!v))

interface ToolBtn {
  icon: string
  label: string
  action: () => void
  active?: () => boolean
}

const toolGroups: ToolBtn[][] = [
  [
    { icon: 'format_bold', label: 'Negrita', action: () => editor.value?.chain().focus().toggleBold().run(), active: () => !!editor.value?.isActive('bold') },
    { icon: 'format_italic', label: 'Cursiva', action: () => editor.value?.chain().focus().toggleItalic().run(), active: () => !!editor.value?.isActive('italic') },
    { icon: 'format_underlined', label: 'Subrayado', action: () => editor.value?.chain().focus().toggleUnderline().run(), active: () => !!editor.value?.isActive('underline') },
    { icon: 'format_strikethrough', label: 'Tachado', action: () => editor.value?.chain().focus().toggleStrike().run(), active: () => !!editor.value?.isActive('strike') },
    { icon: 'ink_highlighter', label: 'Resaltar', action: () => editor.value?.chain().focus().toggleHighlight().run(), active: () => !!editor.value?.isActive('highlight') },
  ],
  [
    { icon: 'format_list_bulleted', label: 'Lista', action: () => editor.value?.chain().focus().toggleBulletList().run(), active: () => !!editor.value?.isActive('bulletList') },
    { icon: 'format_list_numbered', label: 'Lista numerada', action: () => editor.value?.chain().focus().toggleOrderedList().run(), active: () => !!editor.value?.isActive('orderedList') },
    { icon: 'format_quote', label: 'Cita', action: () => editor.value?.chain().focus().toggleBlockquote().run(), active: () => !!editor.value?.isActive('blockquote') },
    { icon: 'code', label: 'Código', action: () => editor.value?.chain().focus().toggleCode().run(), active: () => !!editor.value?.isActive('code') },
  ],
  [
    { icon: 'format_align_left', label: 'Izquierda', action: () => editor.value?.chain().focus().setTextAlign('left').run(), active: () => !!editor.value?.isActive({ textAlign: 'left' }) },
    { icon: 'format_align_center', label: 'Centro', action: () => editor.value?.chain().focus().setTextAlign('center').run(), active: () => !!editor.value?.isActive({ textAlign: 'center' }) },
    { icon: 'format_align_right', label: 'Derecha', action: () => editor.value?.chain().focus().setTextAlign('right').run(), active: () => !!editor.value?.isActive({ textAlign: 'right' }) },
  ],
  [
    { icon: 'undo', label: 'Deshacer', action: () => editor.value?.chain().focus().undo().run() },
    { icon: 'redo', label: 'Rehacer', action: () => editor.value?.chain().focus().redo().run() },
  ],
]

function insertLink() {
  const url = window.prompt('URL del enlace:')
  if (url) editor.value?.chain().focus().setLink({ href: url }).run()
}

function insertImage() {
  const url = window.prompt('URL de la imagen:')
  if (url) editor.value?.chain().focus().setImage({ src: url }).run()
}

function setHeading(level: 1 | 2 | 3) {
  editor.value?.chain().focus().toggleHeading({ level }).run()
}
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border transition-colors duration-150"
    :class="disabled ? 'border-outline-variant/50 opacity-60' : 'border-outline-variant focus-within:border-primary'"
  >
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-0.5 border-b border-outline-variant bg-surface-container px-2 py-1.5">
      <!-- Heading select -->
      <select
        class="h-8 cursor-pointer rounded bg-transparent px-2 text-label-large text-on-surface-variant outline-none hover:bg-on-surface/8"
        :value="
          editor?.isActive('heading', { level: 1 }) ? '1'
          : editor?.isActive('heading', { level: 2 }) ? '2'
          : editor?.isActive('heading', { level: 3 }) ? '3'
          : '0'
        "
        @change="(e: Event) => {
          const v = (e.target as HTMLSelectElement).value
          if (v === '0') editor?.chain().focus().setParagraph().run()
          else setHeading(Number(v) as 1 | 2 | 3)
        }"
      >
        <option value="0">Párrafo</option>
        <option value="1">Título 1</option>
        <option value="2">Título 2</option>
        <option value="3">Título 3</option>
      </select>

      <div class="mx-1 h-6 w-px bg-outline-variant" />

      <template v-for="(group, gi) in toolGroups" :key="gi">
        <button
          v-for="btn in group"
          :key="btn.icon"
          type="button"
          :title="btn.label"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors duration-100"
          :class="btn.active?.() ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-on-surface/8'"
          @click="btn.action"
        >
          <MIcon :name="btn.icon" :size="20" />
        </button>
        <div v-if="gi < toolGroups.length - 1" class="mx-1 h-6 w-px bg-outline-variant" />
      </template>

      <div class="mx-1 h-6 w-px bg-outline-variant" />

      <button
        type="button"
        title="Enlace"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8"
        @click="insertLink"
      >
        <MIcon name="link" :size="20" />
      </button>
      <button
        type="button"
        title="Imagen"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8"
        @click="insertImage"
      >
        <MIcon name="image" :size="20" />
      </button>
    </div>

    <!-- Editor content -->
    <EditorContent
      :editor="editor"
      class="rte-content bg-surface px-4 py-3 text-body-large text-on-surface"
      :style="{ minHeight: minHeight }"
    />
  </div>
</template>

<style scoped>
.rte-content :deep(.tiptap) {
  outline: none;
  min-height: inherit;
}

.rte-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--color-on-surface-variant);
  opacity: 0.5;
  pointer-events: none;
  height: 0;
}

.rte-content :deep(h1) { font-size: var(--text-headline-large); line-height: var(--text-headline-large--line-height); font-weight: 600; margin: 0.75em 0 0.25em; }
.rte-content :deep(h2) { font-size: var(--text-headline-medium); line-height: var(--text-headline-medium--line-height); font-weight: 600; margin: 0.75em 0 0.25em; }
.rte-content :deep(h3) { font-size: var(--text-headline-small); line-height: var(--text-headline-small--line-height); font-weight: 600; margin: 0.75em 0 0.25em; }
.rte-content :deep(p) { margin: 0.5em 0; }
.rte-content :deep(ul),
.rte-content :deep(ol) { padding-left: 1.5em; margin: 0.5em 0; }
.rte-content :deep(blockquote) { border-left: 3px solid var(--color-primary); padding-left: 1em; margin: 0.5em 0; color: var(--color-on-surface-variant); }
.rte-content :deep(code) { background: var(--color-surface-container-highest); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; }
.rte-content :deep(pre) { background: var(--color-surface-container-highest); padding: 1em; border-radius: 8px; overflow-x: auto; margin: 0.5em 0; }
.rte-content :deep(pre code) { background: none; padding: 0; }
.rte-content :deep(a) { color: var(--color-primary); text-decoration: underline; }
.rte-content :deep(mark) { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); padding: 0.1em 0.2em; border-radius: 2px; }
.rte-content :deep(img) { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
</style>
