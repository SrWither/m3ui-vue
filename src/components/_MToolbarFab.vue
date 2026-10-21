<script setup lang="ts">
// The box MToolbar's #fab slot renders in: tells an MFab inside that the toolbar sizes it (it fills this box, which
// grows from 56 to 80px as the toolbar collapses) and which color to default to. A component of its own so only
// the slot's FAB sees it, not one inside the toolbar's items.
import { provide } from 'vue'

const props = defineProps<{ color: 'primary' | 'tertiary' }>()

provide('m-toolbar-fab', props)
</script>

<template>
  <slot />
</template>
