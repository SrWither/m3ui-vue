<script setup lang="ts">
/**
 * The layers of an MDrawCanvas (put it in its default slot, or anywhere inside it): pick the one you draw on, show or
 * hide, lock, rename (double-click), reorder, add and delete. Top layer first, as drawing apps list them. Deleting a
 * layer deletes what's on it. Not an M3 spec component.
 */
import { computed, inject, nextTick, ref } from 'vue'
import { DRAW_KEY } from '../composables/useDrawing'
import { drawId, type DrawLayer } from '../composables/drawGeometry'
import { useLocale } from '../composables/useLocale'
import MIconButton from './MIconButton.vue'
import MTooltip from './MTooltip.vue'

const draw = inject(DRAW_KEY, null)
if (!draw) throw new Error('MDrawLayers must be inside <MDrawCanvas>')
const d = draw
const locale = useLocale()

// Without layers the canvas has one implicit layer: the first edit here makes it real
const list = computed<DrawLayer[]>(() => (d.layers.value.length ? d.layers.value : [{ id: 'layer-1', name: locale.drawLayer.replace('{n}', '1') }]))
const shown = computed(() => list.value.slice().reverse())
const set = (next: DrawLayer[]) => d.setLayers(next)
const patch = (id: string, p: Partial<DrawLayer>) => set(list.value.map((l) => (l.id === id ? { ...l, ...p } : l)))
function add() {
  const l = { id: drawId(), name: locale.drawLayer.replace('{n}', String(list.value.length + 1)) }
  // Items drawn before there were layers stay on the first one
  set([...list.value, l])
  d.layer.value = l.id
}
function remove(id: string) {
  if (list.value.length < 2) return
  const first = list.value[0]!.id
  const gone = d.items.value.filter((i) => (i.layer ?? first) === id).map((i) => i.id)
  if (gone.length) {
    d.selection.value = gone
    d.deleteSelection()
  }
  const rest = list.value.filter((l) => l.id !== id)
  // Items with no layer belong to the first one: keep them there if the first goes
  set(rest)
  if (d.layer.value === id) d.layer.value = rest[rest.length - 1]!.id
}
function move(id: string, by: 1 | -1) {
  const i = list.value.findIndex((l) => l.id === id)
  const j = i + by
  if (j < 0 || j >= list.value.length) return
  const next = list.value.slice()
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  set(next)
}
const renaming = ref('')
const input = ref<HTMLInputElement[]>()
function startRename(id: string) {
  renaming.value = id
  nextTick(() => input.value?.[0]?.select())
}
function rename(id: string, name: string) {
  if (renaming.value !== id) return
  renaming.value = ''
  if (name.trim()) patch(id, { name: name.trim() })
}
</script>

<template>
  <div class="m3-draw-layers flex w-64 flex-col rounded-xl bg-surface-container p-2 text-on-surface shadow-elevation-2" role="group" :aria-label="locale.drawLayers">
    <div class="flex items-center pb-1 pl-2">
      <span class="flex-1 text-title-small">{{ locale.drawLayers }}</span>
      <MTooltip :text="locale.drawAddLayer" placement="left"><MIconButton icon="add" size="xs" :label="locale.drawAddLayer" @click="add" /></MTooltip>
    </div>
    <div
      v-for="l in shown"
      :key="l.id"
      class="group flex h-10 items-center gap-1 rounded-full pr-1 pl-3 text-body-medium"
      :class="d.layer.value === l.id ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-on-surface/8'"
    >
      <input
        v-if="renaming === l.id"
        ref="input"
        :value="l.name"
        :aria-label="locale.drawLayerName"
        class="h-7 min-w-0 flex-1 rounded-xs bg-surface px-1 ring-1 ring-primary outline-none"
        @keydown.enter="rename(l.id, ($event.target as HTMLInputElement).value)"
        @keydown.esc="renaming = ''"
        @blur="rename(l.id, ($event.target as HTMLInputElement).value)"
      />
      <button
        v-else
        type="button"
        class="min-w-0 flex-1 truncate text-left outline-none"
        :class="l.visible === false && 'opacity-50'"
        :aria-pressed="d.layer.value === l.id"
        @click="d.layer.value = l.id"
        @dblclick="startRename(l.id)"
      >{{ l.name }}</button>
      <MTooltip :text="l.visible === false ? locale.drawShowLayer : locale.drawHideLayer" placement="left"><MIconButton :icon="l.visible === false ? 'visibility_off' : 'visibility'" size="xs" :label="l.visible === false ? locale.drawShowLayer : locale.drawHideLayer" @click="patch(l.id, { visible: l.visible === false })" /></MTooltip>
      <MTooltip :text="l.locked ? locale.drawUnlockLayer : locale.drawLockLayer" placement="left"><MIconButton :icon="l.locked ? 'lock' : 'lock_open'" size="xs" :label="l.locked ? locale.drawUnlockLayer : locale.drawLockLayer" @click="patch(l.id, { locked: !l.locked })" /></MTooltip>
      <div class="hidden flex-col group-hover:flex group-focus-within:flex">
        <button type="button" class="h-4 leading-none text-on-surface-variant" :aria-label="locale.drawLayerUp" @click="move(l.id, 1)"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_drop_up</span></button>
        <button type="button" class="h-4 leading-none text-on-surface-variant" :aria-label="locale.drawLayerDown" @click="move(l.id, -1)"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_drop_down</span></button>
      </div>
      <MIconButton v-if="list.length > 1" icon="delete" size="xs" :label="locale.drawDeleteLayer" @click="remove(l.id)" />
    </div>
  </div>
</template>

<style>
@layer base {
  .m3-draw-layers {
    position: absolute;
    top: 16px;
    right: 16px;
  }
}
</style>
