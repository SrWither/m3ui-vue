<script setup lang="ts">
/**
 * A top app bar in four M3 layouts — center-aligned, small, medium, and large — with a leading navigation icon
 * and trailing actions.
 *
 * @slot navigation Custom leading area (default: an MIconButton built from the navigationIcon prop)
 * @slot title Custom title content (default: renders the title prop)
 * @slot actions Trailing action buttons
 * @event navigation Emitted when the default navigation icon button is clicked (not emitted when the
 *   #navigation slot is overridden — that content is fully custom)
 */
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

withDefaults(defineProps<{
  /** App bar title */
  title?: string
  /** 64dp small/center-aligned row, or a 112dp medium / 152dp large two-row layout with the title below */
  variant?: 'center' | 'small' | 'medium' | 'large'
  /** Leading icon (e.g. menu, arrow_back) */
  navigationIcon?: string
  /** Accessible label for the navigation icon button — defaults to the
   *  locale's generic "Menu" label; override when navigationIcon is
   *  actually a back arrow rather than a drawer toggle. */
  navigationLabel?: string
  /**
   * Swaps both container color (surface → surface-container) and elevation (level 0 → level 2), matching the
   * real M3 on-scroll container tokens rather than just adding a shadow
   */
  elevated?: boolean
  /** Add a bottom border (border-outline-variant) */
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
    <!-- Top row — 64dp per M3's TopAppBarSmall/collapsed-Medium/collapsed-Large tokens.
         px-2: TopAppBarHorizontalPadding (4dp) + the 4dp IconButton() gets for free from
         Modifier.minimumInteractiveComponentSize() centering its 40dp visible container inside
         a 48dp touch target — MIconButton doesn't implement that invisible expansion, so it's
         folded into this row padding instead to land the icon glyph at the real 16dp inset. -->
    <div class="flex h-16 shrink-0 items-center gap-1 px-2">
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
