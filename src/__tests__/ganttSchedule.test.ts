import { describe, it, expect } from 'vitest'
import { addWorkingDays, criticalPath, rollupSummaries, scheduleTasks, workingDays, type GanttTask } from '../composables/ganttSchedule'
import { snapTime, unitsFor, parseDate, formatDate } from '../composables/_ganttTime'

const T = (id: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask => ({ id, name: id, start, end, ...extra })
const byId = (ts: GanttTask[]) => Object.fromEntries(ts.map((t) => [t.id, t]))

describe('gantt time', () => {
  it('parses and formats local dates and datetimes', () => {
    expect(formatDate(parseDate('2026-03-05'), true)).toBe('2026-03-05')
    expect(formatDate(parseDate('2026-03-05T09:30'), false)).toBe('2026-03-05T09:30')
    expect(formatDate(snapTime(parseDate('2026-03-05T09:38'), 15), false)).toBe('2026-03-05T09:45')
    expect(formatDate(snapTime(parseDate('2026-03-05T13:00'), 1440), true)).toBe('2026-03-06')
  })
  it('picks header units that fit their labels', () => {
    expect(unitsFor(1152)).toEqual({ bottom: 'hour', top: 'day', step: 1 })
    expect(unitsFor(240)).toEqual({ bottom: 'hour', top: 'day', step: 6 })
    expect(unitsFor(40)).toMatchObject({ bottom: 'day', top: 'month' })
    expect(unitsFor(20)).toMatchObject({ bottom: 'week', top: 'month' })
    expect(unitsFor(5)).toMatchObject({ bottom: 'month', top: 'year' })
    expect(unitsFor(1.2).bottom).toBe('quarter')
    expect(unitsFor(0.3).bottom).toBe('year')
  })
})

describe('working days', () => {
  it('counts and adds them around weekends and holidays', () => {
    // 2026-03-06 is a Friday
    expect(workingDays('2026-03-06', '2026-03-09')).toBe(2)
    expect(addWorkingDays('2026-03-06', 1)).toBe('2026-03-09')
    expect(addWorkingDays('2026-03-07', 0)).toBe('2026-03-09')
    expect(addWorkingDays('2026-03-06', 1, { holidays: ['2026-03-09'] })).toBe('2026-03-10')
    expect(addWorkingDays('2026-03-09', -1)).toBe('2026-03-06')
  })
})

describe('rollupSummaries', () => {
  it('gives summaries the span of their tasks and weighted progress, nested', () => {
    const tasks = [
      T('p', '2026-01-01', '2026-01-01'),
      T('s', '2026-01-01', '2026-01-01', { parentId: 'p' }),
      T('a', '2026-01-05', '2026-01-06', { parentId: 's', progress: 100 }),
      T('b', '2026-01-07', '2026-01-12', { parentId: 's', progress: 0 }),
      T('c', '2026-01-20', '2026-01-21', { parentId: 'p', progress: 50 }),
    ]
    const r = byId(rollupSummaries(tasks))
    expect(r.s).toMatchObject({ start: '2026-01-05', end: '2026-01-12', progress: 25 })
    expect(r.p).toMatchObject({ start: '2026-01-05', end: '2026-01-21' })
    // Unchanged → same array
    const once = rollupSummaries(tasks)
    expect(rollupSummaries(once)).toBe(once)
  })
})

describe('scheduleTasks', () => {
  it('pushes successors past their predecessors, for every dependency type and lag', () => {
    const tasks = [
      T('a', '2026-01-05', '2026-01-09'),
      T('fs', '2026-01-06', '2026-01-07', { dependencies: ['a'] }),
      T('ss', '2026-01-01', '2026-01-02', { dependencies: [{ id: 'a', type: 'SS', lag: 2 }] }),
      T('ff', '2026-01-01', '2026-01-03', { dependencies: [{ id: 'a', type: 'FF' }] }),
      T('late', '2026-02-01', '2026-02-02', { dependencies: ['a'] }),
      T('chain', '2026-01-01', '2026-01-01', { dependencies: ['fs'] }),
    ]
    const r = byId(scheduleTasks(tasks))
    expect(r.fs).toMatchObject({ start: '2026-01-10', end: '2026-01-11' })
    expect(r.ss).toMatchObject({ start: '2026-01-07', end: '2026-01-08' })
    expect(r.ff).toMatchObject({ start: '2026-01-07', end: '2026-01-09' })
    // Push mode leaves a task that's already late enough alone; asap pulls it back
    expect(r.late!.start).toBe('2026-02-01')
    expect(byId(scheduleTasks(tasks, { mode: 'asap' })).late!.start).toBe('2026-01-10')
    expect(r.chain!.start).toBe('2026-01-12')
    expect(scheduleTasks([tasks[0]!])).toEqual([tasks[0]])
  })
  it('counts working days with a calendar; a link onto a summary moves each of its tasks', () => {
    const tasks = [
      // Friday
      T('a', '2026-03-06', '2026-03-06'),
      T('b', '2026-03-02', '2026-03-03', { dependencies: ['a'] }),
      T('phase', '2026-01-01', '2026-01-01', { dependencies: ['a'] }),
      T('p1', '2026-03-01', '2026-03-02', { parentId: 'phase' }),
    ]
    const r = byId(scheduleTasks(tasks, { calendar: {} }))
    // Two working days from Monday
    expect(r.b).toMatchObject({ start: '2026-03-09', end: '2026-03-10' })
    expect(r.p1!.start).toBe('2026-03-09')
    expect(r.phase).toMatchObject({ start: '2026-03-09', end: r.p1!.end })
  })
  it('survives cycles', () => {
    const tasks = [T('a', '2026-01-01', '2026-01-02', { dependencies: ['b'] }), T('b', '2026-01-01', '2026-01-02', { dependencies: ['a'] })]
    expect(() => scheduleTasks(tasks)).not.toThrow()
  })
})

describe('criticalPath', () => {
  it('finds the chain that sets the end, with slack for the rest', () => {
    const tasks = [
      T('a', '2026-01-01', '2026-01-02'),
      T('b', '2026-01-03', '2026-01-10', { dependencies: ['a'] }),
      T('c', '2026-01-03', '2026-01-04', { dependencies: ['a'] }),
      T('d', '2026-01-11', '2026-01-11', { dependencies: ['b', 'c'] }),
    ]
    const cp = criticalPath(tasks)
    expect(cp.tasks).toEqual(['a', 'b', 'd'])
    expect(cp.dependencies.sort()).toEqual(['a>b', 'b>d'])
    expect(cp.slack.c).toBe(6)
    expect(cp.finish).toBe('2026-01-11')
  })
})

describe('criticalPath with a calendar', () => {
  it("doesn't count a weekend between two tasks as slack", () => {
    // Friday, then Monday
    const tasks = [T('a', '2026-03-06', '2026-03-06'), T('b', '2026-03-09', '2026-03-10', { dependencies: ['a'] })]
    expect(criticalPath(tasks).tasks).toEqual(['b'])
    const cp = criticalPath(tasks, { calendar: {} })
    expect(cp.tasks).toEqual(['a', 'b'])
    expect(cp.dependencies).toEqual(['a>b'])
  })
})

describe('criticalPath across weekends', () => {
  it('finds a chain whose links all cross weekends, the way Tempo plans it', () => {
    // Mon–Fri, then Mon–Fri, then a Monday milestone; a side task with real slack
    const tasks = [
      T('a', '2026-03-02', '2026-03-06'),
      T('b', '2026-03-09', '2026-03-13', { dependencies: ['a'] }),
      T('side', '2026-03-09', '2026-03-10', { dependencies: ['a'] }),
      { id: 'm', name: 'm', start: '2026-03-16', type: 'milestone' as const, dependencies: ['b', 'side'] },
    ]
    const cp = criticalPath(tasks, { calendar: {} })
    expect(cp.tasks).toEqual(['a', 'b', 'm'])
    expect(cp.slack.side).toBe(3)
    expect(cp.dependencies.sort()).toEqual(['a>b', 'b>m'])
  })
})
