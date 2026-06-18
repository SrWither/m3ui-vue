<script setup lang="ts">
import { ref } from 'vue'
import MContextMenuPanel from './_MContextMenuPanel.vue'

export interface ContextMenuItem {
  label?: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  divider?: boolean
  children?: ContextMenuItem[]
  onClick?: () => void
}

defineProps<{ items: ContextMenuItem[] }>()

const visible = ref(false)
const position = ref({ x: 0, y: 0 })

function show(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  showAt(e.clientX, e.clientY)
}

function showAt(x: number, y: number) {
  position.value = { x, y }
  visible.value = true
}

function hide() {
  visible.value = false
}

defineExpose({ show, showAt, hide })
</script>

<template>
  <slot :show="show" />

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-75"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-[200]"
        @mousedown.self="hide"
        @contextmenu.prevent
      >
        <MContextMenuPanel
          :items="items"
          :x="position.x"
          :y="position.y"
          @close="hide"
        />
      </div>
    </Transition>
  </Teleport>
</template>
