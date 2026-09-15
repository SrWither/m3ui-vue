<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    /** Material Symbol name, or an image src (URL, data URI, or a path with a file extension) — detected automatically. */
    icon?: string
    titleAlign?: 'start' | 'center'
    /** Show the minimize/maximize/close buttons as a group. Defaults to `true`, except on `platform="macos"` where the OS draws native traffic lights instead. */
    controls?: boolean
    /** Individually hide one control while keeping the others — e.g. a fixed-size window with no maximize button. */
    minimizable?: boolean
    maximizable?: boolean
    closable?: boolean
    /** Reflects the real window state — the bar has no way to know it itself, the host app must read it from its Electron main process and pass it down. */
    maximized?: boolean
    platform?: 'windows' | 'macos'
    /** Bar height in px. */
    height?: number
    /** Double-clicking empty drag space toggles maximize, matching native title bar behavior. */
    doubleClickMaximize?: boolean
  }>(),
  {
    titleAlign: 'start',
    // Explicit `undefined` defaults, not omitted — an omitted optional boolean
    // prop gets auto-cast to `false` by Vue (not left `undefined`), which would
    // permanently break the `props.x ?? smartDefault` fallbacks below.
    controls: undefined,
    minimizable: undefined,
    maximizable: undefined,
    closable: undefined,
    maximized: false,
    platform: 'windows',
    height: 36,
    doubleClickMaximize: true,
  },
)

const emit = defineEmits<{ minimize: []; maximize: []; close: [] }>()

// A plain Material Symbol name never has a scheme/path/extension, so this is
// enough to tell an image src apart from an icon name without needing a
// separate prop.
const iconIsImage = computed(() => {
  if (!props.icon) return false
  return /^(data:|https?:\/\/|\.{0,2}\/)/.test(props.icon) || /\.(png|jpe?g|svg|gif|webp|ico|avif)$/i.test(props.icon)
})

const showControls = computed(() => props.controls ?? props.platform !== 'macos')
const showMinimize = computed(() => showControls.value && (props.minimizable ?? true))
const showMaximize = computed(() => showControls.value && (props.maximizable ?? true))
const showClose = computed(() => showControls.value && (props.closable ?? true))
const hasAnyControl = computed(() => showMinimize.value || showMaximize.value || showClose.value)

function onDblclick() {
  if (props.doubleClickMaximize) emit('maximize')
}
</script>

<template>
  <div
    class="relative flex w-full shrink-0 select-none items-center bg-surface-container text-on-surface"
    style="-webkit-app-region: drag"
    :style="{ height: `${height}px` }"
    @dblclick="onDblclick"
  >
    <!-- Reserves space for native macOS traffic lights, drawn by the OS outside the web content -->
    <div v-if="platform === 'macos'" class="h-full shrink-0" style="width: 78px" />

    <div
      v-if="icon || $slots.icon"
      class="flex h-full shrink-0 items-center pl-3"
      style="-webkit-app-region: no-drag"
    >
      <slot name="icon">
        <img v-if="iconIsImage" :src="icon" alt="" class="h-4 w-4 object-contain" />
        <MIcon v-else :name="icon!" :size="16" />
      </slot>
    </div>

    <!-- Start-aligned title sits inline; centered title floats over the whole bar so it's
         centered regardless of how wide the icon/controls on either side are. -->
    <div
      v-if="titleAlign === 'start'"
      class="flex h-full flex-1 items-center truncate px-2 text-label-medium text-on-surface-variant"
    >
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-else class="h-full flex-1" />
    <div
      v-if="titleAlign === 'center'"
      class="pointer-events-none absolute inset-x-0 flex h-full items-center justify-center truncate px-20 text-label-medium text-on-surface-variant"
    >
      <slot name="title">{{ title }}</slot>
    </div>

    <div v-if="$slots.default" class="flex h-full items-center" style="-webkit-app-region: no-drag">
      <slot />
    </div>

    <div v-if="$slots.trailing" class="flex h-full shrink-0 items-center" style="-webkit-app-region: no-drag">
      <slot name="trailing" />
    </div>

    <div v-if="hasAnyControl" class="flex h-full shrink-0" style="-webkit-app-region: no-drag">
      <button
        v-if="showMinimize"
        type="button"
        class="m3-bar-btn"
        aria-label="Minimize"
        @click="emit('minimize')"
      >
        <MIcon name="horizontal_rule" :size="16" />
      </button>
      <button
        v-if="showMaximize"
        type="button"
        class="m3-bar-btn"
        :aria-label="maximized ? 'Restore' : 'Maximize'"
        @click="emit('maximize')"
      >
        <MIcon :name="maximized ? 'filter_none' : 'crop_square'" :size="14" />
      </button>
      <button
        v-if="showClose"
        type="button"
        class="m3-bar-btn m3-bar-btn-close"
        aria-label="Close"
        @click="emit('close')"
      >
        <MIcon name="close" :size="16" />
      </button>
    </div>
  </div>
</template>

<style>
.m3-bar-btn {
  display: inline-flex;
  height: 100%;
  width: 46px;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  transition: background-color 100ms ease, color 100ms ease;
  cursor: pointer;
}
.m3-bar-btn:hover {
  background-color: var(--color-surface-container-highest);
  color: var(--color-on-surface);
}
.m3-bar-btn-close:hover {
  background-color: var(--color-error);
  color: var(--color-on-error);
}
</style>
