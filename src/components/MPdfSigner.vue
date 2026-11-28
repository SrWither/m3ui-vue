<script setup lang="ts">
/**
 * Sign and fill a PDF: fields placed on its pages (signature, initials, name, date, text, checkbox) that the signer
 * fills in order, a signature drawn with a finger or mouse or typed, adopted once and reused for every signature
 * field, and `save()` to get the PDF with everything written into it. In `prepare` mode the sender places the
 * fields instead: add, drag, resize, mark required. Fields are plain JSON (`v-model:fields`, positions as fractions
 * of the page), so a backend can store them and send them to each signer (`signer` picks whose fields are active).
 * Built on MPdfViewer (zoom, search, thumbnails) and MSignaturePad. Writing the PDF needs `pdf-lib`. A visual
 * signature, as e-signature flows show and print; for a certificate-based digital signature (PAdES), sign the
 * saved file on your server. Available from the `/pdf` entry point. Not an M3 spec component.
 *
 * @event update:fields The fields changed (placed, moved, filled)
 * @event complete Every required field is filled (after the last one is)
 * @event finish The signer pressed Finish (every required field is filled): call `save()` here
 * @event loaded The document loaded (MPdfViewer's)
 */
import { computed, nextTick, ref, useId, watch } from 'vue'
import MPdfViewer from './MPdfViewer.vue'
import MSignaturePad from './MSignaturePad.vue'
import MDialog from './MDialog.vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSegmentedButton from './MSegmentedButton.vue'
import MTextField from './MTextField.vue'
import { fieldMissing, signPdf, type PdfSignField, type SignPdfOptions } from '../composables/pdfSign'
import type { PdfSource } from '../composables/usePdf'
import { useLocale, type M3Locale } from '../composables/useLocale'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The PDF: a URL, its bytes, or a `File`/`Blob` */
    src?: PdfSource | null
    /** The fields on its pages (v-model:fields) */
    fields?: PdfSignField[]
    /** `sign`: fill the fields. `prepare`: place them (add, move, resize, delete) */
    mode?: 'sign' | 'prepare'
    /** Whose turn it is: only fields with this `signer` (or none) can be filled; the rest show dimmed */
    signer?: string
    /** Fills name fields, and starts a typed signature with it */
    signerName?: string
    /** How date fields write today's date */
    dateFormat?: Intl.DateTimeFormatOptions
    /** The field types offered in prepare mode */
    types?: PdfSignField['type'][]
    /** The pdf.js worker URL (MPdfViewer's) */
    workerSrc?: string
  }>(),
  { src: null, fields: () => [], mode: 'sign', dateFormat: () => ({ dateStyle: 'medium' }), types: () => ['signature', 'initials', 'name', 'date', 'text', 'checkbox'] },
)

const emit = defineEmits<{
  'update:fields': [fields: PdfSignField[]]
  complete: []
  finish: []
  loaded: [doc: unknown]
}>()

const locale = useLocale()
const uid = useId()
const viewer = ref<InstanceType<typeof MPdfViewer>>()

const TYPE: Record<PdfSignField['type'], { icon: string; key: keyof M3Locale; w: number; h: number }> = {
  signature: { icon: 'signature', key: 'pdfSignSignature', w: 0.3, h: 0.06 },
  initials: { icon: 'draw', key: 'pdfSignInitials', w: 0.1, h: 0.05 },
  name: { icon: 'badge', key: 'pdfSignName', w: 0.3, h: 0.035 },
  date: { icon: 'calendar_today', key: 'pdfSignDate', w: 0.2, h: 0.035 },
  text: { icon: 'text_fields', key: 'pdfSignText', w: 0.3, h: 0.035 },
  checkbox: { icon: 'check_box', key: 'pdfSignCheckbox', w: 0.03, h: 0.022 },
}
const typeName = (t: PdfSignField['type']) => locale[TYPE[t].key] as string

