<script setup lang="ts">
import MButton from './MButton.vue'

const props = withDefaults(
  defineProps<{
    data: Record<string, unknown>[]
    format?: 'csv' | 'json'
    filename?: string
    label?: string
    icon?: string
    variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    disabled?: boolean
  }>(),
  {
    format: 'csv',
    filename: 'export',
    label: 'Export',
    icon: 'download',
    variant: 'outlined',
    size: 'sm',
    disabled: false,
  },
)

const emit = defineEmits<{ exported: [{ format: string; filename: string }]; error: [unknown] }>()

function escapeCsvField(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvField(row[h])).join(',')),
  ]
  return lines.join('\n')
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function onClick() {
  if (props.disabled) return
  try {
    const filename = `${props.filename}.${props.format}`
    if (props.format === 'json') {
      download(JSON.stringify(props.data, null, 2), filename, 'application/json')
    } else {
      download(toCsv(props.data), filename, 'text/csv')
    }
    emit('exported', { format: props.format, filename })
  } catch (err) {
    emit('error', err)
  }
}
</script>

<template>
  <MButton :variant="variant" :size="size" :icon="icon" :disabled="disabled" @click="onClick">
    <slot>{{ label }}</slot>
  </MButton>
</template>
