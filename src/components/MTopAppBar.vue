<script setup lang="ts">
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

withDefaults(defineProps<{
  title?: string
  variant?: 'center' | 'small' | 'medium' | 'large'
  navigationIcon?: string
  /** Accessible label for the navigation icon button — defaults to the
   *  locale's generic "Menu" label; override when navigationIcon is
   *  actually a back arrow rather than a drawer toggle. */
  navigationLabel?: string
  elevated?: boolean
  bordered?: boolean
}>(), { variant: 'small' })

defineEmits<{ navigation: [] }>()

const locale = useLocale()
</script>

<template>
  <header
    class="flex w-full flex-col transition-[background-color,box-shadow]"
    :class="[
      // AppBarTokens: ContainerColor=Surface/Elevation=Level0 at rest, but
      // OnScrollContainerColor=SurfaceContainer/OnScrollContainerElevation=Level2 together once
      // scrolled — `elevated` swaps both, not just the shadow.
      elevated ? 'bg-surface-container shadow-elevation-2' : 'bg-surface',
      bordered ? 'border-b border-outline-variant' : '',
    ]"
  >
    <!-- Top row — 64dp per M3's TopAppBarSmall/collapsed-Medium/collapsed-Large tokens -->
    <div class="flex h-16 shrink-0 items-center gap-1 px-1">
      <!-- Navigation -->
      <slot name="navigation">
        <MIconButton
          v-if="navigationIcon"
          :icon="navigationIcon"
          :label="navigationLabel ?? locale.menu"
          style="color: var(--color-on-surface)"
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

    <!-- Large title row for medium/large variants — total container height
         112dp (medium) / 152dp (large) per M3's AppBarMedium/LargeTokens,
         i.e. 48px / 88px added below the 64px top row. Bottom padding is
         MediumTitleBottomPadding=24dp / LargeTitleBottomPadding=28dp. -->
    <div
      v-if="variant === 'medium' || variant === 'large'"
      class="flex items-end px-4"
      :class="variant === 'large' ? 'h-[88px] pb-7' : 'h-12 pb-6'"
    >
      <h1
        class="truncate text-on-surface"
        :class="variant === 'large' ? 'text-headline-medium' : 'text-headline-small'"
      >
        <slot name="title">{{ title }}</slot>
      </h1>
    </div>
  </header>
</template>
