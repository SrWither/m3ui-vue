<script setup lang="ts">
import { ref, reactive, watch, provide, computed } from "vue";
import MIcon from "./MIcon.vue";
import MDrawerItemList from "./_MDrawerItemList.vue";

export interface DrawerItem {
  value: string | number;
  label: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
  to?: string | Record<string, any>;
  children?: DrawerItem[];
  iconSize?: number;
  labelClass?: string;
  py?: string;
  click?: () => void;
}

export interface DrawerSection {
  title?: string;
  icon?: string;
  items: DrawerItem[];
  collapsible?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    selected?: string | number;
    sections: DrawerSection[];
    title?: string;
    modal?: boolean;
    collapsed?: boolean;
    width?: string;
    side?: 'left' | 'right' | 'top' | 'bottom';
  }>(),
  { modal: true, side: 'left' },
);

const emit = defineEmits<{
  "update:modelValue": [boolean];
  select: [string | number];
}>();

const openSections = ref<Record<string, boolean>>({});
const openItems = reactive<Record<string | number, boolean>>({});

function isSectionOpen(section: DrawerSection, index: number) {
  const key = section.title ?? `__${index}`;
  return openSections.value[key] !== false;
}

function toggleSection(section: DrawerSection, index: number) {
  const key = section.title ?? `__${index}`;
  openSections.value[key] = !isSectionOpen(section, index);
}

function isItemOpen(item: DrawerItem) {
  return openItems[item.value] === true;
}

function toggleItem(item: DrawerItem) {
  openItems[item.value] = !openItems[item.value];
}

function close() {
  emit("update:modelValue", false);
}
function select(item: DrawerItem) {
  if (item.disabled) return;
  if (item.children?.length) toggleItem(item);
  item.click?.()
  emit("select", item.value);
  if (props.modal && !item.children?.length) close();
}

function onChildSelect(item: DrawerItem) {
  if (item.disabled) return;
  item.click?.()
  emit("select", item.value);
  if (props.modal && !item.children?.length) close();
}

function onChildToggle(item: DrawerItem) {
  openItems[item.value] = !openItems[item.value];
}

