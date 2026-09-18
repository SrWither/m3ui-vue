<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick, useId } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** Controls the expanded/collapsed state — also works uncontrolled if omitted. */
    expanded?: boolean
    placeholder?: string
    /** 'docked' grows into a rounded panel anchored below the bar (default).
     *  'fullscreen' takes over the whole viewport, matching M3's mobile
     *  search pattern — the leading icon becomes a back button either way. */
    variant?: 'docked' | 'fullscreen'
    leadingIcon?: string
    /** Which side of the *collapsed* bar the leading icon sits on. The
     *  expanded panel's back button always stays at the start regardless —
     *  that's a near-universal "go back" convention. */
    iconPosition?: 'start' | 'end'
    /** Centers the input/placeholder text instead of the M3-standard start
     *  alignment (an iOS-style look some apps use for the collapsed bar). */
    textAlign?: 'start' | 'center'
    loading?: boolean
    clearable?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    variant: 'docked',
    leadingIcon: 'search',
    iconPosition: 'start',
    textAlign: 'start',
    loading: false,
    clearable: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  'update:expanded': [boolean]
  search: [string]
}>()

const locale = useLocale()
const id = useId()

const expanded = ref(props.expanded ?? false)
watch(
  () => props.expanded,
  (v) => { if (v !== undefined && v !== expanded.value) expanded.value = v },
)
watch(expanded, (v) => emit('update:expanded', v))

const barEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const panelPos = ref({ top: '0px', left: '0px', width: '0px' })

function computePanelPos() {
  if (!barEl.value) return
  const rect = barEl.value.getBoundingClientRect()
  panelPos.value = { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px` }
}

function open() {
  if (props.disabled || expanded.value) return
  if (props.variant === 'docked') computePanelPos()
  expanded.value = true
  nextTick(() => inputEl.value?.focus())
}

function close() {
  if (!expanded.value) return
  expanded.value = false
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onClear() {
  emit('update:modelValue', '')
  nextTick(() => inputEl.value?.focus())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
    inputEl.value?.blur()
  } else if (e.key === 'Enter') {
    emit('search', props.modelValue)
  }
}

function onOutsideClick(e: MouseEvent) {
  if (props.variant !== 'docked' || !expanded.value) return
  const t = e.target as Node
  if (barEl.value?.contains(t) || panelEl.value?.contains(t)) return
  close()
}

function onScroll(e: Event) {
  if (props.variant !== 'docked' || !expanded.value) return
  if (panelEl.value?.contains(e.target as Node)) return
  close()
}

onMounted(() => {
  document.addEventListener('mousedown', onOutsideClick)
  window.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideClick)
  window.removeEventListener('scroll', onScroll, true)
})

watch(expanded, (v) => {
  if (v && props.variant === 'fullscreen') document.body.style.overflow = 'hidden'
  else document.body.style.overflow = ''
})
onUnmounted(() => { document.body.style.overflow = '' })
</script>

<template>
  <div ref="barEl" class="relative w-full">
    <div
      v-show="!expanded"
      class="flex h-14 items-center gap-3 rounded-full bg-surface-container-high px-4 shadow-elevation-1 transition-shadow duration-150"
      :class="disabled ? 'pointer-events-none opacity-[0.38]' : ''"
    >
      <span class="inline-flex shrink-0 items-center" :class="iconPosition === 'end' ? 'order-last' : ''">
        <slot name="leading">
          <MIcon :name="leadingIcon" :size="20" class="text-on-surface" />
        </slot>
      </span>
      <input
        :id="id"
        type="text"
        role="searchbox"
        :value="modelValue"
        :placeholder="placeholder ?? locale.search"
        :disabled="disabled"
        :aria-expanded="expanded"
        class="w-full bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
        :class="textAlign === 'center' ? 'text-center' : ''"
        @focus="open"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button
        v-if="clearable && modelValue && !disabled"
        type="button"
        class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @mousedown.prevent="onClear"
      >
        <MIcon name="close" :size="18" />
      </button>
      <slot name="trailing" />
    </div>
  </div>

  <Teleport to="body">
    <Transition :name="variant === 'fullscreen' ? 'm3-searchbar-full' : 'm3-searchbar-docked'">
      <div
        v-if="expanded"
        ref="panelEl"
        class="fixed z-500 flex flex-col overflow-hidden bg-surface-container-high"
        :class="variant === 'fullscreen' ? 'inset-0' : 'max-h-[70vh] rounded-[28px] shadow-elevation-3'"
        :style="variant === 'docked' ? panelPos : undefined"
      >
        <div
          class="flex shrink-0 items-center gap-3 px-4"
          :class="variant === 'fullscreen' ? 'h-[72px]' : 'h-14'"
        >
          <MIconButton
            icon="arrow_back"
            :label="locale.close"
            variant="standard"
            @click="close"
          />
          <input
            ref="inputEl"
            type="text"
            role="searchbox"
            :value="modelValue"
            :placeholder="placeholder ?? locale.search"
            class="w-full bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
            :class="textAlign === 'center' ? 'text-center' : ''"
            @input="onInput"
            @keydown="onKeydown"
          />
          <MSpinner v-if="loading" :size="20" class="shrink-0 text-on-surface-variant" />
          <button
            v-else-if="clearable && modelValue"
            type="button"
            class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
            @mousedown.prevent="onClear"
          >
            <MIcon name="close" :size="18" />
          </button>
          <slot name="trailing" />
        </div>

        <div class="h-px shrink-0 bg-outline-variant" />

        <div class="flex-1 overflow-y-auto">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-searchbar-docked-enter-active,
.m3-searchbar-docked-leave-active {
  transition: opacity 150ms ease, transform 150ms cubic-bezier(0.2, 0, 0, 1);
  transform-origin: top center;
}
.m3-searchbar-docked-enter-from,
.m3-searchbar-docked-leave-to {
  opacity: 0;
  transform: scaleY(0.9);
}
.m3-searchbar-full-enter-active,
.m3-searchbar-full-leave-active {
  transition: opacity 150ms ease;
}
.m3-searchbar-full-enter-from,
.m3-searchbar-full-leave-to {
  opacity: 0;
}
</style>
