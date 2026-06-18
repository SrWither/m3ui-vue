<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  status: 'success' | 'error' | 'warning' | 'info' | '404' | '403' | '500'
  title?: string
  description?: string
}>(), {})

const config = computed(() => {
  switch (props.status) {
    case 'success': return { icon: 'check_circle',  bg: 'bg-success-container', text: 'text-on-success-container', defaultTitle: 'Operación exitosa',       defaultDesc: 'La acción se completó correctamente.' }
    case 'error':   return { icon: 'error',          bg: 'bg-error-container',   text: 'text-on-error-container',   defaultTitle: 'Algo salió mal',          defaultDesc: 'Ocurrió un error inesperado. Inténtalo de nuevo.' }
    case 'warning': return { icon: 'warning',        bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', defaultTitle: 'Atención',             defaultDesc: 'Hay algo que requiere tu atención.' }
    case 'info':    return { icon: 'info',           bg: 'bg-primary-container', text: 'text-on-primary-container', defaultTitle: 'Información',             defaultDesc: '' }
    case '404':     return { icon: 'search_off',     bg: 'bg-surface-container-high', text: 'text-on-surface-variant', defaultTitle: 'Página no encontrada', defaultDesc: 'La página que buscas no existe o fue movida.' }
    case '403':     return { icon: 'lock',           bg: 'bg-error-container',   text: 'text-on-error-container',   defaultTitle: 'Acceso denegado',         defaultDesc: 'No tienes permisos para ver este recurso.' }
    case '500':     return { icon: 'cloud_off',      bg: 'bg-error-container',   text: 'text-on-error-container',   defaultTitle: 'Error del servidor',      defaultDesc: 'El servidor no pudo procesar la solicitud.' }
    default:        return { icon: 'info',           bg: 'bg-surface-container-high', text: 'text-on-surface-variant', defaultTitle: '',                     defaultDesc: '' }
  }
})

const httpCode = computed(() => {
  if (props.status === '404' || props.status === '403' || props.status === '500') return props.status
  return null
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-14 text-center">
    <!-- HTTP code -->
    <span v-if="httpCode" class="text-display-small font-medium text-on-surface-variant/30">
      {{ httpCode }}
    </span>

    <!-- Icon -->
    <div class="flex h-20 w-20 items-center justify-center rounded-full" :class="[config.bg, config.text]">
      <MIcon :name="config.icon" :size="40" />
    </div>

    <!-- Title -->
    <h2 class="text-headline-small font-medium text-on-surface">
      {{ title ?? config.defaultTitle }}
    </h2>

    <!-- Description -->
    <p v-if="description ?? config.defaultDesc" class="max-w-md text-body-large text-on-surface-variant">
      {{ description ?? config.defaultDesc }}
    </p>

    <!-- Actions slot -->
    <div v-if="$slots.actions" class="mt-2 flex flex-wrap items-center justify-center gap-3">
      <slot name="actions" />
    </div>

    <!-- Extra content -->
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
