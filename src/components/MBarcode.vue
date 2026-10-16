<script setup lang="ts">
/**
 * Renders a barcode as inline SVG. Available from the `/barcode` entry point.
 *
 * @slot error Shown instead of the SVG when value is invalid for the given format (e.g. a non-numeric EAN13)
 */
import { ref, watchEffect } from 'vue'
import JsBarcode from 'jsbarcode'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Data to encode. Required — there is no default. */
    value: string
    /** Barcode symbology. Common values: 'CODE128', 'EAN13', 'EAN8', 'UPC', 'CODE39', 'ITF14', 'MSI', 'pharmacode', 'codabar'. */
    format?: string
    /** Width of the narrowest bar, in px */
    width?: number
    /** Bar height in px */
    height?: number
    /** Show the encoded text below the bars */
    displayValue?: boolean
    /** Bar color */
    color?: string
    /** Background color */
    background?: string
    /** Quiet zone around the barcode, in px */
    margin?: number
    /** Font size for the displayed value */
    fontSize?: number
    /** aria-label for the svg. Defaults to value */
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
  <div v-if="error" v-bind="$attrs" class="flex items-center justify-center text-body-small text-error">
    <slot name="error">{{ error }}</slot>
  </div>
  <svg v-show="!error" v-bind="error ? {} : $attrs" ref="svgEl" role="img" :aria-label="label ?? value"></svg>
</template>
