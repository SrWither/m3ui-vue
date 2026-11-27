<script setup lang="ts">
/**
 * An outlined field that opens a color picker in a dropdown: saturation/brightness area, hue (and optional
 * opacity) slider, eyedropper, HEX/RGB/HSL fields, recent colors and preset swatches. Updates the value live
 * while picking.
 *
 * @event update:modelValue Emitted with the picked color, live while dragging or typing.
 */
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import MColorPanel from './_MColorPanel.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useLocale } from '../composables/useLocale'
import { useFollowAnchor } from '../composables/_useFollowAnchor'
import { defaultColorPresets, normalizeHex, pushRecentColor } from '../composables/_colorUtils'
import { OUTLINED_FLOATED_LABEL, vOverflowTitle } from '../composables/_fieldLayout'

const props = withDefaults(defineProps<{
  /** Selected color in hex format (v-model). `#rrggbb`, or `#rrggbbaa` when `alpha` is on and the color isn't opaque. */
  modelValue: string
  /** Field label */
  label?: string
  /** Preset color swatches shown in the panel */
  presets?: string[]
  /** Adds an opacity slider and an alpha channel to the value */
  alpha?: boolean
  /** Remember picked colors and show them above the presets (stored in localStorage, shared by every picker). */
  recent?: boolean
  /** How many recent colors to keep. */
  recentLimit?: number
  /** Show a button to pick a color from the screen, where the browser supports it (Chrome, Edge). */
  eyedropper?: boolean
  /** Disables the picker */
  disabled?: boolean
  /** Error state. A string is also the message (`:error="errors.x"`) */
  error?: boolean | string
  /** Error message shown when error is true */
  errorLabel?: string
  /** Marks as required — adds a red asterisk after the label; inside an `MForm` or with `rules`, also validates it */
  required?: boolean
  /**
   * Validation rules: functions `(value, ctx) => true | 'message'` (may be async; see the built-in `required`,
   * `email`, `minLength`…) or a Standard Schema (zod, valibot…). Checked in order; the first failure is shown
   */
  rules?: ValidationRule | ValidationRule[]
  /** When the rules are checked and shown: on leaving the field (default; live after that), while typing, or only on submit (`MForm`) */
  validateOn?: ValidateOn
  /** The key of this field in its `MForm`'s values, errors and schema */
  name?: string
  /** Hint text below the field */
  hint?: string
  /** Overrides the auto-detected background color used to cut the floating label out of the border */
  fieldBg?: string
}>(), {
  presets: () => defaultColorPresets,
  alpha: false,
  recent: true,
  recentLimit: 7,
  eyedropper: true,
})

const emit = defineEmits<{ blur: []; 'update:modelValue': [string] }>()

const rootEl = ref<HTMLElement | null>(null)
const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => props.rules,
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  disabled: () => props.disabled,
  focus: () => { buttonEl.value?.focus() },
  el: () => buttonEl.value,
  setValue: (v) => emit('update:modelValue', v as string),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation
const t = useLocale()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const buttonEl = ref<HTMLButtonElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const colorPanel = ref<InstanceType<typeof MColorPanel> | null>(null)
const dropPos = ref({ top: '0px', left: '0px' })
const { resolvedFieldBg } = useFieldBg(triggerEl, () => props.fieldBg)

// The value when the panel opened: shown as the "before" half of the preview, and compared on close to
// decide whether the color goes into the recents
const original = ref('')

const GAP = 4
const MARGIN = 8

function computeDropPos() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  const w = panelEl.value?.offsetWidth ?? 312
  const ph = panelEl.value?.offsetHeight ?? 480
  const below = window.innerHeight - rect.bottom - GAP - MARGIN
  const top = below >= ph || rect.top - GAP - MARGIN < ph
    ? Math.max(MARGIN, Math.min(rect.bottom + GAP, window.innerHeight - ph - MARGIN))
    : rect.top - GAP - ph
  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - w - MARGIN))
  dropPos.value = { top: `${top}px`, left: `${left}px` }
}

function close(refocus = false) {
  if (!open.value) return
  open.value = false
  if (refocus) buttonEl.value?.focus()
}

function onOut(e: MouseEvent) {
  const target = e.target as Node
  if (triggerEl.value?.contains(target) || panelEl.value?.contains(target)) return
  close()
}

