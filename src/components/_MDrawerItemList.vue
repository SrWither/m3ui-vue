<script lang="ts">
import { defineComponent, inject, type PropType, type Ref } from 'vue'
import type { DrawerItem } from './MNavigationDrawer.vue'
import MIcon from './MIcon.vue'

export default defineComponent({
  name: 'MDrawerItemList',
  components: { MIcon },
  props: {
    items: { type: Array as PropType<DrawerItem[]>, required: true },
    selected: { type: [String, Number] as PropType<string | number>, default: undefined },
    depth: { type: Number, default: 0 },
  },
  setup() {
    const openItems = inject<Record<string | number, boolean>>('nd-open-items')!
    const toggleItem = inject<(item: DrawerItem) => void>('nd-toggle-item')!
    const selectItem = inject<(item: DrawerItem) => void>('nd-select-item')!
    const collapsed = inject<Ref<boolean>>('nd-collapsed')!
    return { openItems, toggleItem, selectItem, collapsed }
  },
  methods: {
    itemTag(item: DrawerItem) {
      return item.to && !item.disabled ? 'RouterLink' : 'button'
    },
    onClick(item: DrawerItem) {
      if (item.children?.length) this.toggleItem(item)
      this.selectItem(item)
    },
    itemStyle(item: DrawerItem): Record<string, string> {
      const transition = 'padding 300ms cubic-bezier(0.2, 0, 0, 1)'
      if (this.collapsed) {
        const pad = `${(48 - this.iSize(item)) / 2}px`
        return { paddingLeft: pad, paddingRight: pad, transition }
      }
      return { paddingLeft: `${this.depth * 1.25 + 3}rem`, paddingRight: '0.75rem', transition }
    },
    iSize(item: DrawerItem): number {
      return item.iconSize ?? 20
    },
    lClass(item: DrawerItem): string {
      return item.labelClass ?? 'text-label-medium'
    },
    onEnter(el: Element, done: () => void) {
      const e = el as HTMLElement
      e.style.overflow = 'hidden'
      const h = e.scrollHeight
      e.animate(
        [{ height: '0px' }, { height: h + 'px' }],
        { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      ).onfinish = () => { e.style.overflow = ''; done() }
    },
    onLeave(el: Element, done: () => void) {
      const e = el as HTMLElement
      e.style.overflow = 'hidden'
      const h = e.scrollHeight
      e.animate(
        [{ height: h + 'px' }, { height: '0px' }],
        { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
      ).onfinish = done
    },
  },
})
</script>

<template>
  <template v-for="item in items" :key="item.value">
    <component
      :is="itemTag(item)"
      :to="item.to && !item.disabled ? item.to : undefined"
      :type="item.to ? undefined : 'button'"
      :title="collapsed ? item.label : undefined"
      class="flex w-full shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-full text-left transition-colors focus-visible:outline-none"
      :class="[
        item.py ?? 'py-1.5',
        item.disabled
          ? 'cursor-not-allowed opacity-[0.38]'
          : item.value === selected
            ? 'bg-secondary-container text-on-secondary-container'
            : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
      ]"
      :style="itemStyle(item)"
      :disabled="item.disabled && !item.to"
      @click="onClick(item)"
    >
      <MIcon v-if="item.icon" :name="item.icon" :size="iSize(item)" class="shrink-0" />
      <span class="nd-label min-w-0 flex-1" :class="lClass(item)">{{ item.label }}</span>
      <MIcon
        v-if="item.children?.length"
        :name="openItems[item.value] ? 'expand_less' : 'expand_more'"
        :size="16"
        class="nd-label shrink-0 text-on-surface-variant"
      />
    </component>

    <Transition :css="false" @enter="onEnter" @leave="onLeave">
      <div v-if="item.children?.length && openItems[item.value]">
        <MDrawerItemList
          :items="item.children"
          :selected="selected"
          :depth="depth + 1"
        />
      </div>
    </Transition>
  </template>
</template>
