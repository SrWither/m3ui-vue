<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 24 })
</script>

<template>
  <span class="material-symbols-outlined leading-none" :style="{ fontSize: `${size}px` }">{{
    name
  }}</span>
</template>
