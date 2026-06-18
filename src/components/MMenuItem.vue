<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{ icon?: string; to?: string | Record<string, any> }>(), {})

const tag = computed(() => props.to ? 'RouterLink' : 'button')
</script>

<template>
  <component
    :is="tag"
    :to="to || undefined"
    :type="to ? undefined : 'button'"
    class="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-body-large text-on-surface hover:bg-on-surface/8"
  >
    <MIcon v-if="icon" :name="icon" :size="20" class="text-on-surface-variant" />
    <slot />
  </component>
</template>
