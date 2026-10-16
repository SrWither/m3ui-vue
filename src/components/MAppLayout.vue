<script setup lang="ts">
/**
 * Full app shell — drawer, header, content, footer, and fab slots.
 *
 * @slot drawer Side navigation (e.g. MNavigationDrawer). Use drawerRight prop to place it on the right.
 * @slot header Top bar (e.g. MTopAppBar)
 * @slot default Main scrollable content
 * @slot footer Bottom bar or status area
 * @slot fab Floating elements (e.g. MFab) rendered outside the scroll area
 */
import { computed } from 'vue'

const props = defineProps<{
  /** Container height (CSS value). Use "100%" to fit inside a parent instead of the viewport. */
  height?: string
  /** Place the drawer slot on the right side of the layout */
  drawerRight?: boolean
}>()

const style = computed(() => ({
  height: props.height || '100dvh',
}))
</script>

<template>
  <div class="flex w-full overflow-hidden bg-surface text-on-surface" :style="style">
    <!-- Drawer -->
    <aside v-if="$slots.drawer" class="shrink-0" :class="drawerRight ? 'order-2' : ''">
      <slot name="drawer" />
    </aside>

    <!-- Main area -->
    <div class="relative flex min-w-0 flex-1 flex-col" :class="drawerRight ? 'order-1' : ''">
      <!-- Header -->
      <header v-if="$slots.header" class="shrink-0">
        <slot name="header" />
      </header>

      <!-- Content -->
      <main class="min-h-0 flex-1 overflow-y-auto">
        <slot />
      </main>

      <!-- Footer -->
      <footer v-if="$slots.footer" class="shrink-0">
        <slot name="footer" />
      </footer>

      <!-- Fab / floating elements — rendered outside the scroll area -->
      <slot name="fab" />
    </div>
  </div>
</template>