const mine = (f: PdfSignField) => !props.signer || !f.signer || f.signer === props.signer
const byPage = computed(() => {
  const map = new Map<number, PdfSignField[]>()
  for (const f of props.fields) map.set(f.page, [...(map.get(f.page) ?? []), f])
  return map
})
const todo = computed(() => props.fields.filter((f) => mine(f) && (f.required ?? (f.type === 'signature' || f.type === 'initials'))))
const done = computed(() => todo.value.filter((f) => !fieldMissing(f)).length)
const complete = computed(() => done.value === todo.value.length)
watch(complete, (c, was) => { if (c && !was && props.mode === 'sign') emit('complete') })
const progress = computed(() => locale.pdfSignProgress.replace('{done}', String(done.value)).replace('{total}', String(todo.value.length)))

function patch(id: string, change: Partial<PdfSignField>) {
  emit('update:fields', props.fields.map((f) => (f.id === id ? { ...f, ...change } : f)))
}

// ── signing ──
/** The signature (and initials) adopted once, reused by every other such field */
const adopted = ref<{ signature?: string; initials?: string }>({})
const dialog = ref<{ field: PdfSignField; tab: 'draw' | 'type'; text: string } | null>(null)
const pad = ref<InstanceType<typeof MSignaturePad>>()
const padEmpty = ref(true)
// The pad's canvas has a fixed size: as wide as the dialog's body
const padBox = ref<HTMLElement>()
const padWidth = ref(400)
watch(() => dialog.value?.tab, () => nextTick(() => { if (padBox.value?.clientWidth) padWidth.value = padBox.value.clientWidth - 2 }))

function today() {
  return new Intl.DateTimeFormat(undefined, props.dateFormat).format(new Date())
}
function fill(f: PdfSignField, force = false) {
  if (props.mode !== 'sign' || !mine(f)) return
  if (f.type === 'checkbox') return patch(f.id, { value: f.value === 'true' ? undefined : 'true' })
  if (f.type === 'date' && !f.value) return patch(f.id, { value: today() })
  if (f.type === 'name' && !f.value && props.signerName) return patch(f.id, { value: props.signerName })
  if ((f.type === 'signature' || f.type === 'initials') && !force) {
    const saved = adopted.value[f.type]
    if (saved && !f.value) return patch(f.id, { value: saved })
  }
  const initial = f.type === 'initials' ? initialsOf(props.signerName ?? '') : props.signerName ?? ''
  dialog.value = {
    field: f,
    tab: f.type === 'signature' || f.type === 'initials' ? 'draw' : 'type',
    text: f.type === 'signature' || f.type === 'initials' ? initial : f.value ?? (f.type === 'name' ? initial : ''),
  }
  padEmpty.value = true
}
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('')

