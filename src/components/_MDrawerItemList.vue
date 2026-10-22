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
    const rail = inject<Ref<boolean>>('nd-rail')!
    const collapsedLabels = inject<Ref<boolean>>('nd-collapsed-labels')!
    return { openItems, toggleItem, selectItem, collapsed, rail, collapsedLabels }
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
      if (this.rail) {
        // Same 56px rail item as the top level: icon centered in the 56×32 pill, label below at 40px
        const side = `${(56 - this.iSize(item)) / 2}px`
        const top = (32 - this.iSize(item)) / 2 + 4
        return { paddingLeft: side, paddingRight: side, paddingTop: `${top}px`, paddingBottom: `${56 - top - this.iSize(item)}px`, transition }
      }
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
      class="relative flex w-full shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap text-left transition-colors focus-visible:outline-none"
      :class="[
        rail ? '' : ['rounded-full', item.py ?? 'py-1.5'],
        item.disabled
          ? 'cursor-not-allowed opacity-[0.38]'
          : item.value === selected
            ? rail ? 'text-on-secondary-container' : 'bg-secondary-container text-on-secondary-container'
            : rail ? 'group cursor-pointer text-on-surface-variant' : 'cursor-pointer text-on-surface-variant hover:bg-on-surface/8',
      ]"
      :style="itemStyle(item)"
      :disabled="item.disabled && !item.to"
      @click="onClick(item)"
    >
      <span
        v-if="rail"
        aria-hidden="true"
        class="pointer-events-none absolute left-0 top-1 h-8 w-14 rounded-full transition-colors"
        :class="item.value === selected && !item.disabled ? 'bg-secondary-container' : 'group-hover:bg-on-surface/8'"
      />
      <MIcon v-if="item.icon" :name="item.icon" :size="iSize(item)" class="relative shrink-0" />
      <span class="nd-label min-w-0 flex-1" :class="lClass(item)">{{ item.label }}</span>
      <MIcon
        v-if="item.children?.length"
        :name="openItems[item.value] ? 'expand_less' : 'expand_more'"
        :size="16"
        class="nd-label shrink-0 text-on-surface-variant"
      />
      <span
        v-if="collapsedLabels"
        class="nd-rail-label pointer-events-none absolute left-0 top-10 w-14 truncate text-center text-label-medium font-medium"
        :class="item.value === selected ? 'text-secondary' : 'text-on-surface-variant'"
      >{{ item.label }}</span>
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
