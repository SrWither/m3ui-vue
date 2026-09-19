<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'elevated' | 'filled' | 'outlined'
    clickable?: boolean
    elevated?: boolean
    disabled?: boolean
    /** src URL for a full-bleed header image */
    image?: string
    imageAlt?: string
    imageHeight?: string
    title?: string
    subtitle?: string
  }>(),
  { variant: 'elevated', clickable: false, elevated: false, disabled: false },
)

const resolvedVariant = computed(() => (props.elevated ? 'elevated' : props.variant))

// Expose the card's background as --field-bg so outlined text-field labels
// inside the card automatically match without needing the fieldBg prop.
const fieldBgByVariant: Record<string, string> = {
  elevated: 'var(--color-surface-container-low)',
  filled: 'var(--color-surface-container-highest)',
  outlined: 'var(--color-surface)',
}

/*
 * M3 Card{Filled,Elevated,Outlined}Tokens: all three variants share ContainerShape =
 * CornerMedium (12px), so a flat `rounded-md` on the wrapper (below) is correct for all of
 * them already — no per-variant shape difference. Container color/border IS mutually
 * exclusive between the disabled and enabled cases on purpose (a single computed picking
 * ONE class set, never both at once): two competing `bg-*`/`border-*` utilities for the
 * same CSS property risk losing to each other based on Tailwind's compiled-CSS source
 * order rather than which one appears later in this class list — bit us for real on
 * MIconButton's `relative`/`absolute` and would bite here too with `bg-surface-variant`
 * vs `bg-surface-container-highest` fighting over `background-color`.
 *
 * Disabled colors are real per-variant token overrides (elevated swaps to plain `surface`,
 * filled to `surface-variant`), not just a dimmed version of the resting color, all at 38%
 * container opacity EXCEPT outlined, which keeps its background as-is and only dims the
 * border — to a *different* color too (`outline` at 12%, not the resting `outline-variant`).
 * The opacity is applied via Tailwind's `/38` color-opacity modifier on the background
 * color itself (`bg-surface/38`), not a `opacity-*` utility on the whole element — the
 * real Compose Card only dims the container color, not its content/text, and a plain
 * `opacity-*` class would incorrectly wash out the card's text/icons along with it.
 */
const containerClasses = computed(() => {
  const map = props.disabled
    ? {
        elevated: 'bg-surface/38 shadow-none',
        filled: 'bg-surface-variant/38',
        outlined: 'bg-surface border border-outline/12',
      }
    : {
        elevated: 'bg-surface-container-low shadow-elevation-1',
        filled: 'bg-surface-container-highest',
        outlined: 'bg-surface border border-outline-variant',
      }
  return map[resolvedVariant.value]
})

/*
 * Hover/pressed elevation differ per variant — only `elevated` goes up to Level2 on hover
 * and stays at Level1 while pressed; `filled`/`outlined` only reach Level1 on hover and
 * drop back to flat (Level0/`shadow-none`) while pressed, they never match elevated's
 * pressed-but-still-elevated Level1. Focus indicator also differs: elevated/filled get a
 * `secondary` ring (FocusIndicatorColor) since they have no border to repurpose; outlined
 * instead darkens its own border to `on-surface` (FocusOutlineColor) rather than adding a
 * separate ring on top of the border it already has.
 */
const clickableClasses: Record<string, string> = {
  elevated: 'hover:shadow-elevation-2 active:shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary',
  filled: 'hover:shadow-elevation-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary',
  outlined: 'hover:shadow-elevation-1 active:shadow-none focus-visible:outline-none focus-visible:border-on-surface',
}

// State layer (8% hover / 12% active), same before:-pseudo pattern as MButton/MFab.
// Needed because the card has a real background to preserve underneath — unlike
// MListItem, a plain hover:bg-on-surface/8 here would replace the card's own tone.
const stateLayerClasses =
  'relative ' +
  "before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-on-surface before:opacity-0 before:transition-opacity before:duration-150 ' +
  'hover:before:opacity-[0.08] active:before:opacity-[0.12]'

const isInteractive = computed(() => props.clickable && !props.disabled)

// A plain div has no native :disabled/keyboard behavior — role="button" + tabindex make it
// reachable and identifiable, and Enter/Space here replicate a real button's activation
// keys by just triggering a native click on the root, so whatever @click listener the
// consumer attached (via plain attribute fallthrough, since MCard doesn't declare an emit
// for this) fires exactly as it would for a mouse click, with no separate code path needed.
function onKeydown(event: KeyboardEvent) {
  if (!isInteractive.value) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).click()
  }
}
</script>

<template>
  <div
    class="overflow-hidden rounded-md transition-shadow duration-150"
    :class="[
      containerClasses,
      isInteractive ? ['cursor-pointer', clickableClasses[resolvedVariant], stateLayerClasses] : '',
      disabled ? 'cursor-not-allowed pointer-events-none' : '',
    ]"
    :style="{ '--field-bg': fieldBgByVariant[resolvedVariant] }"
    :role="clickable ? 'button' : undefined"
    :tabindex="isInteractive ? 0 : undefined"
    :aria-disabled="clickable && disabled ? 'true' : undefined"
    @keydown="onKeydown"
  >
    <!-- Optional header image -->
    <div v-if="image || $slots.media" :class="['w-full overflow-hidden', imageHeight ?? 'h-48']">
      <img
        v-if="image"
        :src="image"
        :alt="imageAlt ?? ''"
        class="h-full w-full object-cover"
      />
      <slot v-else name="media" />
    </div>

    <div v-if="$slots.header" class="px-4 pt-4 pb-2">
      <slot name="header" />
    </div>
    <div v-else-if="title" class="px-4 pt-4 pb-2">
      <h3 class="text-title-large font-medium text-on-surface">{{ title }}</h3>
      <p v-if="subtitle" class="mt-1 text-body-medium text-on-surface-variant">{{ subtitle }}</p>
    </div>

    <slot />

    <div v-if="$slots.actions" class="flex justify-end gap-2 px-4 pt-2 pb-4">
      <slot name="actions" />
    </div>
  </div>
</template>
