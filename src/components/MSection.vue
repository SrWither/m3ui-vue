<script setup lang="ts">
import { computed } from 'vue'
import type { TextVariant } from './MText.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    divider?: boolean
    gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    titleVariant?: TextVariant
  }>(),
  { gap: 'md', divider: false, titleVariant: 'title-large' },
)

const gapClasses: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
}

const titleVariantClasses: Record<string, string> = {
  'display-large': 'text-display-large',
  'display-medium': 'text-display-medium',
  'display-small': 'text-display-small',
  'headline-large': 'text-headline-large',
  'headline-medium': 'text-headline-medium',
  'headline-small': 'text-headline-small',
  'title-large': 'text-title-large',
  'title-medium': 'text-title-medium',
  'title-small': 'text-title-small',
  'body-large': 'text-body-large',
  'body-medium': 'text-body-medium',
  'body-small': 'text-body-small',
  'label-large': 'text-label-large',
  'label-medium': 'text-label-medium',
  'label-small': 'text-label-small',
}

const contentGap = computed(() => gapClasses[props.gap])
const titleClass = computed(() => [titleVariantClasses[props.titleVariant], 'font-medium'])
</script>

<template>
  <section class="flex flex-col" :class="contentGap">
    <div v-if="title || subtitle || $slots.title || $slots.actions">
      <div class="flex items-start justify-between">
        <div>
          <slot name="title">
            <p v-if="title" :class="titleClass">{{ title }}</p>
          </slot>
          <slot name="subtitle">
            <p v-if="subtitle" class="mt-1 text-body-medium text-on-surface-variant">{{ subtitle }}</p>
          </slot>
        </div>
        <slot name="actions" />
      </div>
      <div v-if="divider" class="mt-4 h-px bg-outline-variant" />
    </div>
    <slot />
  </section>
</template>
