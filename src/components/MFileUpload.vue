<script setup lang="ts">
import { ref, computed } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'

export interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  preview?: string
}

const props = withDefaults(
  defineProps<{
    accept?: string
    multiple?: boolean
    maxSize?: number
    disabled?: boolean
  }>(),
  { multiple: false, disabled: false },
)

const emit = defineEmits<{
  select: [UploadFile[]]
  remove: [UploadFile]
}>()

const files = ref<UploadFile[]>([])
const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

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

  const entries: UploadFile[] = valid.map((f) => {
    const entry: UploadFile = {
      file: f,
      id: crypto.randomUUID(),
      progress: 0,
      status: 'pending',
    }
    if (f.type.startsWith('image/')) {
      entry.preview = URL.createObjectURL(f)
    }
    return entry
  })

  if (props.multiple) {
    files.value.push(...entries)
  } else {
    files.value.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
    files.value = entries.slice(0, 1)
  }

  emit('select', entries)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (props.disabled || !e.dataTransfer?.files.length) return
  processFiles(e.dataTransfer.files)
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) processFiles(input.files)
  input.value = ''
}

function removeFile(entry: UploadFile) {
  if (entry.preview) URL.revokeObjectURL(entry.preview)
  files.value = files.value.filter((f) => f.id !== entry.id)
  emit('remove', entry)
}

function openPicker() {
  if (!props.disabled) inputRef.value?.click()
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Drop zone -->
    <div
      class="relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors duration-150"
      :class="[
        disabled
          ? 'cursor-not-allowed border-outline-variant/50 bg-surface-container/30 opacity-60'
          : dragging
            ? 'border-primary bg-primary-container/20'
            : 'border-outline-variant bg-surface-container-lowest hover:border-primary/60 hover:bg-surface-container',
      ]"
      @click="openPicker"
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
        <p class="text-body-large text-on-surface">
          Arrastra archivos aquí o <span class="font-medium text-primary">selecciona</span>
        </p>
        <p v-if="accept || maxSize" class="mt-1 text-body-small text-on-surface-variant">
          <span v-if="accept">{{ accept }}</span>
          <span v-if="accept && maxSize"> · </span>
          <span v-if="maxSize">Máx. {{ formatSize(maxSize) }}</span>
        </p>
      </div>
    </div>

    <input
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onFileInput"
    />

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

        <MIconButton icon="close" label="Eliminar" :size="32" @click="removeFile(entry)" />
      </div>
    </TransitionGroup>
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
