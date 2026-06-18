<script setup lang="ts">
import { ref, watch } from 'vue'
import MIcon from './MIcon.vue'

export interface DrawerItem {
  value: string | number
  label: string
  icon?: string
  badge?: string | number
  disabled?: boolean
  to?: string | Record<string, any>
}

export interface DrawerSection {
  title?: string
  icon?: string
  items: DrawerItem[]
  collapsible?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  selected?: string | number
  sections: DrawerSection[]
  title?: string
  modal?: boolean
  collapsed?: boolean
}>(), { modal: true })

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [string | number]
}>()

const openSections = ref<Record<string, boolean>>({})

function isSectionOpen(section: DrawerSection, index: number) {
  const key = section.title ?? `__${index}`
  return openSections.value[key] !== false
}

function toggleSection(section: DrawerSection, index: number) {
  const key = section.title ?? `__${index}`
  openSections.value[key] = !isSectionOpen(section, index)
}

function close() { emit('update:modelValue', false) }
function select(item: DrawerItem) {
  if (item.disabled) return
  emit('select', item.value)
  if (props.modal) close()
}

function itemTag(item: DrawerItem) {
  return item.to && !item.disabled ? 'RouterLink' : 'button'
}


watch(() => props.modelValue, (open) => {
  if (props.modal) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})
</script>

<template>
  <!-- ── Modal variant ──────────────────────────────────────── -->
  <Teleport v-if="modal" to="body">
    <Transition name="nd" :duration="{ enter: 300, leave: 280 }">
      <div v-if="modelValue" class="fixed inset-0 z-[100] flex">
        <div class="nd-scrim absolute inset-0 bg-black/40" @click="close" />

        <nav class="nd-panel relative flex h-full w-72 max-w-[85vw] flex-col bg-surface-container shadow-elevation-3">
          <div v-if="title || $slots.header" class="shrink-0 px-5 pt-6 pb-2">
            <slot name="header">
              <h2 class="text-title-small font-medium text-on-surface-variant">{{ title }}</h2>
            </slot>
          </div>

          <div class="flex-1 overflow-y-auto px-3 py-2">
            <template v-for="(section, si) in sections" :key="si">
              <div v-if="si > 0" class="my-1 border-t border-outline-variant" />

              <button
                v-if="section.title && section.collapsible"
                type="button"
                class="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-on-surface-variant transition-colors hover:bg-on-surface/8"
                @click="toggleSection(section, si)"
              >
                <MIcon v-if="section.icon" :name="section.icon" :size="24" class="shrink-0" />
                <span class="flex-1 text-left text-title-small font-medium">{{ section.title }}</span>
                <MIcon
                  :name="isSectionOpen(section, si) ? 'expand_less' : 'expand_more'"
                  :size="18"
                  class="shrink-0"
                />
              </button>
              <p v-else-if="section.title" class="px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant">
                {{ section.title }}
              </p>

              <Transition name="nd-section">
                <div v-if="!section.collapsible || isSectionOpen(section, si)" class="nd-section-grid">
                  <div class="nd-section-body">
                    <component
                      :is="itemTag(item)"
                      v-for="item in section.items"
                      :key="item.value"
                      :to="item.to && !item.disabled ? item.to : undefined"
                      :type="item.to ? undefined : 'button'"
                      class="flex w-full items-center gap-3 rounded-full py-2.5 text-left transition-colors focus-visible:outline-none"
                      :class="[
                        section.collapsible ? 'pl-8 pr-3' : 'px-4',
                        item.disabled
                          ? 'cursor-not-allowed opacity-[0.38]'
                          : item.value === selected
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
                      ]"
                      :disabled="item.disabled && !item.to"
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
                    </component>
                  </div>
                </div>
              </Transition>
            </template>
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Standard (inline) variant ──────────────────────────── -->
  <template v-else>
    <nav
      class="nd-inline flex h-full shrink-0 flex-col border-r border-outline-variant bg-surface"
      :class="collapsed ? 'nd-collapsed w-[72px]' : 'w-72'"
    >
      <div v-if="$slots.header" class="shrink-0">
        <slot name="header" />
      </div>
      <div v-else-if="title" class="nd-collapse-h shrink-0 overflow-hidden">
        <div class="px-5 pt-6 pb-2">
          <h2 class="whitespace-nowrap text-title-small font-medium text-on-surface-variant">{{ title }}</h2>
        </div>
      </div>

      <div class="flex flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <template v-for="(section, si) in sections" :key="si">
          <div v-if="si > 0" class="my-1 border-t border-outline-variant" />

          <!-- Collapsible section header -->
          <button
            v-if="section.title && section.collapsible"
            type="button"
            class="mt-1 flex w-full cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-on-surface-variant hover:bg-on-surface/8"
            :title="collapsed ? section.title : undefined"
            @click="toggleSection(section, si)"
          >
            <MIcon v-if="section.icon" :name="section.icon" :size="24" class="shrink-0" />
            <span class="min-w-0 flex-1 text-left text-title-small font-medium">{{ section.title }}</span>
            <MIcon
              :name="isSectionOpen(section, si) ? 'expand_less' : 'expand_more'"
              :size="18"
              class="shrink-0"
            />
          </button>

          <!-- Static section title -->
          <div v-else-if="section.title" class="nd-collapse-h overflow-hidden">
            <p class="whitespace-nowrap px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant">
              {{ section.title }}
            </p>
          </div>

          <Transition name="nd-section">
            <div v-if="!section.collapsible || isSectionOpen(section, si)" class="nd-section-grid">
              <div class="nd-section-body">
                <component
                  :is="itemTag(item)"
                  v-for="item in section.items"
                  :key="item.value"
                  :to="item.to && !item.disabled ? item.to : undefined"
                  :type="item.to ? undefined : 'button'"
                  :title="collapsed ? item.label : undefined"
                  class="flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-full py-2.5 text-left focus-visible:outline-none"
                  :class="[
                    section.collapsible && !collapsed ? 'pl-8 pr-3' : 'px-3',
                    item.disabled
                      ? 'cursor-not-allowed opacity-[0.38]'
                      : item.value === selected
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
                  ]"
                  :disabled="item.disabled && !item.to"
                  @click="select(item)"
                >
                  <MIcon v-if="item.icon" :name="item.icon" :size="24" class="shrink-0" />
                  <span class="min-w-0 flex-1 text-label-large font-medium">{{ item.label }}</span>
                  <span v-if="item.badge != null" class="text-label-medium text-on-surface-variant">
                    {{ item.badge }}
                  </span>
                </component>
              </div>
            </div>
          </Transition>
        </template>
      </div>
    </nav>

  </template>
