<script setup lang="ts">
/**
 * A collapsed search field that expands into a docked panel or a fullscreen overlay, with results shown below
 * the input.
 *
 * @slot leading Overrides the collapsed bar's leading icon
 * @slot trailing Trailing content in both the collapsed bar and the expanded header (e.g. an avatar)
 * @slot default Results/suggestions content, shown below the input while expanded
 * @event update:modelValue Emitted on every input change — powers v-model
 * @event search Emitted when Enter is pressed in the input, with the current query
 * @event update:expanded Emitted when the expanded state changes — powers v-model:expanded
 */
import { computed, inject, ref, watch, onMounted, onUnmounted, nextTick, useId } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'
import { searchAppBarKey } from '../composables/_searchAppBar'

// Root is a fragment (bar div + a sibling Teleport for the expanded overlay panel), so Vue
// can't auto-apply a consumer's class/attrs to either one — forward them onto the bar div below.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Search query (v-model) */
    modelValue?: string
    /** Controls the expanded/collapsed state — also works uncontrolled if omitted. */
    expanded?: boolean
    /** Defaults to the locale's "Search..." */
    placeholder?: string
    /** 'docked' grows into a rounded panel anchored below the bar (default).
     *  'fullscreen' takes over the whole viewport, matching M3's mobile
     *  search pattern — the leading icon becomes a back button either way.
     *  'fullscreen-contained' (M3 Expressive's ExpandedFullScreenContainedSearchBar) also takes the whole
     *  viewport, on surface-container-low, but keeps the input in its pill shape, with no divider. */
    variant?: 'docked' | 'fullscreen' | 'fullscreen-contained'
    /** Icon shown in the collapsed bar */
    leadingIcon?: string
    /** Which side of the *collapsed* bar the leading icon sits on. The
     *  expanded panel's back button always stays at the start regardless —
     *  that's a near-universal "go back" convention. */
    iconPosition?: 'start' | 'end'
    /** Centers the input/placeholder text instead of the M3-standard start
     *  alignment (an iOS-style look some apps use for the collapsed bar). */
    textAlign?: 'start' | 'center'
    /** Shows a spinner in the expanded header instead of the clear button */
    loading?: boolean
    /** Shows a clear (×) button once there is a query */
    clearable?: boolean
    /** Disables the collapsed bar */
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
const fullscreen = computed(() => props.variant !== 'docked')
const contained = computed(() => props.variant === 'fullscreen-contained')
// Inside an MAppBarWithSearch the bar is flat and darkens when content scrolls under the app bar
const appBar = inject(searchAppBarKey, null)

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
  if (v && fullscreen.value) document.body.style.overflow = 'hidden'
  else document.body.style.overflow = ''
})
onUnmounted(() => { document.body.style.overflow = '' })
</script>

<template>
  <div ref="barEl" class="relative w-full" v-bind="$attrs">
    <div
      v-show="!expanded"
      class="flex h-14 items-center gap-3 rounded-full px-4 transition-[box-shadow,background-color] duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-secondary focus-within:-outline-offset-2"
      :class="[
        disabled ? 'pointer-events-none opacity-[0.38]' : '',
        appBar?.scrolled.value ? 'bg-surface-container-highest' : 'bg-surface-container-high',
        appBar ? '' : 'shadow-elevation-3',
      ]"
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
    <Transition :name="fullscreen ? 'm3-searchbar-full' : 'm3-searchbar-docked'">
      <div
        v-if="expanded"
        ref="panelEl"
        class="fixed z-500 flex flex-col overflow-hidden"
        :class="[
          fullscreen ? 'inset-0' : 'max-h-[70vh] rounded-[28px] shadow-elevation-3',
          contained ? 'bg-surface-container-low' : 'bg-surface-container-high',
        ]"
        :style="variant === 'docked' ? panelPos : undefined"
      >
        <!-- Contained: the input keeps the collapsed pill (collapsedContainedSearchBarColor), 8dp from the
             sides, 4dp from the top and 8dp above the results (FullScreenSearchBarLayout's isContained) -->
        <div
          class="flex shrink-0 items-center gap-3"
          :class="contained ? 'mx-2 mt-1 mb-2 h-14 rounded-full bg-surface-container-high px-1' : variant === 'fullscreen' ? 'h-[72px] px-4' : 'h-14 px-4'"
        >
          <MIconButton
            icon="arrow_back"
            :label="locale.close"
            variant="standard"
            style="color: var(--color-on-surface)"
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

        <div v-if="!contained" class="h-px shrink-0 bg-outline" />

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