const SCRIPT_FONT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", "URW Chancery L", cursive'
/** A typed signature, drawn as an image in a handwriting font */
function typedSignature(text: string): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const size = 96
  ctx.font = `${size}px ${SCRIPT_FONT}`
  const w = Math.ceil(ctx.measureText(text).width) + 40
  canvas.width = w
  canvas.height = size * 1.6
  ctx.font = `${size}px ${SCRIPT_FONT}`
  ctx.fillStyle = '#1a237e'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 20, canvas.height / 2)
  return canvas.toDataURL('image/png')
}
const isSignature = computed(() => dialog.value?.field.type === 'signature' || dialog.value?.field.type === 'initials')
const canApply = computed(() => {
  const d = dialog.value
  if (!d) return false
  if (isSignature.value && d.tab === 'draw') return !padEmpty.value
  return d.text.trim() !== ''
})
async function apply() {
  const d = dialog.value
  if (!d || !canApply.value) return
  let value: string
  if (isSignature.value) {
    value = d.tab === 'draw' ? await cropped(pad.value?.toDataURL() ?? '') : typedSignature(d.text.trim())
    adopted.value = { ...adopted.value, [d.field.type]: value }
  } else value = d.text.trim()
  patch(d.field.id, { value })
  dialog.value = null
}
/** The drawn signature without the empty pad around it */
async function cropped(url: string): Promise<string> {
  if (!url || typeof document === 'undefined') return url
  const img = new Image()
  img.src = url
  try { await img.decode() } catch { return url }
  if (!img.width) return url
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  if (!ctx) return url
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let x1 = width, y1 = height, x2 = -1, y2 = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3]! > 8) { x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y) }
  }
  if (x2 < 0) return url
  const pad = 8
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad); x2 = Math.min(width - 1, x2 + pad); y2 = Math.min(height - 1, y2 + pad)
  const out = document.createElement('canvas')
  out.width = x2 - x1 + 1
  out.height = y2 - y1 + 1
  out.getContext('2d')?.drawImage(c, x1, y1, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

function next() {
  const list = todo.value
  const target = list.find((f) => fieldMissing(f)) ?? list[0]
  if (!target) return
  const el = document.getElementById(fieldId(target))
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.focus({ preventScroll: true })
}
const fieldId = (f: PdfSignField) => `${uid}-f-${f.id}`

// ── preparing ──
const selectedId = ref<string | null>(null)
let seq = 0
function addField(type: PdfSignField['type']) {
  const t = TYPE[type]
  const page = currentPage.value
  const id = `${type}-${Date.now().toString(36)}-${++seq}`
  const field: PdfSignField = { id, type, page, x: 0.5 - t.w / 2, y: 0.45, width: t.w, height: t.h, label: typeName(type) }
  if (type === 'signature' || type === 'initials') field.required = true
  emit('update:fields', [...props.fields, field])
  selectedId.value = id
}
function removeField(id: string) {
  emit('update:fields', props.fields.filter((f) => f.id !== id))
  if (selectedId.value === id) selectedId.value = null
}

/** Dragging a field (or its corner) in prepare mode: the change in fractions of its page */
let drag: { id: string; kind: 'move' | 'resize'; x: number; y: number; start: PdfSignField; w: number; h: number } | null = null
function onFieldDown(e: PointerEvent, f: PdfSignField, kind: 'move' | 'resize', page: { width: number; height: number }) {
  if (props.mode !== 'prepare' || e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  selectedId.value = f.id
  drag = { id: f.id, kind, x: e.clientX, y: e.clientY, start: { ...f }, w: page.width, h: page.height }
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onFieldMove(e: PointerEvent) {
  if (!drag) return
  const dx = (e.clientX - drag.x) / drag.w
  const dy = (e.clientY - drag.y) / drag.h
  const s = drag.start
  if (drag.kind === 'move') {
    patch(drag.id, { x: clamp(s.x + dx, 0, 1 - s.width), y: clamp(s.y + dy, 0, 1 - s.height) })
  } else {
    patch(drag.id, { width: clamp(s.width + dx, 0.02, 1 - s.x), height: clamp(s.height + dy, 0.015, 1 - s.y) })
  }
}
function onFieldUp() { drag = null }
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b)

function onFieldKey(e: KeyboardEvent, f: PdfSignField) {
  if (props.mode === 'sign') {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fill(f) }
    return
  }
  const step = e.shiftKey ? 0.02 : 0.005
  const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  if (moves[e.key]) {
    e.preventDefault()
    const [dx, dy] = moves[e.key]!
    patch(f.id, { x: clamp(f.x + dx, 0, 1 - f.width), y: clamp(f.y + dy, 0, 1 - f.height) })
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    removeField(f.id)
  }
}

const currentPage = ref(1)

/** The overlay of a page shown rotated by the viewer: laid out on the page as it is, then turned with it */
function frameStyle(slot: { width: number; height: number; rotation: number }) {
  const r = slot.rotation
  const swap = r % 180 !== 0
  const w = swap ? slot.height : slot.width
  const h = swap ? slot.width : slot.height
  const t = r === 90 ? 'rotate(90deg) translateY(-100%)' : r === 180 ? 'rotate(180deg) translate(-100%, -100%)' : r === 270 ? 'rotate(270deg) translateX(-100%)' : undefined
  return { width: `${w}px`, height: `${h}px`, transform: t, transformOrigin: 'top left' }
}
const fieldStyle = (f: PdfSignField) => ({ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` })

// ── saving ──
async function sourceBytes(src: PdfSource): Promise<ArrayBuffer | Uint8Array> {
  if (src instanceof Uint8Array || src instanceof ArrayBuffer) return src
  if (typeof Blob !== 'undefined' && src instanceof Blob) return src.arrayBuffer()
  const res = await fetch(String(src))
  if (!res.ok) throw new Error(`PDF ${res.status}`)
  return res.arrayBuffer()
}
/** The PDF with the filled fields written into it */
async function save(options?: SignPdfOptions): Promise<Uint8Array> {
  if (!props.src) throw new Error('No PDF')
  return signPdf(await sourceBytes(props.src), props.fields, options)
}

defineExpose({
  /** The PDF with the filled fields written in (needs `pdf-lib`) */
  save,
  /** Scrolls to the next field to fill */
  next,
  /** Whether every required field of this signer is filled */
  complete,
  /** The viewer underneath (zoom, pages, search) */
  viewer,
})
</script>

<template>
  <div class="m3-pdf-signer" v-bind="$attrs">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container px-3 py-2">
      <template v-if="mode === 'sign'">
        <MIcon :name="complete ? 'task_alt' : 'edit_document'" :size="20" :class="complete ? 'text-primary' : 'text-on-surface-variant'" />
        <span class="text-body-medium text-on-surface" aria-live="polite">{{ complete ? locale.pdfSignComplete : progress }}</span>
        <span class="flex-1" />
        <MButton v-if="!complete" variant="tonal" icon="arrow_downward" @click="next">{{ locale.pdfSignNext }}</MButton>
        <MButton :disabled="!complete" icon="check" @click="emit('finish')">{{ locale.pdfSignFinish }}</MButton>
      </template>
      <template v-else>
        <span class="mr-1 text-label-large text-on-surface-variant">{{ locale.pdfSignAddField }}</span>
        <MButton v-for="t in types" :key="t" variant="tonal" size="sm" :icon="TYPE[t].icon" :data-add="t" @click="addField(t)">{{ typeName(t) }}</MButton>
      </template>
    </div>

    <MPdfViewer
      ref="viewer"
      :src="src"
      :worker-src="workerSrc"
      class="min-h-0 flex-1"
      @update:page="currentPage = $event"
      @loaded="emit('loaded', $event)"
    >
      <template #page="slot">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-0 top-0" :style="frameStyle(slot)">
            <div
              v-for="f in byPage.get(slot.page) ?? []"
              :id="fieldId(f)"
              :key="f.id"
              class="m3-pdf-sign-field pointer-events-auto absolute flex items-center justify-center rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="[
                mode === 'prepare' ? 'cursor-move' : mine(f) ? 'cursor-pointer' : 'cursor-default opacity-40',
                f.value ? 'm3-pdf-sign-filled' : 'm3-pdf-sign-empty',
                mode === 'sign' && mine(f) && fieldMissing(f) ? 'm3-pdf-sign-todo' : '',
                selectedId === f.id && mode === 'prepare' ? 'm3-pdf-sign-selected' : '',
              ]"
              :style="fieldStyle(f)"
              :data-field="f.id"
              :data-type="f.type"
              role="button"
              :tabindex="mode === 'prepare' || mine(f) ? 0 : -1"
              :aria-label="`${f.label ?? typeName(f.type)}${f.value ? '' : (f.required ?? (f.type === 'signature' || f.type === 'initials')) ? ` (${locale.pdfSignRequired})` : ''}`"
              @click="mode === 'sign' ? fill(f, !!f.value) : (selectedId = f.id)"
              @pointerdown="onFieldDown($event, f, 'move', { width: slot.rotation % 180 ? slot.height : slot.width, height: slot.rotation % 180 ? slot.width : slot.height })"
              @pointermove="onFieldMove"
              @pointerup="onFieldUp"
              @pointercancel="onFieldUp"
              @keydown="onFieldKey($event, f)"
            >
              <img v-if="f.value && (f.type === 'signature' || f.type === 'initials')" :src="f.value" alt="" class="h-full w-full object-contain" draggable="false" />
              <MIcon v-else-if="f.type === 'checkbox' && f.value === 'true'" name="check" class="text-on-surface" :size="Math.max(12, slot.height * f.height * 0.9)" />
              <span v-else-if="f.value" class="m3-pdf-sign-text w-full truncate px-1 text-left" :style="{ fontSize: `${Math.max(8, slot.height * f.height * 0.6)}px` }">{{ f.value }}</span>
              <span v-else-if="f.type !== 'checkbox'" class="flex min-w-0 items-center gap-1 truncate px-1 text-label-medium">
                <MIcon :name="TYPE[f.type].icon" :size="16" />
                <span class="truncate">{{ f.type === 'signature' && mode === 'sign' ? locale.pdfSignHere : f.label ?? typeName(f.type) }}</span>
              </span>
              <template v-if="mode === 'prepare' && selectedId === f.id">
                <span
                  class="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-surface bg-primary touch-none"
                  aria-hidden="true"
                  @pointerdown="onFieldDown($event, f, 'resize', { width: slot.rotation % 180 ? slot.height : slot.width, height: slot.rotation % 180 ? slot.width : slot.height })"
                />
                <div class="absolute -top-11 left-0 flex items-center gap-1 rounded-full bg-surface-container-high px-1 shadow-elevation-2" @pointerdown.stop>
                  <MButton
                    :variant="f.required ?? (f.type === 'signature' || f.type === 'initials') ? 'filled' : 'text'"
                    size="xs"
                    @click.stop="patch(f.id, { required: !(f.required ?? (f.type === 'signature' || f.type === 'initials')) })"
                  >{{ locale.pdfSignRequired }}</MButton>
                  <MIconButton icon="delete" size="xs" :label="locale.pdfSignDelete" @click.stop="removeField(f.id)" />
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </MPdfViewer>

    <MDialog :model-value="!!dialog" :title="dialog ? (dialog.field.label ?? typeName(dialog.field.type)) : ''" max-width="560px" @update:model-value="(v: boolean) => { if (!v) dialog = null }">
      <div v-if="dialog" class="flex flex-col gap-4">
        <template v-if="isSignature">
          <MSegmentedButton
            v-model="dialog.tab"
            :options="[{ value: 'draw', label: locale.pdfSignDraw, icon: 'draw' }, { value: 'type', label: locale.pdfSignTypeIt, icon: 'keyboard' }]"
            density="compact"
          />
          <div v-if="dialog.tab === 'draw'" ref="padBox" class="flex flex-col gap-2">
            <MSignaturePad ref="pad" :key="padWidth" :width="padWidth" :height="180" @end="padEmpty = false" @change="padEmpty = !!pad?.isEmpty()" />
            <MButton variant="text" icon="ink_eraser" class="self-start" @click="pad?.clear(); padEmpty = true">{{ locale.clear }}</MButton>
          </div>
          <template v-else>
            <MTextField v-model="dialog.text" :label="typeName(dialog.field.type)" autocomplete="name" />
            <div class="flex h-24 items-center overflow-hidden rounded-lg bg-surface-container-highest px-4 text-[2.5rem] text-[#1a237e] dark:text-[#c5cae9]" :style="{ fontFamily: SCRIPT_FONT }">{{ dialog.text }}</div>
          </template>
        </template>
        <MTextField v-else v-model="dialog.text" :label="dialog.field.label ?? typeName(dialog.field.type)" @keydown.enter="apply" />
      </div>
      <template #actions>
        <MButton variant="text" @click="dialog = null">{{ locale.cancel }}</MButton>
        <MButton :disabled="!canApply" @click="apply">{{ isSignature ? locale.pdfSignAdopt : locale.ok }}</MButton>
      </template>
    </MDialog>
  </div>
</template>

<style>
@layer base {
  .m3-pdf-signer {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}
.m3-pdf-sign-empty {
  border: 1.5px dashed var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}
.m3-pdf-sign-todo {
  background: color-mix(in srgb, var(--color-tertiary-container) 70%, transparent);
  border-color: var(--color-tertiary);
  color: var(--color-on-tertiary-container);
}
.m3-pdf-sign-filled {
  border: 1px solid transparent;
}
.m3-pdf-sign-filled:hover,
.m3-pdf-sign-filled:focus-visible {
  border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}
.m3-pdf-sign-text {
  color: #111;
  font-family: system-ui, sans-serif;
  line-height: 1;
}
.m3-pdf-sign-selected {
  box-shadow: 0 0 0 2px var(--color-primary);
}
</style>
