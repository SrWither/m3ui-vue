<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    drawerWidth?: string
    height?: string
  }>(),
  { drawerWidth: 'auto' },
)

const style = computed(() => ({
  height: props.height || '100dvh',
}))
</script>

<template>
  <div class="flex w-full overflow-hidden bg-surface text-on-surface" :style="style">
    <!-- Drawer -->
    <aside v-if="$slots.drawer" class="shrink-0" :style="{ width: drawerWidth !== 'auto' ? drawerWidth : undefined }">
      <slot name="drawer" />
    </aside>

    <!-- Main area -->
    <div class="relative flex min-w-0 flex-1 flex-col">
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
