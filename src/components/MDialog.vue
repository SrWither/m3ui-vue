<script setup lang="ts">
/**
 * The generic M3 modal shell — Escape, scroll lock, and Teleport are handled internally. Supports a centered
 * card, a full-screen variant, and an optional icon that centers the title per spec.
 *
 * @slot icon M3 AlertDialog's optional icon (Secondary color, 24dp expected). Its presence also centers the
 *   title, per spec.
 * @slot title Overrides the title prop with custom markup
 * @slot default Dialog body content — scrolls independently when taller than maxHeight. With `bare`, the whole
 *   dialog: it fills the box (no title, padding, close button or actions row)
 * @slot actions Row of action buttons — wraps to a new line instead of overflowing when labels are long
 * @event update:modelValue Emitted when the dialog should open/close — powers v-model
 */
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'
import { useScrollLock } from '../composables/_useScrollLock'
import { useEscapeStack } from '../composables/_useEscapeStack'

const props = withDefaults(
  defineProps<{
    /** Open/closed state (v-model) */
    modelValue: boolean
    /** Dialog title (overridable via the #title slot) */
    title?: string
    /** A Tailwind class (`max-w-sm`) or a CSS value (`420px`, `min(90vw, 40rem)`). */
    maxWidth?: string
    /**
     * Maximum height: a Tailwind class (`max-h-[60vh]`) or a CSS value (`480px`, `calc(100dvh - 4rem)`). When the
     * content is taller, the body scrolls and a divider appears above the actions.
     */
    // A Tailwind class (`max-h-[80vh]`) or a CSS value (`600px`). M3's `AlertDialogDefaults` has
    // no max-height token at all (only `DialogMaxWidth`) — the default here is a library-chosen
    // viewport-relative cap, not a spec value.
    maxHeight?: string
    /** Prevent closing by clicking the scrim, pressing Escape, or the X button */
    persistent?: boolean
    /** Full-screen variant — slides up from the bottom, covers the entire viewport */
    fullscreen?: boolean
    /** Aria label for the close (X) button — falls back to the locale string when omitted */
    closeLabel?: string
    /**
     * Show the header close (X) button — a library addition, not part of the M3 AlertDialog spec, so it can be
     * turned off
     */
    // Whether the header shows a close ("X") icon button. M3's `AlertDialog` spec has no such
    // button — it expects only a Cancel/Confirm text button in the actions row — so this is a
    // deliberate library extension on top of the spec, kept opt-out (default `true`, matching
    // this component's existing behavior) rather than added unconditionally.
    closable?: boolean
    /**
     * Just the dialog's box (surface, shape, elevation), scrim, Escape, scroll lock and animation, with the default
     * slot filling it: no title row, padding, close button or actions. For dialogs that draw everything themselves
     * (the date and time pickers). `title` then only names it for assistive technology
     */
    bare?: boolean
  }>(),
  {
    // AlertDialogDefaults.DialogMaxWidth = 560dp
    maxWidth: 'max-w-[560px]',
    maxHeight: 'max-h-[90vh]',
    persistent: false,
    fullscreen: false,
    closable: true,
    bare: false,
  },
)

const locale = useLocale()

