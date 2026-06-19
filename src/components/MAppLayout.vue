<script setup lang="ts">
withDefaults(
  defineProps<{
    drawerWidth?: string
  }>(),
  { drawerWidth: 'auto' },
)
</script>

<template>
  <div class="flex h-dvh w-full overflow-hidden bg-surface text-on-surface">
    <!-- Drawer -->
    <aside v-if="$slots.drawer" class="shrink-0" :style="{ width: drawerWidth !== 'auto' ? drawerWidth : undefined }">
      <slot name="drawer" />
    </aside>

    <!-- Main area -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Header -->
      <header v-if="$slots.header" class="shrink-0">
        <slot name="header" />
      </header>

      <!-- Content -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>

      <!-- Footer -->
      <footer v-if="$slots.footer" class="shrink-0">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>
