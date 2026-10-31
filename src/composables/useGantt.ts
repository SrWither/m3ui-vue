import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { GanttCriticalPath, GanttDependency, GanttScheduleOptions, GanttTask } from './ganttSchedule'
import type { TimeUnit } from './_ganttTime'

/** MGantt's named zoom levels */
export type GanttScale = TimeUnit

/** A column of MGantt's task list */
export interface GanttColumn {
  /** `name`, `start`, `end`, `duration` and `progress` are built in; anything else reads `task.data[key]` (or the slot `#cell-<key>`) */
  key: string
  label?: string
  /** px; the `name` column takes what's left when it has none */
  width?: number
  align?: 'start' | 'center' | 'end'
  /** Text for a cell */
  format?: (task: GanttTask) => string
}

/** What MGantt provides to everything inside it (MGanttControls, panels of yours), and its template ref exposes */
export interface GanttContext {
  /** The tasks as drawn: summaries rolled up from their children */
  tasks: ComputedRef<GanttTask[]>
  selection: ComputedRef<string[]>
  /** The closest named scale to the zoom */
  scale: ComputedRef<GanttScale>
  /** The zoom, in px per day */
  pxPerDay: Readonly<Ref<number>>
  readonly: ComputedRef<boolean>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  /** Every task id whose children are hidden */
  collapsed: ComputedRef<string[]>
  undo(): void
  redo(): void
  zoomIn(): void
  zoomOut(): void
  setScale(scale: GanttScale): void
  /** Scrolls so a date (default now) sits at the view's `align` (default center) */
  scrollToDate(date?: string, opts?: { align?: 'start' | 'center'; animate?: boolean }): void
  /** Scrolls a task into view, its row and its bar */
  scrollToTask(id: string): void
  toggle(id: string, expanded?: boolean): void
  expandAll(): void
  collapseAll(): void
  setSelection(ids: string[]): void
  /** Adds tasks (after `after`, or at the end); undoable */
  addTasks(tasks: GanttTask | GanttTask[], opts?: { after?: string }): void
  updateTask(id: string, patch: Partial<GanttTask> | ((t: GanttTask) => GanttTask)): void
  /** Deletes tasks with their children and the dependencies on them */
  removeTasks(ids: string[]): void
  /** Makes `to` depend on `from` */
  link(from: string, to: string, type?: GanttDependency['type'], lag?: number): void
  unlink(from: string, to: string): void
  /** Runs `scheduleTasks` over the tasks with MGantt's calendar; undoable */
  schedule(options?: GanttScheduleOptions): void
  criticalPath: ComputedRef<GanttCriticalPath>
  /** The date (snapped) under a page x */
  dateAt(clientX: number): string
}

export const GANTT_KEY: InjectionKey<GanttContext> = Symbol('m3-gantt')

/** What MGanttControls drives, in an MGantt or an MResourceTimeline */
export interface TimelineControls {
  scale: ComputedRef<GanttScale>
  readonly: ComputedRef<boolean>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  /** Whether anything can fold (summaries, resource groups) and whether something is folded */
  foldable: ComputedRef<boolean>
  folded: ComputedRef<boolean>
  undo(): void
  redo(): void
  zoomIn(): void
  zoomOut(): void
  setScale(scale: GanttScale): void
  scrollToDate(date?: string): void
  expandAll(): void
  collapseAll(): void
}
export const TIMELINE_CONTROLS_KEY: InjectionKey<TimelineControls> = Symbol('m3-timeline-controls')

/**
 * The enclosing `<MGantt>`'s state and controls, from a component rendered in its default slot. Outside one, use
 * MGantt's template ref, which exposes the same.
 */
export function useGantt(): GanttContext {
  const ctx = inject(GANTT_KEY, null)
  if (!ctx) throw new Error('useGantt() must be called inside <MGantt>')
  return ctx
}