function subEnter(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.overflow = 'hidden'
  const h = e.scrollHeight
  e.animate(
    [{ height: '0px' }, { height: h + 'px' }],
    { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  ).onfinish = () => { e.style.overflow = ''; done() }
}
function subLeave(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.overflow = 'hidden'
  const h = e.scrollHeight
  e.animate(
    [{ height: h + 'px' }, { height: '0px' }],
    { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
  ).onfinish = done
}

const inlineSide = computed(() => props.side === 'left' || props.side === 'right' ? props.side : 'left')
const collapsedRef = computed(() => props.collapsed ?? false)
provide("nd-open-items", openItems);
provide("nd-toggle-item", onChildToggle);
provide("nd-select-item", onChildSelect);
provide("nd-collapsed", collapsedRef);

defineExpose({ openItems })

function itemTag(item: DrawerItem) {
  return item.to && !item.disabled ? "RouterLink" : "button";
}

watch(
  () => props.modelValue,
  (open) => {
    if (props.modal) {
      document.body.style.overflow = open ? "hidden" : "";
    }
  },
);
</script>

<template>
  <!-- ── Modal variant ──────────────────────────────────────── -->
  <Teleport v-if="modal" to="body">
    <Transition name="nd" :duration="{ enter: 300, leave: 280 }">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex"
        :class="[
          side === 'right' ? 'justify-end' : '',
          side === 'bottom' ? 'flex-col justify-end' : '',
          side === 'top' ? 'flex-col' : '',
        ]"
      >
        <div class="nd-scrim absolute inset-0 bg-black/40" @click="close" />

        <nav
          :class="[
            'nd-panel relative flex flex-col bg-surface-container shadow-elevation-3',
            `nd-panel-${side}`,
            side === 'top' || side === 'bottom'
              ? 'w-full max-h-[85vh]'
              : 'h-full max-w-[85vw]',
            side === 'top' || side === 'bottom' || width ? '' : 'w-72',
          ]"
          :style="side !== 'top' && side !== 'bottom' && width ? { width } : undefined"
        >
          <div v-if="$slots.header" class="shrink-0">
            <slot name="header" />
          </div>
          <div v-else-if="title" class="shrink-0 px-5 pt-6 pb-2">
            <h2 class="text-title-small font-medium text-on-surface-variant">
              {{ title }}
            </h2>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2">
            <template v-for="(section, si) in sections" :key="si">
              <div v-if="si > 0" class="my-1 border-t border-outline-variant" />

              <button
                v-if="section.title && section.collapsible"
                type="button"
                class="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-on-surface-variant transition-colors hover:bg-on-surface/8"
                @click="toggleSection(section, si)"
              >
                <MIcon
                  v-if="section.icon"
                  :name="section.icon"
                  :size="24"
                  class="shrink-0"
                />
                <span class="flex-1 text-left text-title-small font-medium">{{
                  section.title
                }}</span>
                <MIcon
                  :name="
                    isSectionOpen(section, si) ? 'expand_less' : 'expand_more'
                  "
                  :size="18"
                  class="shrink-0"
                />
              </button>
              <p
                v-else-if="section.title"
                class="px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant"
              >
                {{ section.title }}
              </p>

              <Transition name="nd-section">
                <div
                  v-if="!section.collapsible || isSectionOpen(section, si)"
                  class="nd-section-grid"
                >
                  <div class="nd-section-body">
                    <template v-for="item in section.items" :key="item.value">
                      <component
                        :is="itemTag(item)"
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
                        <MIcon v-if="item.icon" :name="item.icon" :size="item.iconSize ?? 24" />
                        <span class="flex-1 font-medium" :class="item.labelClass ?? 'text-label-large'">{{
                          item.label
                        }}</span>
                        <MIcon
                          v-if="item.children?.length"
                          :name="
                            isItemOpen(item) ? 'expand_less' : 'expand_more'
                          "
                          :size="18"
                          class="shrink-0 text-on-surface-variant"
                        />
                        <span
                          v-else-if="item.badge != null"
                          class="text-label-medium text-on-surface-variant"
                        >
                          {{ item.badge }}
                        </span>
                      </component>
                      <Transition
                        name="nd-sub"
                        :css="false"
                        @enter="subEnter"
                        @leave="subLeave"
                      >
                        <div
                          v-if="item.children?.length && isItemOpen(item)"
                        >
                          <MDrawerItemList
                            :items="item.children"
                            :selected="selected"
                          />
                        </div>
                      </Transition>
                    </template>
                  </div>
                </div>
              </Transition>
            </template>
            <slot />
          </div>
        </nav>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Standard (inline) variant ──────────────────────────── -->
  <template v-else>
    <nav
      class="nd-inline flex h-full shrink-0 flex-col bg-surface"
      :class="[
        inlineSide === 'right' ? 'border-l border-outline-variant' : 'border-r border-outline-variant',
        !modelValue
          ? inlineSide === 'right' ? 'nd-hidden w-0 border-l-0' : 'nd-hidden w-0 border-r-0'
          : collapsed
            ? 'nd-collapsed w-[72px]'
            : width ? '' : 'w-72',
      ]"
      :style="{ width: modelValue && !collapsed && width ? width : undefined, '--nd-width': width ?? '18rem' }"
    >
      <div v-if="$slots.toggle" class="nd-toggle shrink-0 border-b border-outline-variant">
        <div class="nd-toggle-inner">
          <slot name="toggle" />
        </div>
      </div>
      <div v-if="$slots.header" class="shrink-0">
        <slot name="header" />
      </div>
      <div v-else-if="title" class="nd-collapse-h shrink-0 overflow-hidden">
        <div class="px-5 pt-6 pb-2">
          <h2
            class="whitespace-nowrap text-title-small font-medium text-on-surface-variant"
          >
            {{ title }}
          </h2>
        </div>
      </div>

      <div
        class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        <template v-for="(section, si) in sections" :key="si">
          <div v-if="si > 0" class="my-1 border-t border-outline-variant" />

          <!-- Collapsible section header -->
          <button
            v-if="section.title && section.collapsible"
            type="button"
            class="mt-1 flex w-full shrink-0 cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-on-surface-variant hover:bg-on-surface/8"
            :title="collapsed ? section.title : undefined"
            @click="toggleSection(section, si)"
          >
            <MIcon
              v-if="section.icon"
              :name="section.icon"
              :size="24"
              class="shrink-0"
            />
            <span
              class="nd-label min-w-0 flex-1 text-left text-title-small font-medium"
              >{{ section.title }}</span
            >
            <MIcon
              :name="isSectionOpen(section, si) ? 'expand_less' : 'expand_more'"
              :size="18"
              class="nd-label shrink-0"
            />
          </button>

          <!-- Static section title -->
          <div v-else-if="section.title" class="nd-collapse-h shrink-0 overflow-hidden">
            <p
              class="whitespace-nowrap px-4 pt-4 pb-2 text-title-small font-medium text-on-surface-variant"
            >
              {{ section.title }}
            </p>
          </div>

          <Transition name="nd-section">
            <div
              v-if="!section.collapsible || isSectionOpen(section, si)"
              class="nd-section-grid"
            >
              <div class="nd-section-body">
                <template v-for="item in section.items" :key="item.value">
                  <component
                    :is="itemTag(item)"
                    :to="item.to && !item.disabled ? item.to : undefined"
                    :type="item.to ? undefined : 'button'"
                    :title="collapsed ? item.label : undefined"
                    class="flex w-full shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap rounded-full py-2.5 text-left focus-visible:outline-none"
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
                    <MIcon
                      v-if="item.icon"
                      :name="item.icon"
                      :size="item.iconSize ?? 24"
                      class="shrink-0"
                    />
                    <span
                      class="nd-label min-w-0 flex-1 font-medium"
                      :class="item.labelClass ?? 'text-label-large'"
                      >{{ item.label }}</span
                    >
                    <MIcon
                      v-if="item.children?.length"
                      :name="isItemOpen(item) ? 'expand_less' : 'expand_more'"
                      :size="18"
                      class="nd-label shrink-0 text-on-surface-variant"
                    />
                    <span
                      v-else-if="item.badge != null"
                      class="nd-label text-label-medium text-on-surface-variant"
                    >
                      {{ item.badge }}
                    </span>
                  </component>
                  <div v-if="item.children?.length && isItemOpen(item)" class="nd-children-divider" />
                  <Transition
                    :css="false"
                    @enter="subEnter"
                    @leave="subLeave"
                  >
                    <div
                      v-if="item.children?.length && isItemOpen(item)"
                    >
                      <MDrawerItemList
                        :items="item.children"
                        :selected="selected"
                      />
                    </div>
                  </Transition>
                  <div v-if="item.children?.length && isItemOpen(item)" class="nd-children-divider" />
                </template>
              </div>
            </div>
          </Transition>
        </template>
        <slot />
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
.nd-enter-from .nd-panel-left,
.nd-leave-to .nd-panel-left {
  transform: translateX(-100%);
}
.nd-enter-from .nd-panel-right,
.nd-leave-to .nd-panel-right {
  transform: translateX(100%);
}
.nd-enter-from .nd-panel-top,
.nd-leave-to .nd-panel-top {
  transform: translateY(-100%);
}
.nd-enter-from .nd-panel-bottom,
.nd-leave-to .nd-panel-bottom {
  transform: translateY(100%);
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
  overflow: hidden;
}

