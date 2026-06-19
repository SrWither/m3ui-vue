<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, shallowRef, computed } from 'vue'
import MIcon from './MIcon.vue'
import MMenu from './MMenu.vue'
import MMenuItem from './MMenuItem.vue'
import MDialog from './MDialog.vue'
import MTextField from './MTextField.vue'
import MButton from './MButton.vue'

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

const ready = ref(false)
const editorRef = shallowRef<any>(null)
const editorContainer = ref<HTMLElement | null>(null)

interface ToolBtn {
  icon: string
  label: string
  action: () => void
  active?: () => boolean
}

const toolGroups = ref<ToolBtn[][]>([])

onMounted(async () => {
  const [
    { Editor },
    { default: StarterKit },
    { default: Underline },
    { default: TextAlign },
    { default: Link },
    { default: Image },
    { default: Highlight },
    { default: Placeholder },
    { TextStyle },
    { default: Color },
  ] = await Promise.all([
    import('@tiptap/vue-3'),
    import('@tiptap/starter-kit'),
    import('@tiptap/extension-underline'),
    import('@tiptap/extension-text-align'),
    import('@tiptap/extension-link'),
    import('@tiptap/extension-image'),
    import('@tiptap/extension-highlight'),
    import('@tiptap/extension-placeholder'),
    import('@tiptap/extension-text-style'),
    import('@tiptap/extension-color'),
  ])

  const editor = new Editor({
    element: editorContainer.value!,
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

  editorRef.value = editor

  toolGroups.value = [
    [
      { icon: 'format_bold', label: 'Negrita', action: () => editor.chain().focus().toggleBold().run(), active: () => !!editor.isActive('bold') },
      { icon: 'format_italic', label: 'Cursiva', action: () => editor.chain().focus().toggleItalic().run(), active: () => !!editor.isActive('italic') },
      { icon: 'format_underlined', label: 'Subrayado', action: () => editor.chain().focus().toggleUnderline().run(), active: () => !!editor.isActive('underline') },
      { icon: 'format_strikethrough', label: 'Tachado', action: () => editor.chain().focus().toggleStrike().run(), active: () => !!editor.isActive('strike') },
      { icon: 'ink_highlighter', label: 'Resaltar', action: () => editor.chain().focus().toggleHighlight().run(), active: () => !!editor.isActive('highlight') },
    ],
    [
      { icon: 'format_list_bulleted', label: 'Lista', action: () => editor.chain().focus().toggleBulletList().run(), active: () => !!editor.isActive('bulletList') },
      { icon: 'format_list_numbered', label: 'Lista numerada', action: () => editor.chain().focus().toggleOrderedList().run(), active: () => !!editor.isActive('orderedList') },
      { icon: 'format_quote', label: 'Cita', action: () => editor.chain().focus().toggleBlockquote().run(), active: () => !!editor.isActive('blockquote') },
      { icon: 'code', label: 'Código', action: () => editor.chain().focus().toggleCode().run(), active: () => !!editor.isActive('code') },
    ],
    [
      { icon: 'format_align_left', label: 'Izquierda', action: () => editor.chain().focus().setTextAlign('left').run(), active: () => !!editor.isActive({ textAlign: 'left' }) },
      { icon: 'format_align_center', label: 'Centro', action: () => editor.chain().focus().setTextAlign('center').run(), active: () => !!editor.isActive({ textAlign: 'center' }) },
      { icon: 'format_align_right', label: 'Derecha', action: () => editor.chain().focus().setTextAlign('right').run(), active: () => !!editor.isActive({ textAlign: 'right' }) },
    ],
    [
      { icon: 'undo', label: 'Deshacer', action: () => editor.chain().focus().undo().run() },
      { icon: 'redo', label: 'Rehacer', action: () => editor.chain().focus().redo().run() },
    ],
  ]

  onBeforeUnmount(() => editor.destroy())

  watch(() => props.modelValue, (val) => {
    if (editor.getHTML() !== val) editor.commands.setContent(val)
  })

  watch(() => props.disabled, (v) => editor.setEditable(!v))

  ready.value = true
})

const linkDialogOpen = ref(false)
const linkUrl = ref('')
const imageDialogOpen = ref(false)
const imageUrl = ref('')

const headingLabel = computed(() => {
  const e = editorRef.value
  if (!e) return 'Párrafo'
  if (e.isActive('heading', { level: 1 })) return 'Título 1'
  if (e.isActive('heading', { level: 2 })) return 'Título 2'
  if (e.isActive('heading', { level: 3 })) return 'Título 3'
  return 'Párrafo'
})

function setHeading(level: 0 | 1 | 2 | 3) {
  if (level === 0) editorRef.value?.chain().focus().setParagraph().run()
  else editorRef.value?.chain().focus().toggleHeading({ level }).run()
}

function openLinkDialog() {
  linkUrl.value = ''
  linkDialogOpen.value = true
}

function confirmLink() {
  if (linkUrl.value) editorRef.value?.chain().focus().setLink({ href: linkUrl.value }).run()
  linkDialogOpen.value = false
}

function openImageDialog() {
  imageUrl.value = ''
  imageDialogOpen.value = true
}

function confirmImage() {
  if (imageUrl.value) editorRef.value?.chain().focus().setImage({ src: imageUrl.value }).run()
  imageDialogOpen.value = false
}
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border transition-colors duration-150"
    :class="disabled ? 'border-outline-variant/50 opacity-60' : 'border-outline-variant focus-within:border-primary'"
  >
    <!-- Toolbar -->
    <div v-if="ready" class="flex flex-wrap items-center gap-0.5 border-b border-outline-variant bg-surface-container px-2 py-1.5">
      <!-- Heading menu -->
      <MMenu align="left">
        <template #trigger>
          <button
            type="button"
            class="flex h-8 cursor-pointer items-center gap-1 rounded px-2 text-label-large text-on-surface-variant hover:bg-on-surface/8"
          >
            {{ headingLabel }}
            <MIcon name="arrow_drop_down" :size="20" />
          </button>
        </template>
        <MMenuItem @click="setHeading(0)">Párrafo</MMenuItem>
        <MMenuItem @click="setHeading(1)">Título 1</MMenuItem>
        <MMenuItem @click="setHeading(2)">Título 2</MMenuItem>
        <MMenuItem @click="setHeading(3)">Título 3</MMenuItem>
      </MMenu>

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
        @click="openLinkDialog"
      >
        <MIcon name="link" :size="20" />
      </button>
      <button
        type="button"
        title="Imagen"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8"
        @click="openImageDialog"
      >
        <MIcon name="image" :size="20" />
      </button>
    </div>

    <!-- Editor content -->
    <div
      ref="editorContainer"
      class="rte-content bg-surface px-4 py-3 text-body-large text-on-surface"
      :style="{ minHeight: minHeight }"
    />

    <!-- Link dialog -->
    <MDialog v-model="linkDialogOpen" title="Insertar enlace">
      <MTextField v-model="linkUrl" label="URL" placeholder=" " @keydown.enter="confirmLink" />
      <template #actions>
        <MButton variant="text" @click="linkDialogOpen = false">Cancelar</MButton>
        <MButton @click="confirmLink">Insertar</MButton>
      </template>
    </MDialog>

    <!-- Image dialog -->
    <MDialog v-model="imageDialogOpen" title="Insertar imagen">
      <MTextField v-model="imageUrl" label="URL de la imagen" placeholder=" " @keydown.enter="confirmImage" />
      <template #actions>
        <MButton variant="text" @click="imageDialogOpen = false">Cancelar</MButton>
        <MButton @click="confirmImage">Insertar</MButton>
      </template>
    </MDialog>
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
.rte-content :deep(ul) { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
.rte-content :deep(ol) { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
.rte-content :deep(blockquote) { border-left: 3px solid var(--color-primary); padding-left: 1em; margin: 0.5em 0; color: var(--color-on-surface-variant); }
.rte-content :deep(code) { background: var(--color-surface-container-highest); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; }
.rte-content :deep(pre) { background: var(--color-surface-container-highest); padding: 1em; border-radius: 8px; overflow-x: auto; margin: 0.5em 0; }
.rte-content :deep(pre code) { background: none; padding: 0; }
.rte-content :deep(a) { color: var(--color-primary); text-decoration: underline; }
.rte-content :deep(mark) { background: var(--color-tertiary-container); color: var(--color-on-tertiary-container); padding: 0.1em 0.2em; border-radius: 2px; }
.rte-content :deep(img) { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
</style>
