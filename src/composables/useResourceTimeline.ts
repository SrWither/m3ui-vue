import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { GanttScale } from './useGantt'

/** A booking on a resource's row: a shift, a reservation, a job */
export interface TimelineEvent<D = any> {
  id: string
  /** The resource (row) it's on */
  resourceId: string
  /** A datetime (`YYYY-MM-DDTHH:mm`, local, or ISO with a zone), or `YYYY-MM-DD` for whole days */
  start: string
  /** A datetime is when it ends; a date is the last day (inclusive) */
  end: string
  title: string
  subtitle?: string
  /** An M3 role (default the resource's, else `primary`) */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'neutral'
  /** `false` keeps it from being moved (in time or to another resource), resized, deleted or selected */
  draggable?: boolean
  resizable?: boolean
  deletable?: boolean
  selectable?: boolean
  class?: string
  data?: D
}

/** A row: a person, a table, a room, a machine */
export interface TimelineResource<D = any> {
  id: string
  name: string
  subtitle?: string
  /** Rows with the same group sit under a header that folds */
  group?: string
  /** A picture; else `icon`, else initials */
  avatar?: string
  icon?: string
  color?: TimelineEvent['color']
  /** Bookings it can hold at once before they conflict (default 1) */
  capacity?: number
  data?: D
}

/** What MResourceTimeline provides to components in its default slot, and its template ref exposes */
export interface ResourceTimelineContext {
  events: ComputedRef<TimelineEvent[]>
  selection: ComputedRef<string[]>
  /** Ids of events that overlap more than their resource's capacity */
  conflicts: ComputedRef<Set<string>>
  scale: ComputedRef<GanttScale>
  pxPerDay: Readonly<Ref<number>>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  undo(): void
  redo(): void
  zoomIn(): void
  zoomOut(): void
  setScale(scale: GanttScale): void
  scrollToDate(date?: string, opts?: { align?: 'start' | 'center'; animate?: boolean }): void
  scrollToEvent(id: string): void
  setSelection(ids: string[]): void
  addEvents(events: TimelineEvent | TimelineEvent[]): void
  updateEvent(id: string, patch: Partial<TimelineEvent> | ((e: TimelineEvent) => TimelineEvent)): void
  removeEvents(ids: string[]): void
  /** The time (snapped, as a datetime) under a page x */
  dateAt(clientX: number): string
  /** The resource whose row is under a page y */
  resourceAt(clientY: number): TimelineResource | undefined
}

export const RESOURCE_TIMELINE_KEY: InjectionKey<ResourceTimelineContext> = Symbol('m3-resource-timeline')

/** The enclosing `<MResourceTimeline>`'s state and controls, from a component in its default slot */
export function useResourceTimeline(): ResourceTimelineContext {
  const ctx = inject(RESOURCE_TIMELINE_KEY, null)
  if (!ctx) throw new Error('useResourceTimeline() must be called inside <MResourceTimeline>')
  return ctx
}
