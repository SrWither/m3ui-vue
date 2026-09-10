<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import JsBarcode from 'jsbarcode'

const props = withDefaults(
  defineProps<{
    value: string
    /** Barcode symbology. Common values: 'CODE128', 'EAN13', 'EAN8', 'UPC', 'CODE39', 'ITF14', 'MSI', 'pharmacode', 'codabar'. */
    format?: string
    width?: number
    height?: number
    displayValue?: boolean
    color?: string
    background?: string
    margin?: number
    fontSize?: number
    label?: string
  }>(),
  {
    format: 'CODE128',
    width: 2,
    height: 80,
    displayValue: true,
    color: '#000000',
    background: '#ffffff',
    margin: 10,
    fontSize: 20,
  },
)

const svgEl = ref<SVGSVGElement | null>(null)
const error = ref<string | null>(null)

// flush: 'post' runs synchronously right after (re-)render, once the ref is
// attached — the default 'pre' flush defers the first run to a microtask
// after the ref is set, which is later than callers expect a mount to settle.
watchEffect(() => {
  if (!svgEl.value) return
  error.value = null
  JsBarcode(svgEl.value, props.value, {
    format: props.format,
    width: props.width,
    height: props.height,
    displayValue: props.displayValue,
    lineColor: props.color,
    background: props.background,
    margin: props.margin,
    fontSize: props.fontSize,
    valid: (ok) => {
      if (!ok) error.value = `Invalid value "${props.value}" for format "${props.format}"`
    },
  })
}, { flush: 'post' })
</script>

<template>
  <div v-if="error" class="flex items-center justify-center text-body-small text-error">
    <slot name="error">{{ error }}</slot>
  </div>
  <svg v-show="!error" ref="svgEl" role="img" :aria-label="label ?? value"></svg>
</template>
