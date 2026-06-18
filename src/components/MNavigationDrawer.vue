<script setup lang="ts">
import { watch } from 'vue'
import MIcon from './MIcon.vue'

export interface DrawerItem {
  value: string | number
  label: string
  icon?: string
  badge?: string | number
  disabled?: boolean
}

export interface DrawerSection {
  title?: string
  items: DrawerItem[]
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  selected?: string | number
  sections: DrawerSection[]
  title?: string
  modal?: boolean
}>(), { modal: true })

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [string | number]
}>()

function close() { emit('update:modelValue', false) }
function select(item: DrawerItem) {
  if (item.disabled) return
  emit('select', item.value)
  if (props.modal) close()
}

watch(() => props.modelValue, (open) => {
  if (open) document.body.style.overflow = 'hidden'
  else document.body.style.overflow = ''
})
</script>

<template>
  <!-- Modal variant -->
  <Teleport v-if="modal" to="body">
    <Transition name="nd" :duration="{ enter: 300, leave: 280 }">
      <div v-if="modelValue" class="fixed inset-0 z-[100] flex">
        <!-- Scrim -->
        <div class="nd-scrim absolute inset-0 bg-black/40" @click="close" />

        <!-- Panel -->
        <nav class="nd-panel relative flex h-full w-72 max-w-[85vw] flex-col bg-surface-container shadow-elevation-3">
          <!-- Header -->
          <div v-if="title || $slots.header" class="shrink-0 px-5 pt-6 pb-2">
            <slot name="header">
              <h2 class="text-title-small font-medium text-on-surface-variant">{{ title }}</h2>
            </slot>
          </div>

          <!-- Sections -->
          <div class="flex-1 overflow-y-auto px-3 py-2">
            <template v-for="(section, si) in sections" :key="si">
              <div v-if="si > 0" class="my-2 border-t border-outline-variant" />
              <p v-if="section.title" class="px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant">
                {{ section.title }}
              </p>
              <button
                v-for="item in section.items"
                :key="item.value"
                type="button"
                class="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left transition-colors focus-visible:outline-none"
                :class="[
                  item.disabled
                    ? 'cursor-not-allowed opacity-[0.38]'
                    : item.value === selected
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
                ]"
                :disabled="item.disabled"
                @click="select(item)"
              >
                <MIcon v-if="item.icon" :name="item.icon" :size="24" />
                <span class="flex-1 text-label-large font-medium">{{ item.label }}</span>
                <span
                  v-if="item.badge != null"
                  class="text-label-medium text-on-surface-variant"
                >
                  {{ item.badge }}
                </span>
              </button>
            </template>
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>

  <!-- Standard (inline) variant -->
  <nav
    v-else
    class="flex h-full w-72 flex-col border-r border-outline-variant bg-surface"
  >
    <div v-if="title || $slots.header" class="shrink-0 px-5 pt-6 pb-2">
      <slot name="header">
        <h2 class="text-title-small font-medium text-on-surface-variant">{{ title }}</h2>
      </slot>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <template v-for="(section, si) in sections" :key="si">
        <div v-if="si > 0" class="my-2 border-t border-outline-variant" />
        <p v-if="section.title" class="px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant">
          {{ section.title }}
        </p>
        <button
          v-for="item in section.items"
          :key="item.value"
          type="button"
          class="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left transition-colors focus-visible:outline-none"
          :class="[
            item.disabled
              ? 'cursor-not-allowed opacity-[0.38]'
              : item.value === selected
                ? 'bg-secondary-container text-on-secondary-container'
                : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
          ]"
          :disabled="item.disabled"
          @click="select(item)"
        >
          <MIcon v-if="item.icon" :name="item.icon" :size="24" />
          <span class="flex-1 text-label-large font-medium">{{ item.label }}</span>
          <span v-if="item.badge != null" class="text-label-medium text-on-surface-variant">
            {{ item.badge }}
          </span>
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.nd-scrim {
  transition: opacity 280ms ease;
}
.nd-enter-from .nd-scrim,
.nd-leave-to .nd-scrim {
  opacity: 0;
}

.nd-panel {
  transition: transform 300ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-enter-from .nd-panel,
.nd-leave-to .nd-panel {
  transform: translateX(-100%);
}
</style>
