<script setup lang="ts">
/**
 * A drag-and-drop file upload zone with image previews, per-file size formatting, and progress/status display.
 * It only selects files: uploading them is up to you, and each entry's status and progress show how it's going.
 *
 * @slot dropzone Replaces the default icon + text content of the drop zone
 * @slot actions Right-aligned row below the list, shown only while it has files. Scope: { files: UploadFile[],
 *   clear: () => void }. Put your Upload / Clear buttons here
 * @event update:modelValue Emitted with the new list whenever files are added, removed or cleared (v-model)
 * @event select Emitted with the newly accepted files whenever files are added (drop or picker)
 * @event remove Emitted when a file is removed from the list with its remove button
 * @event blur Emitted when focus leaves the drop zone
 */
import { ref, computed, reactive, watch, onBeforeUnmount } from 'vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

export interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  preview?: string
}

const props = withDefaults(
  defineProps<{
    /** Accepted file types (e.g. ".png,.jpg", "image/*") */
    accept?: string
    /** Allow multiple files */
    multiple?: boolean
    /** Max file size in bytes — oversized files are silently filtered out */
    maxSize?: number
    /** Disables the upload area */
    disabled?: boolean
    /** Drop zone main text (defaults to the locale string) */
    dropText?: string
    /** Drop zone select link text (defaults to the locale string) */
    selectText?: string
    /** Prefix shown before the formatted max size (defaults to the locale string) */
    maxSizePrefix?: string
    /** Aria label for each file row's remove button (defaults to the locale string) */
    removeLabel?: string
    /** Optional v-model. Bind it to own the list: clear it, or update each entry's status/progress. Unbound, the component keeps the list itself. */
    modelValue?: UploadFile[]
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Inside an `MForm` or with `rules`, at least one file must be chosen */
    required?: boolean
    /** Validation rules on the file list (functions or a Standard Schema); `minLength`/`maxLength` count files. See `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving it (default), on change, or only on submit */
    validateOn?: ValidateOn
    /** The key of this field in its `MForm` */
    name?: string
  }>(),
  {
    multiple: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  select: [UploadFile[]]
  remove: [UploadFile]
  'update:modelValue': [UploadFile[]]
  blur: []
}>()

defineSlots<{
  dropzone?: () => unknown
  /** Shown below the list while it has files, e.g. an "Upload" button. */
  actions?: (props: { files: UploadFile[]; clear: () => void }) => unknown
}>()

// Controlled when v-model is bound, otherwise the component owns the list.
const internalFiles = ref<UploadFile[]>([])
const isControlled = computed(() => props.modelValue !== undefined)
const files = computed(() => (isControlled.value ? props.modelValue! : internalFiles.value))

function setFiles(next: UploadFile[]) {
  if (!isControlled.value) internalFiles.value = next
  emit('update:modelValue', next)
}

// Revoke preview URLs of entries that left the list, however they left it (row X,
// clear(), or the parent replacing/splicing its v-model array).
watch(
  () => files.value.slice(),
  (next, prev) => {
    const kept = new Set(next.map((f) => f.id))
    for (const f of prev) if (f.preview && !kept.has(f.id)) URL.revokeObjectURL(f.preview)
  },
)
onBeforeUnmount(() => {
  // A bound v-model may outlive this component and remount it with the same entries,
  // so only the component's own list is released here.
  if (!isControlled.value) for (const f of internalFiles.value) if (f.preview) URL.revokeObjectURL(f.preview)
})
const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const zoneEl = ref<HTMLElement | null>(null)

const validation = useFieldValidation({
  value: () => files.value,
  rules: () => props.rules,
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  disabled: () => props.disabled,
  focus: () => { zoneEl.value?.focus() },
  el: () => zoneEl.value,
  setValue: (v) => setFiles((v as UploadFile[] | undefined) ?? []),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation
const onFocusOut = useFocusLeave(() => zoneEl.value, () => {
  validation.onBlur()
  emit('blur')
})

const acceptList = computed(() =>
  props.accept ? props.accept.split(',').map((s) => s.trim()) : null,
)

function isAccepted(file: File) {
  if (!acceptList.value) return true
  return acceptList.value.some((a) => {
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a.toLowerCase())
    if (a.endsWith('/*')) return file.type.startsWith(a.replace('/*', '/'))
    return file.type === a
  })
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function processFiles(fileList: FileList | File[]) {
  const arr = Array.from(fileList)
  const valid = arr.filter((f) => {
    if (!isAccepted(f)) return false
    if (props.maxSize && f.size > props.maxSize) return false
    return true
  })

  // reactive() up front: the objects emitted in `select` are the exact ones rendered, so
  // setting `entry.status` / `entry.progress` from the parent updates the row. With plain
  // objects the list held Vue's reactive copies and those writes never reached the UI.
  const entries: UploadFile[] = valid.map((f) =>
    reactive<UploadFile>({
      file: f,
      id: crypto.randomUUID(),
      progress: 0,
      status: 'pending',
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }),
  )
  // A drop/pick where every file was rejected leaves the list alone (it used to wipe the
  // current file in single mode). `select` still fires with exactly what it always did.
  if (entries.length) setFiles(props.multiple ? [...files.value, ...entries] : entries.slice(0, 1))
  emit('select', entries)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (isDisabled.value || !e.dataTransfer?.files.length) return
  processFiles(e.dataTransfer.files)
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) processFiles(input.files)
  input.value = ''
}

function removeFile(entry: UploadFile) {
  setFiles(files.value.filter((f) => f.id !== entry.id))
  emit('remove', entry)
}

function clear() {
  if (files.value.length) setFiles([])
}

function openPicker() {
  if (!isDisabled.value) inputRef.value?.click()
}

defineExpose({
  clear,
  files,
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Drop zone -->
    <!-- A button for the keyboard too: Enter/Space open the picker, and a form can focus it on an error -->
    <div
      ref="zoneEl"
      role="button"
      :tabindex="isDisabled ? -1 : 0"
      :aria-disabled="isDisabled || undefined"
      :aria-invalid="hasError || undefined"
      :aria-describedby="errorMessage ? messageId : undefined"
      class="relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-secondary"
      :class="[
        isDisabled
          ? 'cursor-not-allowed border-outline-variant/50 bg-surface-container/30 opacity-60'
          : dragging
            ? 'border-primary bg-primary-container/20'
            : hasError
              ? 'border-error bg-surface-container-lowest hover:bg-surface-container'
              : 'border-outline-variant bg-surface-container-lowest hover:border-primary/60 hover:bg-surface-container',
      ]"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
      @focusout="onFocusOut"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <MIcon
        :name="dragging ? 'downloading' : 'cloud_upload'"
        :size="40"
        class="text-on-surface-variant"
      />
      <div class="text-center">
        <slot name="dropzone">
          <p class="text-body-large text-on-surface">
            {{ dropText ?? locale.dropText }} <span class="font-medium text-primary">{{ selectText ?? locale.selectText }}</span>
          </p>
          <p v-if="accept || maxSize" class="mt-1 text-body-small text-on-surface-variant">
            <span v-if="accept">{{ accept }}</span>
            <span v-if="accept && maxSize"> · </span>
            <span v-if="maxSize">{{ maxSizePrefix ?? locale.maxSizePrefix }} {{ formatSize(maxSize) }}</span>
          </p>
        </slot>
      </div>
    </div>

    <input
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="isDisabled"
      :name="name"
      @change="onFileInput"
    />

    <p v-if="errorMessage" :id="messageId" role="alert" class="-mt-1 px-1 text-body-small text-error">{{ errorMessage }}</p>

    <!-- File list -->
    <TransitionGroup
      name="m3-file"
      tag="div"
      class="flex flex-col gap-2"
    >
      <div
        v-for="entry in files"
        :key="entry.id"
        class="flex items-center gap-3 rounded-lg bg-surface-container p-3"
      >
        <!-- Preview / icon -->
        <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container-high">
          <img v-if="entry.preview" :src="entry.preview" class="h-full w-full object-cover" />
          <MIcon v-else name="description" :size="24" class="text-on-surface-variant" />
        </div>

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-body-medium text-on-surface">{{ entry.file.name }}</p>
          <p class="text-body-small text-on-surface-variant">{{ formatSize(entry.file.size) }}</p>
          <!-- Progress bar -->
          <div
            v-if="entry.status === 'uploading'"
            class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest"
          >
            <div
              class="h-full rounded-full bg-primary transition-[width] duration-300"
              :style="{ width: `${entry.progress}%` }"
            />
          </div>
        </div>

        <!-- Status -->
        <MSpinner v-if="entry.status === 'uploading'" :size="20" />
        <MIcon v-else-if="entry.status === 'done'" name="check_circle" :size="20" class="text-success" />
        <MIcon v-else-if="entry.status === 'error'" name="error" :size="20" class="text-error" />

        <MIconButton icon="close" :label="removeLabel ?? locale.remove" :size="32" @click="removeFile(entry)" />
      </div>
    </TransitionGroup>

    <div v-if="$slots.actions && files.length" class="flex flex-wrap items-center justify-end gap-2">
      <slot name="actions" :files="files" :clear="clear" />
    </div>
  </div>
</template>

<style scoped>
.m3-file-enter-active,
.m3-file-leave-active {
  transition: all 0.2s ease;
}
.m3-file-enter-from,
.m3-file-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
