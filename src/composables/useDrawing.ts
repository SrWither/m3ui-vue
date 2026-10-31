import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { DrawItem, DrawLayer, DrawPen, DrawShapeKind } from './drawGeometry'

/** What a pointer does on an MDrawCanvas */
export type DrawTool = DrawPen | 'eraser' | 'stroke-eraser' | DrawShapeKind | 'text' | 'select' | 'pan'

export interface DrawExportOptions {
  /** In `mode="pages"`: the page to export (default 0) */
  page?: number
  /** PNG: pixels per drawing unit (default 2) */
  scale?: number
  /** Paint the paper color behind the drawing (default true) */
  background?: boolean
}

/** What an MDrawCanvas shares with MDrawToolbar, MDrawLayers and anything built with useDrawing() inside it */
export interface DrawContext {
  tool: Ref<DrawTool>
  color: Ref<string>
  size: Ref<number>
  /** New rects and ellipses are filled with the color */
  fill: Ref<boolean>
  items: ComputedRef<DrawItem[]>
  selection: Ref<string[]>
  layers: ComputedRef<DrawLayer[]>
  setLayers(layers: DrawLayer[]): void
  /** The layer new items go on */
  layer: Ref<string | undefined>
  mode: ComputedRef<'infinite' | 'pages'>
  pages: Ref<number>
  addPage(): void
  zoom: ComputedRef<number>
  zoomIn(): void
  zoomOut(): void
  fitView(): void
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  undo(): void
  redo(): void
  clear(): void
  deleteSelection(): void
  exportSvg(opts?: DrawExportOptions): string
  exportPng(opts?: DrawExportOptions): Promise<Blob>
}

export const DRAW_KEY: InjectionKey<DrawContext> = Symbol('m3-draw')

/** The surrounding MDrawCanvas' state and actions, for a toolbar or panel of your own inside it */
export function useDrawing(): DrawContext {
  const ctx = inject(DRAW_KEY, null)
  if (!ctx) throw new Error('useDrawing() must be called inside <MDrawCanvas>')
  return ctx
}
