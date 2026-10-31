<script setup lang="ts">
/**
 * A floating toolbar for an MDrawCanvas (put it in its default slot): select and pan, the pens, the erasers, shapes
 * (with fill), text, colors, sizes, undo and redo. Pens, erasers and shapes are each one button that remembers the
 * last one picked, with a menu for the others. Sits at the bottom center by default (style its root to move it).
 * Not an M3 spec component.
 *
 * @slot default More controls at the start
 * @slot end More controls at the end
 */
import { computed, inject, ref, watch } from 'vue'
import { DRAW_KEY, type DrawTool } from '../composables/useDrawing'
import { useLocale, type M3Locale } from '../composables/useLocale'
import MIconButton from './MIconButton.vue'
import MMenu from './MMenu.vue'
import MMenuItem from './MMenuItem.vue'
import MTooltip from './MTooltip.vue'
import MColorPickerModal from './MColorPickerModal.vue'

const props = withDefaults(defineProps<{
  /** The tools offered (in groups: pens, erasers and shapes share a button each) */
  tools?: DrawTool[]
  /** Color swatches */
  colors?: string[]
  /** Sizes offered (pen width; a shape's line is the same, text is 4× it) */
  sizes?: number[]
  /** Undo and redo */
  history?: boolean
  /** A button that opens a color picker for any color */
  customColor?: boolean
}>(), {
  tools: () => ['select', 'pan', 'pen', 'brush', 'marker', 'highlighter', 'eraser', 'stroke-eraser', 'line', 'arrow', 'rect', 'ellipse', 'text'],
  colors: () => ['#1d1b20', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ffffff'],
  sizes: () => [2, 4, 8, 16],
  history: true,
  customColor: true,
})

const draw = inject(DRAW_KEY, null)
if (!draw) throw new Error('MDrawToolbar must be inside <MDrawCanvas>')
const d = draw
const locale = useLocale()

const INFO: Record<DrawTool, { icon: string; key: keyof M3Locale }> = {
  select: { icon: 'arrow_selector_tool', key: 'drawSelect' },
  pan: { icon: 'pan_tool', key: 'drawPan' },
  pen: { icon: 'ink_pen', key: 'drawPen' },
  brush: { icon: 'brush', key: 'drawBrush' },
  marker: { icon: 'stylus_note', key: 'drawMarker' },
  highlighter: { icon: 'ink_highlighter', key: 'drawHighlighter' },
  eraser: { icon: 'ink_eraser', key: 'drawEraser' },
  'stroke-eraser': { icon: 'backspace', key: 'drawStrokeEraser' },
  line: { icon: 'pen_size_2', key: 'drawLine' },
  arrow: { icon: 'arrow_right_alt', key: 'drawArrow' },
  rect: { icon: 'rectangle', key: 'drawRect' },
  ellipse: { icon: 'circle', key: 'drawEllipse' },
  text: { icon: 'text_fields', key: 'drawText' },
}
const GROUPS: DrawTool[][] = [['select'], ['pan'], ['pen', 'brush', 'marker', 'highlighter'], ['eraser', 'stroke-eraser'], ['line', 'arrow', 'rect', 'ellipse'], ['text']]
const groups = computed(() => GROUPS.map((g) => g.filter((t) => props.tools.includes(t))).filter((g) => g.length))
// Each group's button shows the last tool picked from it
const last = ref<Record<number, DrawTool>>({})
const shownTool = (g: DrawTool[], i: number) => (g.includes(d.tool.value) ? d.tool.value : last.value[i] ?? g[0]!)
watch(d.tool, (t) => {
  const i = groups.value.findIndex((g) => g.includes(t))
  if (i >= 0) last.value = { ...last.value, [i]: t }
}, { immediate: true })
const isShape = computed(() => ['rect', 'ellipse'].includes(d.tool.value))
const label = (t: DrawTool) => locale[INFO[t].key] as string
const picking = ref(false)
// A color that isn't one of the swatches shows on the custom button
const isCustom = computed(() => !props.colors.some((c) => c.toLowerCase() === d.color.value.toLowerCase()))
</script>

<template>
  <div class="m3-draw-toolbar flex max-w-[calc(100%-16px)] items-center gap-0.5 overflow-x-auto rounded-full bg-surface-container px-2 py-1 text-on-surface shadow-elevation-3 [scrollbar-width:none]" role="toolbar" :aria-label="locale.drawTools">
    <slot />
    <template v-for="(g, i) in groups" :key="i">
      <MTooltip v-if="g.length === 1" :text="label(g[0]!)" placement="top"><MIconButton
       
        :icon="INFO[g[0]!].icon"
        :label="label(g[0]!)"
        :variant="d.tool.value === g[0] ? 'filled' : 'standard'"
        :aria-pressed="d.tool.value === g[0]"
        @click="d.tool.value = g[0]!"
      /></MTooltip>
      <div v-else class="flex items-center">
        <MTooltip :text="label(shownTool(g, i))" placement="top"><MIconButton
          :icon="INFO[shownTool(g, i)].icon"
          :label="label(shownTool(g, i))"
          :variant="g.includes(d.tool.value) ? 'filled' : 'standard'"
          :aria-pressed="g.includes(d.tool.value)"
          @click="d.tool.value = shownTool(g, i)"
        /></MTooltip>
        <MMenu>
          <template #trigger>
            <button type="button" class="flex h-10 w-4 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8" :aria-label="locale.drawMore">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_drop_down</span>
            </button>
          </template>
          <MMenuItem v-for="t in g" :key="t" :icon="INFO[t].icon" :selected="d.tool.value === t" @click="d.tool.value = t">{{ label(t) }}</MMenuItem>
        </MMenu>
      </div>
    </template>
    <MTooltip v-if="isShape" :text="locale.drawFill" placement="top"><MIconButton
     
      icon="format_color_fill"
      :label="locale.drawFill"
      :variant="d.fill.value ? 'tonal' : 'standard'"
      :aria-pressed="d.fill.value"
      @click="d.fill.value = !d.fill.value"
    /></MTooltip>
    <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
    <button
      v-for="c in colors"
      :key="c"
      type="button"
      class="m-0.5 size-7 shrink-0 rounded-full border border-outline-variant outline-offset-2 transition-[outline-color] duration-150"
      :class="d.color.value.toLowerCase() === c.toLowerCase() ? 'outline-2 outline-primary' : 'outline-2 outline-transparent'"
      :style="{ background: c }"
      :aria-label="`${locale.drawColor} ${c}`"
      :aria-pressed="d.color.value.toLowerCase() === c.toLowerCase()"
      @click="d.color.value = c"
    />
    <MTooltip v-if="customColor" :text="locale.drawCustomColor" placement="top">
      <button
        type="button"
        class="m-0.5 flex size-7 shrink-0 items-center justify-center rounded-full outline-offset-2 transition-[outline-color] duration-150"
        :class="isCustom ? 'outline-2 outline-primary' : 'outline-2 outline-transparent'"
        :style="{ background: isCustom ? d.color.value : 'conic-gradient(#f44336, #ffeb3b, #4caf50, #00bcd4, #3f51b5, #e91e63, #f44336)' }"
        :aria-label="locale.drawCustomColor"
        :aria-pressed="isCustom"
        @click="picking = true"
      >
        <span v-if="!isCustom" class="material-symbols-outlined text-[16px] text-white drop-shadow" aria-hidden="true">add</span>
      </button>
    </MTooltip>
    <MColorPickerModal v-if="customColor" v-model="d.color.value" v-model:show="picking" />
    <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
    <button
      v-for="s in sizes"
      :key="s"
      type="button"
      class="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
      :class="d.size.value === s ? 'bg-secondary-container' : 'hover:bg-on-surface/8'"
      :aria-label="`${locale.drawSize} ${s}`"
      :aria-pressed="d.size.value === s"
      @click="d.size.value = s"
    >
      <span class="rounded-full bg-on-surface" :style="{ width: `${Math.min(20, Math.max(3, s * 1.2))}px`, height: `${Math.min(20, Math.max(3, s * 1.2))}px` }" />
    </button>
    <template v-if="history">
      <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
      <MTooltip :text="locale.drawUndo" placement="top"><MIconButton icon="undo" :label="locale.drawUndo" :disabled="!d.canUndo.value" @click="d.undo()" /></MTooltip>
      <MTooltip :text="locale.drawRedo" placement="top"><MIconButton icon="redo" :label="locale.drawRedo" :disabled="!d.canRedo.value" @click="d.redo()" /></MTooltip>
    </template>
    <MTooltip v-if="d.selection.value.length" :text="locale.drawDelete" placement="top"><MIconButton icon="delete" :label="locale.drawDelete" @click="d.deleteSelection()" /></MTooltip>
    <slot name="end" />
  </div>
</template>

<style>
@layer base {
  .m3-draw-toolbar {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
