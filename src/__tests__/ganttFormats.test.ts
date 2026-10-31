import { describe, it, expect } from 'vitest'
import { parseGanttCsv, parseGanttJson, parseMsProjectXml, toGanttCsv, toGanttJson, toMsProjectXml } from '../composables/ganttFormats'
import type { GanttTask } from '../composables/ganttSchedule'

const tasks: GanttTask[] = [
  { id: 'p', name: 'Launch, phase 1', start: '2026-03-02', end: '2026-03-13', type: 'summary', progress: 40 },
  { id: 'a', name: 'Design "v2"', start: '2026-03-02', end: '2026-03-06', parentId: 'p', progress: 100, color: 'tertiary', baselineStart: '2026-03-02', baselineEnd: '2026-03-04' },
  { id: 'b', name: 'Build', start: '2026-03-09', end: '2026-03-13', parentId: 'p', dependencies: ['a', { id: 'a', type: 'SS', lag: 2 }] },
  { id: 'm', name: 'Ship', start: '2026-03-16', type: 'milestone', dependencies: [{ id: 'b', type: 'FS', lag: -1 }] },
]

describe('gantt CSV', () => {
  it('round trips, quoting what needs it', () => {
    const csv = toGanttCsv(tasks)
    expect(csv.split('\n')[0]).toBe('id,name,start,end,progress,type,parent,dependencies,color,baselineStart,baselineEnd')
    expect(csv).toContain('"Launch, phase 1"')
    expect(csv).toContain('"Design ""v2"""')
    expect(csv).toContain('a; a SS+2')
    expect(parseGanttCsv(csv)).toEqual(tasks)
  })
  it("reads other tools' headers, separators and dates", () => {
    const csv = 'Task Name;Start Date;Finish;% Complete;Predecessors\nPlan;03/04/2026;05/04/2026;50%;\nDo;2026-04-06 09:00;2026-04-06 17:30;;t1 FF-1\nDone;10/04/2026;;;\n'
    const r = parseGanttCsv(csv)
    expect(r[0]).toEqual({ id: 't1', name: 'Plan', start: '2026-04-03', end: '2026-04-05', progress: 50 })
    expect(r[1]).toMatchObject({ start: '2026-04-06T09:00', end: '2026-04-06T17:30', dependencies: [{ id: 't1', type: 'FF', lag: -1 }] })
    expect(r[2]).toMatchObject({ type: 'milestone', start: '2026-04-10' })
    expect(() => parseGanttCsv('a,b\n1,2')).toThrow(SyntaxError)
  })
})

describe('gantt JSON', () => {
  it('round trips and accepts bare arrays', () => {
    expect(parseGanttJson(toGanttJson(tasks))).toEqual(tasks)
    expect(parseGanttJson('[{"name":"x","start":"2026-01-01"}]')).toEqual([{ id: 't1', name: 'x', start: '2026-01-01' }])
    expect(() => parseGanttJson('{"nope":1}')).toThrow(SyntaxError)
    expect(() => parseGanttJson('[{"name":"x"}]')).toThrow(/no valid start/)
  })
})

describe('MS Project XML', () => {
  it('writes MSPDI that reads back the same', () => {
    const xml = toMsProjectXml(tasks, { name: 'Launch & co' })
    expect(xml).toContain('<Name>Launch &amp; co</Name>')
    expect(xml).toContain('<OutlineLevel>2</OutlineLevel>')
    expect(xml).toContain('<Start>2026-03-02T08:00:00</Start>')
    expect(xml).toContain('<Finish>2026-03-06T17:00:00</Finish>')
    expect(xml).toContain('<Duration>PT45H0M0S</Duration>')
    expect(xml).toContain('<Type>3</Type><LinkLag>9600</LinkLag>')
    const back = parseMsProjectXml(xml)
    expect(back.name).toBe('Launch & co')
    // Ids become Project's UIDs
    const ids = new Map(tasks.map((t, i) => [t.id, String(i + 1)]))
    const expected = tasks.map((t) => ({
      ...t,
      id: ids.get(t.id)!,
      ...(t.parentId ? { parentId: ids.get(t.parentId) } : {}),
      ...(t.dependencies ? { dependencies: t.dependencies.map((d) => (typeof d === 'string' ? ids.get(d) : { ...d, id: ids.get(d.id)! })) } : {}),
    }))
    for (const e of expected) delete (e as Partial<GanttTask>).color
    expect(back.tasks).toEqual(expected)
  })
  it('reads datetimes, namespaces, entities and skips the project summary', () => {
    const xml = `<?xml version="1.0"?><!-- x --><p:Project xmlns:p="http://schemas.microsoft.com/project"><Title>Ops</Title><Tasks>
      <Task><UID>0</UID><OutlineLevel>0</OutlineLevel><Name>Ops</Name><Start>2026-05-01T08:00:00</Start><Finish>2026-05-01T17:00:00</Finish></Task>
      <Task><UID>7</UID><OutlineLevel>1</OutlineLevel><Name>Night &lt;shift&gt;</Name><Start>2026-05-01T22:00:00</Start><Finish>2026-05-02T06:30:00</Finish><PercentComplete>10</PercentComplete></Task>
      <Task><UID>8</UID><OutlineLevel>1</OutlineLevel><Name><![CDATA[A & B]]></Name><Start>2026-05-02T07:00:00</Start><Finish>2026-05-02T08:00:00</Finish><PredecessorLink><PredecessorUID>7</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink></Task>
    </Tasks></p:Project>`
    const r = parseMsProjectXml(xml)
    expect(r.name).toBe('Ops')
    expect(r.tasks).toEqual([
      { id: '7', name: 'Night <shift>', start: '2026-05-01T22:00', end: '2026-05-02T06:30', progress: 10 },
      { id: '8', name: 'A & B', start: '2026-05-02T07:00', end: '2026-05-02T08:00', dependencies: ['7'] },
    ])
    expect(() => parseMsProjectXml('<x/>')).toThrow(SyntaxError)
  })
})
