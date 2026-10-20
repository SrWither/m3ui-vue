<script setup lang="ts">
/**
 * Identify results (from `MMapIdentify`'s `identify` event, or `identifyFeatures()`): a card per feature with its
 * layer's name and its formatted properties. `MMapIdentify` shows it in a popup; use it in a panel of your own (an
 * `MWindow`, an `MSideSheet`) the same way. Values are shown as text. Available from the `/map` entry point.
 *
 * @slot value A property's value (scope: `{ field, result }`), e.g. to turn URLs into links
 */
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import type { MapIdentifyResult } from '../composables/mapAdapters'

defineProps<{
  /** What was found */
  results: MapIdentifyResult[]
}>()

const t = useLocale()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(result, i) in results" :key="i" class="overflow-hidden rounded-2xl bg-surface-container">
      <div class="flex items-center gap-2 bg-primary-container/40 px-4 py-2">
        <MIcon name="layers" :size="16" class="text-on-primary-container" />
        <span class="text-label-large text-on-primary-container">{{ result.layer.title }}</span>
      </div>
      <dl class="flex flex-col px-4 py-1">
        <div v-for="field in result.fields" :key="field.key" class="flex flex-col gap-0.5 border-b border-outline-variant py-1.5 last:border-b-0">
          <dt class="text-label-small text-on-surface-variant">{{ field.label }}</dt>
          <dd class="text-body-medium text-on-surface">
            <slot name="value" :field="field" :result="result">
              <span v-if="field.value" class="break-words">{{ field.value }}</span>
              <span v-else class="text-body-small italic text-on-surface-variant">{{ t.mapNoValue }}</span>
            </slot>
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