// maxWidth/maxHeight take either a Tailwind class or a CSS value: a bare length or a CSS function
// can't be a class, so those go to inline style instead.
const isCssValue = (v: string) => /^-?[\d.]+[a-z%]*$|^(calc|min|max|clamp|var)\(/i.test(v.trim())
const sizeClasses = computed(() => [props.maxWidth, props.maxHeight].filter((v) => !isCssValue(v)))
const sizeStyle = computed(() => ({
  ...(isCssValue(props.maxWidth) ? { maxWidth: props.maxWidth } : {}),
  ...(isCssValue(props.maxHeight) ? { maxHeight: props.maxHeight } : {}),
}))

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function close() {
  if (props.persistent) return
  emit('update:modelValue', false)
}


// M3's dialog anatomy lists an optional divider between the (scrollable) content and the
// actions row — Compose's own AlertDialog.kt has no built-in implementation of it at all, so
// this shows it only when the content actually has more to scroll to, above the actions row.
const contentEl = ref<HTMLElement>()
const contentInnerEl = ref<HTMLElement>()
const showDivider = ref(false)
let resizeObserver: ResizeObserver | undefined

function updateDividerVisibility() {
  const el = contentEl.value
  if (!el) { showDivider.value = false; return }
  showDivider.value = el.scrollHeight - el.scrollTop - el.clientHeight > 1
}

useScrollLock(() => props.modelValue)
// Escape closes the dialog on top only, when several are stacked
useEscapeStack(() => props.modelValue, close)

const titleId = `m3-dialog-${useId()}`

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      await nextTick()
      updateDividerVisibility()
      // Observing contentEl alone only catches viewport-driven resizes (e.g. window resize
      // changing the maxHeight cap) — its own box stays put when the *slotted* content
      // changes height, since overflow doesn't affect the scroll container's own size. The
      // inner wrapper around the slot grows/shrinks with the actual content, so that's what
      // needs observing to catch dynamic content (reactive text, async-loaded content, etc).
      resizeObserver = new ResizeObserver(updateDividerVisibility)
      if (contentEl.value) resizeObserver.observe(contentEl.value)
      if (contentInnerEl.value) resizeObserver.observe(contentInnerEl.value)
    } else {
      resizeObserver?.disconnect()
      resizeObserver = undefined
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <!-- Basic dialog -->
    <!-- appear: a dialog mounted already open (v-if + modelValue in the same tick) animates in too -->
    <Transition v-if="!fullscreen" name="m3-dialog" appear>
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/32 p-4"
        @click.self="close"
      >
        <div
          class="dialog-box flex min-w-[280px] w-full flex-col rounded-xl bg-surface-container-high shadow-elevation-3"
          :class="sizeClasses"
          :style="sizeStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="!bare && ($slots.title || title) ? titleId : undefined"
          :aria-label="bare ? title : undefined"
        >
          <!-- Bare: the content is the whole dialog (scrolling if taller than maxHeight), clipped to the box's
               corners (rounded-[inherit]) so content reaching its edges, like a full-bleed image, keeps them -->
          <div v-if="bare" class="min-h-0 overflow-y-auto rounded-[inherit]">
            <slot />
          </div>
          <template v-else>
            <!--
              AlertDialogDefaults.dialogPadding is 24dp on all four sides of the whole content
              column, with per-element bottom paddings (IconPadding/TitlePadding/textPadding)
              providing the gaps BETWEEN elements — not a single wrapping padding, since this
              template uses separate divs per section instead of one padded Column. Each
              section's own top/bottom classes are chosen so the combined gaps still land on
              the right dp value: title-to-body is 16dp (8px here + 8px there), body-to-actions
              is 24dp (8px here + 16px there), and the outermost edges (top of title, bottom of
              whichever section is last) are the full 24dp on their own.
            -->
            <div class="relative px-6 pt-6 pb-2">
              <!--
                Wrapped in a plain div rather than passing `absolute right-4 top-4` straight to
                MIconButton: its root already carries its own `relative` (for the ripple span),
                and Tailwind resolves conflicting position utilities by source order in the
                compiled CSS, not by order in the class attribute — so an external `absolute`
                can silently lose to that internal `relative` instead of overriding it.
              -->
              <div v-if="closable && !persistent" class="absolute right-4 top-4">
                <MIconButton icon="close" :label="closeLabel ?? locale.close" @click="close" />
              </div>
              <!--
                Icon slot: M3 AlertDialog's optional `icon` param (IconColor=Secondary,
                IconSize=24dp expected from the slot content, IconPadding bottom=16dp below it),
                which per spec also centers the title ("Align the title to the center when an
                icon is present") — reserving `pr-10` on the title only when the close button is
                also showing, so a centered title doesn't collide with it.
              -->
              <div v-if="$slots.icon" class="mb-4 flex justify-center text-secondary">
                <slot name="icon" />
              </div>
              <h2
                :id="titleId"
                class="text-headline-small text-on-surface"
                :class="[
                  $slots.icon ? 'text-center' : 'text-left',
                  closable && !persistent ? ($slots.icon ? 'px-10' : 'pr-10') : '',
                ]"
              >
                <slot name="title">{{ title }}</slot>
              </h2>
            </div>
            <div
              ref="contentEl"
              class="overflow-y-auto px-6 pt-2 text-body-medium text-on-surface-variant"
              :class="$slots.actions ? 'pb-2' : 'pb-6'"
              @scroll="updateDividerVisibility"
            >
              <div ref="contentInnerEl">
                <slot />
              </div>
            </div>
            <!-- Divider: M3 dialog anatomy's optional divider, shown only while the content has more to scroll to -->
            <div v-if="showDivider && $slots.actions" class="shrink-0 border-t border-outline-variant" />
            <!-- flex-wrap approximates AlertDialogFlowRow: buttons wrap to a new line instead of overflowing when labels are too long to fit on one -->
            <div v-if="$slots.actions" class="flex flex-wrap justify-end gap-2 px-6 pt-4 pb-6">
              <slot name="actions" />
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Fullscreen dialog -->
    <Transition v-else name="m3-dialog-fs" appear>
      <div
        v-if="modelValue"
        class="dialog-fs fixed inset-0 z-50 flex flex-col bg-surface"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="$slots.title || title ? titleId : undefined"
      >
        <div class="flex h-14 shrink-0 items-center gap-2 px-2">
          <MIconButton v-if="!persistent" icon="close" :label="closeLabel ?? locale.close" @click="close" />
          <h2 :id="titleId" class="flex-1 text-title-large font-medium text-on-surface">
            <slot name="title">{{ title }}</slot>
          </h2>
          <div v-if="$slots.actions" class="flex items-center gap-2">
            <slot name="actions" />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4 text-body-medium text-on-surface-variant">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-dialog-enter-active,
.m3-dialog-leave-active {
  transition: opacity 0.15s ease;
}
.m3-dialog-enter-from,
.m3-dialog-leave-to {
  opacity: 0;
}
.m3-dialog-enter-active .dialog-box,
.m3-dialog-leave-active .dialog-box {
  transition: transform 0.15s ease;
}
.m3-dialog-enter-from .dialog-box,
.m3-dialog-leave-to .dialog-box {
  transform: scale(0.95);
}

.m3-dialog-fs-enter-active,
.m3-dialog-fs-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease;
}
.m3-dialog-fs-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.m3-dialog-fs-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
