<script setup lang="ts">
// Internal: one layer of MMapLayers (visibility, title, and expanded: description, opacity, legend, download)
import MIcon from './MIcon.vue'
import MSlider from './MSlider.vue'
import { useLocale } from '../composables/useLocale'
import { useMapLayers } from '../composables/useMapLayers'
import type { MapLayerInfo } from '../composables/mapAdapters'

defineProps<{ layer: MapLayerInfo; expanded: boolean }>()
const emit = defineEmits<{ 'toggle-expanded': [] }>()

const t = useLocale()
const { isVisible, toggle, opacityOf, setOpacity } = useMapLayers()
</script>

<template>
  <div class="flex overflow-hidden rounded-2xl bg-surface-container" :class="isVisible(layer.id) ? '' : 'opacity-75'">
    <div class="w-1 shrink-0 transition-colors duration-200" :class="isVisible(layer.id) ? 'bg-primary' : 'bg-outline-variant'" />
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex cursor-pointer items-center gap-2 px-3 py-2" @click="emit('toggle-expanded')">
        <button
          type="button"
          class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200"
          :class="isVisible(layer.id) ? 'bg-primary/12 text-primary' : 'bg-on-surface/5 text-on-surface-variant'"
          :aria-label="isVisible(layer.id) ? t.mapHideLayer : t.mapShowLayer"
          :aria-pressed="isVisible(layer.id)"
          @click.stop="toggle(layer.id)"
        >
          <MIcon :name="isVisible(layer.id) ? 'visibility' : 'visibility_off'" :size="18" />
        </button>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-body-medium" :class="isVisible(layer.id) ? 'text-on-surface' : 'text-on-surface-variant'">{{ layer.title }}</span>
          <span v-if="layer.description && !expanded" class="truncate text-label-small text-on-surface-variant">{{ layer.description }}</span>
        </div>
        <span v-if="isVisible(layer.id) && opacityOf(layer.id) < 1" class="rounded-full bg-primary/8 px-2 py-0.5 text-label-small tabular-nums text-primary">
          {{ Math.round(opacityOf(layer.id) * 100) }}%
        </span>
        <MIcon name="expand_more" :size="18" class="shrink-0 text-on-surface-variant transition-transform duration-300" :class="expanded ? 'rotate-180' : ''" />
      </div>
      <!-- Expands with grid rows 0fr → 1fr, so the height animates without measuring it -->
      <div class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)]" :style="{ gridTemplateRows: expanded ? '1fr' : '0fr' }">
        <div class="min-h-0 overflow-hidden">
          <div class="flex flex-col gap-3 px-3 pb-3">
            <p v-if="layer.description" class="text-body-small text-on-surface-variant">{{ layer.description }}</p>
            <div class="flex items-center gap-2 rounded-2xl bg-surface-container-highest/60 px-3 py-1">
              <MIcon name="opacity" :size="16" class="shrink-0 text-on-surface-variant" />
              <MSlider
                :model-value="opacityOf(layer.id)"
                :min="0"
                :max="1"
                :step="0.01"
                :label="t.mapOpacity"
                class="flex-1"
                @update:model-value="setOpacity(layer.id, Number($event))"
              />
            </div>
            <img v-if="layer.legend" :src="layer.legend" alt="" class="max-w-full self-start" loading="lazy">
            <div v-if="layer.download || $slots.actions" class="flex flex-wrap items-center gap-2">
              <a
                v-if="layer.download"
                :href="layer.download"
                target="_blank"
                rel="noopener"
                download
                class="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-label-large text-primary hover:bg-primary/8"
              >
                <MIcon name="download" :size="18" />
                {{ t.mapDownload }}
              </a>
              <slot name="actions" :layer="layer" :visible="isVisible(layer.id)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