// Stays on its field while the page or a container scrolls, the window/zoom changes or the field resizes
useFollowAnchor({ open: () => open.value, anchor: triggerEl, popup: panelEl, place: computeDropPos, close: () => close() })

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close(true)
  }
}

// The panel is teleported to <body>, so tabbing out of it lands outside the field: close when focus leaves
function onPanelFocusOut(e: FocusEvent) {
  const to = e.relatedTarget as Node | null
  if (!to || panelEl.value?.contains(to) || triggerEl.value?.contains(to)) return
  close()
}

watch(open, async (v) => {
  if (v) {
    original.value = normalizeHex(props.modelValue)
    computeDropPos()
    await nextTick()
    computeDropPos()
    colorPanel.value?.focus()
    setTimeout(() => document.addEventListener('mousedown', onOut), 0)
  } else {
    document.removeEventListener('mousedown', onOut)
    const picked = normalizeHex(props.modelValue)
    if (props.recent && picked && picked !== original.value) pushRecentColor(picked, props.recentLimit)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onOut)
})

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})

// Last: it watches `open`, declared above
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
}, () => open.value)
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-1" @focusout="onFocusOut">
    <div ref="triggerEl" class="relative mt-2" :style="{ '--field-bg': resolvedFieldBg }">
      <button
        ref="buttonEl"
        :aria-invalid="hasError || undefined"
        :aria-describedby="errorMessage || hint ? messageId : undefined"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :disabled="isDisabled"
        class="flex h-14 w-full items-center gap-3 rounded-xs border bg-transparent px-4 text-left text-body-large outline-none transition-[border-color,border-width] duration-150"
        :class="[
          isDisabled ? 'cursor-not-allowed border-on-surface/12' : 'cursor-pointer',
          !isDisabled && (open
            ? hasError ? 'border-2 border-error' : 'border-2 border-primary'
            : hasError
              ? 'border-error focus-visible:border-2'
              : 'border-outline hover:border-on-surface focus-visible:border-2 focus-visible:border-primary'),
        ]"
        @click="open = !open"
      >
        <span
          class="m3-cp-swatch h-6 w-6 shrink-0 rounded-full"
          :class="isDisabled ? 'opacity-38' : ''"
          :style="{ background: `linear-gradient(${modelValue}, ${modelValue}), repeating-conic-gradient(#d4d4d4 0 25%, #fff 0 50%) 0 0 / 8px 8px` }"
        />
        <span v-overflow-title class="min-w-0 truncate flex-1 font-mono" :class="isDisabled ? 'text-on-surface/38' : 'text-on-surface'">{{ modelValue }}</span>
        <MIcon
          name="palette"
          :size="24"
          class="shrink-0 transition-colors"
          :class="isDisabled ? 'text-on-surface/38' : open ? (hasError ? 'text-error' : 'text-primary') : 'text-on-surface-variant'"
        />
      </button>
      <label
        v-if="label"
        :class="[OUTLINED_FLOATED_LABEL, 'transition-colors', isDisabled ? 'text-on-surface/38' : open ? (hasError ? 'text-error' : 'text-primary') : hasError ? 'text-error' : 'text-on-surface-variant']"
      >
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>
    </div>

    <p v-if="errorMessage" :id="messageId" role="alert" class="px-4 text-body-small text-error">{{ errorMessage }}</p>
    <p v-else-if="hint" :id="messageId" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>

    <Teleport to="body">
      <Transition name="m3-cp-drop">
        <div
          v-if="open"
          ref="panelEl"
          role="dialog"
          :aria-label="label || t.selectColor"
          class="fixed z-500 w-[312px] max-w-[calc(100vw-16px)] rounded-lg bg-surface-container p-4 shadow-elevation-2"
          :style="dropPos"
          @keydown="onPanelKeydown"
          @focusout="onPanelFocusOut"
        >
          <MColorPanel
            ref="colorPanel"
            :model-value="modelValue"
            :presets="presets"
            :alpha="alpha"
            :recent="recent"
            :eyedropper="eyedropper"
            :original="original"
            @update:model-value="emit('update:modelValue', $event)"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.m3-cp-swatch {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-on-surface) 12%, transparent);
}
.m3-cp-drop-enter-active {
  transition: opacity 150ms cubic-bezier(0.2, 0, 0, 1), transform 250ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-cp-drop-leave-active {
  transition: opacity 100ms ease, transform 100ms ease;
}
.m3-cp-drop-enter-from,
.m3-cp-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