/* Freeze layout so content clips like a curtain during open/close */
.nd-inline > * {
  min-width: var(--nd-width, 18rem);
}
/* Collapse-to-icons: let children adapt to 72px width */
.nd-inline.nd-collapsed > * {
  min-width: 0;
}

/* Toggle slot: icon stays anchored while border spans full width */
.nd-toggle {
  display: flex;
  align-items: center;
}
.nd-toggle-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 64px;
  flex-shrink: 0;
}

/* Collapse-to-icons: fade out labels before width squishes them */
.nd-label {
  transition: opacity 200ms 80ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-inline.nd-collapsed .nd-label,
.nd-inline.nd-collapsed :deep(.nd-label) {
  opacity: 0;
  transition: opacity 100ms cubic-bezier(0.2, 0, 0, 1);
}

/* Elements that should collapse to 0 height when sidebar is collapsed */
.nd-inline .nd-collapse-h {
  max-height: 80px;
  transition: max-height 300ms cubic-bezier(0.2, 0, 0, 1);
}
.nd-inline.nd-collapsed .nd-collapse-h {
  max-height: 0;
}

.nd-inline .nd-section-body > *,
.nd-inline :deep(.nd-section-body) > * {
  transition: padding 300ms cubic-bezier(0.2, 0, 0, 1);
}

/* Dividers between children groups — only visible in collapsed mode */
.nd-children-divider {
  height: 0;
  margin: 0 0.75rem;
  border-top: 1px solid transparent;
  transition: border-color 100ms, margin 100ms;
}
.nd-inline.nd-collapsed .nd-children-divider {
  border-top-color: var(--color-outline-variant);
  margin: 0.25rem 0.75rem;
  transition: border-color 200ms 300ms, margin 200ms 300ms;
}

</style>
