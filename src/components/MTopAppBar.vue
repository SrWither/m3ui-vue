<script setup lang="ts">
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'

withDefaults(defineProps<{
  title?: string
  variant?: 'center' | 'small' | 'medium' | 'large'
  navigationIcon?: string
  elevated?: boolean
  bordered?: boolean
}>(), { variant: 'small' })

defineEmits<{ navigation: [] }>()
</script>

<template>
  <header
    class="flex w-full flex-col bg-surface transition-shadow"
    :class="[elevated ? 'shadow-elevation-2' : '', bordered ? 'border-b border-outline-variant' : '']"
  >
    <!-- Top row -->
    <div class="flex h-16 items-center gap-1 px-4">
      <!-- Navigation -->
      <slot name="navigation">
        <MIconButton
          v-if="navigationIcon"
          :icon="navigationIcon"
          label="Navegación"
          @click="$emit('navigation')"
        />
      </slot>

      <!-- Title: center or small variant -->
      <h1
        v-if="variant === 'center' || variant === 'small'"
        class="flex flex-1 items-center truncate px-4 text-title-large text-on-surface"
        :class="variant === 'center' ? 'justify-center' : ''"
      >
        <slot name="title">{{ title }}</slot>
      </h1>

      <!-- Spacer for medium/large (title is below) -->
      <div v-else class="flex-1" />

      <!-- Trailing actions -->
      <div v-if="$slots.actions" class="flex items-center gap-1">
        <slot name="actions" />
      </div>
    </div>

    <!-- Large title row for medium/large variants -->
    <div
      v-if="variant === 'medium' || variant === 'large'"
      class="px-4 pb-6"
      :class="variant === 'large' ? 'pt-4' : 'pt-1'"
    >
      <h1
        class="text-on-surface"
        :class="variant === 'large' ? 'text-headline-medium' : 'text-headline-small'"
      >
        <slot name="title">{{ title }}</slot>
      </h1>
    </div>
  </header>
</template>
