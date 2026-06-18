<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

export interface HotkeyBinding {
  keys: string
  label: string
  handler: () => void
  group?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    bindings: HotkeyBinding[]
    showOverlay?: boolean
  }>(),
  { showOverlay: false },
)

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

function formatKey(raw: string): string {
  return raw
    .replace(/mod/gi, isMac ? '⌘' : 'Ctrl')
    .replace(/ctrl/gi, isMac ? '⌃' : 'Ctrl')
    .replace(/alt/gi, isMac ? '⌥' : 'Alt')
    .replace(/shift/gi, isMac ? '⇧' : 'Shift')
    .replace(/meta/gi, '⌘')
    .replace(/enter/gi, '↵')
    .replace(/escape/gi, 'Esc')
    .replace(/backspace/gi, '⌫')
    .replace(/delete/gi, '⌦')
    .replace(/arrowup/gi, '↑')
    .replace(/arrowdown/gi, '↓')
    .replace(/arrowleft/gi, '←')
    .replace(/arrowright/gi, '→')
}

function parseCombo(keys: string) {
  return keys.split('+').map(k => k.trim().toLowerCase())
}

function matchesEvent(combo: string[], e: KeyboardEvent): boolean {
  const modifiers = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, mod: isMac ? e.metaKey : e.ctrlKey }
  const key = e.key.toLowerCase()

  for (const part of combo) {
    if (part in modifiers) {
      if (!modifiers[part as keyof typeof modifiers]) return false
    } else if (key !== part) {
      return false
    }
  }

  for (const [mod, active] of Object.entries(modifiers)) {
    if (active && !combo.includes(mod)) return false
  }

  return true
}

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

  for (const binding of props.bindings) {
    if (binding.disabled) continue
    const combo = parseCombo(binding.keys)
    const hasModifier = combo.some(k => ['ctrl', 'alt', 'shift', 'meta', 'mod'].includes(k))
    if (!hasModifier && editable) continue
    if (matchesEvent(combo, e)) {
      e.preventDefault()
      binding.handler()
      return
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const grouped = () => {
  const map = new Map<string, HotkeyBinding[]>()
  for (const b of props.bindings) {
    const g = b.group ?? ''
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(b)
  }
  return map
}
</script>

<template>
  <div v-if="showOverlay" class="flex flex-col gap-4">
    <template v-for="[group, bindings] in grouped()" :key="group">
      <div>
        <p v-if="group" class="mb-2 text-label-small font-medium tracking-wide text-on-surface-variant uppercase">
          {{ group }}
        </p>
        <div class="flex flex-col gap-1">
          <div
            v-for="b in bindings"
            :key="b.keys"
            class="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-on-surface/4"
            :class="b.disabled && 'opacity-38'"
          >
            <span class="text-body-medium text-on-surface">{{ b.label }}</span>
            <div class="flex items-center gap-0.5">
              <kbd
                v-for="(k, ki) in b.keys.split('+')"
                :key="ki"
                class="inline-flex min-w-[24px] items-center justify-center rounded bg-surface-container px-1.5 py-0.5 text-center text-label-small font-medium text-on-surface-variant"
              >
                {{ formatKey(k.trim()) }}
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