</template>

<style scoped>
/* ── Modal transitions ─────────────────────────────────── */
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

/* ── Section collapse animation ────────────────────────── */
.nd-section-grid {
  display: grid;
  grid-template-rows: 1fr;
}
.nd-section-body {
  min-height: 0;
  overflow: hidden;
}

.nd-section-enter-active {
  transition: grid-template-rows 350ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-section-enter-active > .nd-section-body {
  transition: opacity 250ms 80ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-section-enter-from {
  grid-template-rows: 0fr;
}
.nd-section-enter-from > .nd-section-body {
  opacity: 0;
}

.nd-section-leave-active {
  transition: grid-template-rows 280ms cubic-bezier(0.4, 0, 1, 1);
}
.nd-section-leave-active > .nd-section-body {
  transition: opacity 150ms cubic-bezier(0.4, 0, 1, 1);
}
.nd-section-leave-to {
  grid-template-rows: 0fr;
}
.nd-section-leave-to > .nd-section-body {
  opacity: 0;
}

/* ── Inline sidebar width transition ───────────────────── */
.nd-inline {
  transition: width 300ms cubic-bezier(0.2, 0, 0, 1);
}

/* Elements that should collapse to 0 height when sidebar is collapsed */
.nd-inline .nd-collapse-h {
  max-height: 80px;
  transition: max-height 300ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-inline.nd-collapsed .nd-collapse-h {
  max-height: 0;
}

.nd-inline .nd-section-body > * {
  transition: padding 300ms cubic-bezier(0.2, 0, 0, 1);
}
</style>
