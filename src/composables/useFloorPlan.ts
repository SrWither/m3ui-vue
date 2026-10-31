import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { M3Locale } from './useLocale'
import type { FloorArea, FloorDecor, FloorDecorKind, FloorMerge, FloorPick, FloorStatus, FloorTable, FloorWall } from '../components/MFloorPlan.vue'

export type FloorTool = 'select' | 'wall' | 'area'
export type FloorItemKind = 'table' | 'area' | 'wall' | 'decor'

/**
 * An MFloorPlan's state and actions. MFloorPlanToolbar and MFloorPlanInspector are built on it, and so can controls
 * of your own: inside the plan's slots with `useFloorPlan()`, or anywhere from its template ref (`plan.context`).
 * Every edit made through it is a step of the plan's undo history.
 */
export interface FloorPlanContext {
  tables: Ref<FloorTable[]>
  areas: Ref<FloorArea[]>
  walls: Ref<FloorWall[]>
  decor: Ref<FloorDecor[]>
  merges: Ref<FloorMerge[]>
  selection: Ref<(string | number)[]>
  picked: Ref<FloorPick>
  tool: Ref<FloorTool>
  editable: ComputedRef<boolean>
  /** A wall is being drawn (tool `wall`): finish it (also double-click / Enter) or cancel it (Escape) */
  drawingWall: ComputedRef<boolean>
  finishWall(): void
  cancelWall(): void
  /** The decor kinds: built-in ones merged with `decorKinds` */
  kinds: ComputedRef<Record<string, FloorDecorKind>>
  statuses: ComputedRef<Record<string, FloorStatus>>
  /** The plan's size in plan units */
  size: ComputedRef<{ width: number; height: number }>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  undo(): void
  redo(): void
  /** Adds a table (at the plan's middle unless placed; numbered after the highest numbered one) and selects it */
  addTable(table?: Partial<FloorTable>): FloorTable
  /** Adds a decor item of a kind and picks it */
  addDecor(kind: string, item?: Partial<FloorDecor>): FloorDecor
  /** Changes one item (consecutive changes to the same item within a moment are one undo step) */
  update(kind: 'table', id: string | number, patch: Partial<FloorTable>): void
  update(kind: 'area', id: string | number, patch: Partial<FloorArea>): void
  update(kind: 'wall', id: string | number, patch: Partial<FloorWall>): void
  update(kind: 'decor', id: string | number, patch: Partial<FloorDecor>): void
  /** Removes what's picked (a wall's picked corner, or the whole item), or else the selected tables */
  removeSelected(): void
  removeTables(ids: (string | number)[]): void
  /** Copies the selected tables, or the picked zone or decor */
  duplicate(): void
  merge(ids?: (string | number)[], label?: string): FloorMerge | null
  split(idOrTable: string | number): void
}

export const FLOOR_PLAN_KEY: InjectionKey<FloorPlanContext> = Symbol('m3-floor-plan')

/** The enclosing MFloorPlan's state and actions (inside its slots) */
export function useFloorPlan(): FloorPlanContext {
  const ctx = inject(FLOOR_PLAN_KEY, null)
  if (!ctx) throw new Error('useFloorPlan() must be called inside <MFloorPlan> (or pass the plan to your component)')
  return ctx
}

const BUILTIN_NAMES: Record<string, keyof M3Locale> = {
  door: 'floorDecorDoor', window: 'floorDecorWindow', plant: 'floorDecorPlant', column: 'floorDecorColumn', restroom: 'floorDecorRestroom',
  kitchen: 'floorDecorKitchen', register: 'floorDecorRegister', stairs: 'floorDecorStairs', label: 'floorDecorLabel',
}
const BUILTIN_LABELS = new Set(['Door', 'Window', 'Plant', 'Column', 'Restroom', 'Kitchen', 'Register', 'Stairs', 'Label'])
/** A decor kind's name: a built-in one in the app's language (unless renamed), else its label or key */
export function floorDecorName(kind: string, kinds: Record<string, FloorDecorKind>, locale: M3Locale): string {
  const k = kinds[kind]
  if (BUILTIN_NAMES[kind] && (!k?.label || BUILTIN_LABELS.has(k.label))) return locale[BUILTIN_NAMES[kind]!] as string
  return k?.label ?? kind
}
