<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
    /**
     * M3's `AlertDialogDefaults` has no max-height token at all (only `DialogMaxWidth`) — the
     * default here is a library-chosen viewport-relative cap, not a spec value.
     */
    maxHeight?: string
    persistent?: boolean
    fullscreen?: boolean
    closeLabel?: string
    /**
     * Whether the header shows a close ("X") icon button. M3's `AlertDialog` spec has no such
     * button — it expects only a Cancel/Confirm text button in the actions row — so this is a
     * deliberate library extension on top of the spec, kept opt-out (default `true`, matching
     * this component's existing behavior) rather than added unconditionally.
     */
    closable?: boolean
  }>(),
  {
    // AlertDialogDefaults.DialogMaxWidth = 560dp
    maxWidth: 'max-w-[560px]',
    maxHeight: 'max-h-[90vh]',
    persistent: false,
    fullscreen: false,
    closable: true,
  },
)

const locale = useLocale()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function close() {
  if (props.persistent) return
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
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

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
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
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
      resizeObserver?.disconnect()
      resizeObserver = undefined
    }
  },
)

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <!-- Basic dialog -->
    <Transition v-if="!fullscreen" name="m3-dialog">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/32 p-4"
        @click.self="close"
      >
        <div
          class="dialog-box flex min-w-[280px] w-full flex-col rounded-xl bg-surface-container-high shadow-elevation-3"
          :class="[maxWidth, maxHeight]"
        >
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
        </div>
      </div>
    </Transition>

    <!-- Fullscreen dialog -->
    <Transition v-else name="m3-dialog-fs">
      <div
        v-if="modelValue"
        class="dialog-fs fixed inset-0 z-50 flex flex-col bg-surface"
      >
        <div class="flex h-14 shrink-0 items-center gap-2 px-2">
          <MIconButton v-if="!persistent" icon="close" :label="closeLabel ?? locale.close" @click="close" />
          <h2 class="flex-1 text-title-large font-medium text-on-surface">
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
