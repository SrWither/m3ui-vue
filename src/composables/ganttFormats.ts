// Tasks as files for MGantt: CSV (a spreadsheet's export), JSON, and Microsoft Project's XML (MSPDI, which
// Project, ProjectLibre, GanttProject and most planning tools read and write). Pure functions without
// dependencies; the XML is read by a small parser of its own, so it works without a DOM too.
import { normalizeDependency, summaryIds, taskSpan, type GanttDependency, type GanttTask } from './ganttSchedule'
import { DAY, addDays, formatDate, isDateOnly, parseDate, startOfDay } from './_ganttTime'

// ── Dependencies as text: "a; b SS+2; c FF-1" ─────────────────────────────────────────────────────────────

function depToText(d: string | GanttDependency) {
  const n = normalizeDependency(d)
  return `${n.id}${n.type !== 'FS' || n.lag ? ` ${n.type}` : ''}${n.lag ? (n.lag > 0 ? `+${n.lag}` : String(n.lag)) : ''}`
}
function depsFromText(s: string): (string | GanttDependency)[] {
  const out: (string | GanttDependency)[] = []
  for (const part of s.split(/[;,]/)) {
    const m = /^\s*(.+?)(?:\s+(FS|SS|FF|SF))?\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/i.exec(part)
    if (!m || !m[1]!.trim()) continue
    const type = (m[2]?.toUpperCase() ?? 'FS') as GanttDependency['type']
    const lag = m[3] ? Number(m[3].replace(/\s/g, '')) : 0
    out.push(type === 'FS' && !lag ? m[1]!.trim() : { id: m[1]!.trim(), type, ...(lag ? { lag } : {}) })
  }
  return out
}

// ── CSV ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface GanttCsvOptions {
  /** Field separator (default `,`; reading, `;` and tabs are detected) */
  separator?: string
}

const CSV_COLUMNS = ['id', 'name', 'start', 'end', 'progress', 'type', 'parent', 'dependencies', 'color', 'baselineStart', 'baselineEnd'] as const

function csvCell(v: string, sep: string) {
  return /["\n\r]/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * Tasks as CSV, one row each: id, name, start, end, progress, type, parent, dependencies (`a; b SS+2`), color and the
 * baseline. `data` isn't written (keep it in JSON).
 */
export function toGanttCsv(tasks: readonly GanttTask[], options: GanttCsvOptions = {}): string {
  const sep = options.separator ?? ','
  const rows = [CSV_COLUMNS.join(sep)]
  for (const t of tasks) {
    const cells = [
      t.id, t.name, t.start, t.end ?? '', t.progress === undefined ? '' : String(t.progress), t.type ?? '', t.parentId ?? '',
      (t.dependencies ?? []).map(depToText).join('; '), t.color ?? '', t.baselineStart ?? '', t.baselineEnd ?? '',
    ]
    rows.push(cells.map((c) => csvCell(c, sep)).join(sep))
  }
  return rows.join('\n') + '\n'
}

function parseCsvRows(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && !cell) quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

// Header names other tools use, lower case without spaces
const CSV_ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  id: 'id', uid: 'id', key: 'id', '#': 'id',
  name: 'name', task: 'name', taskname: 'name', title: 'name', summary: 'name',
  start: 'start', startdate: 'start', begin: 'start', from: 'start',
  end: 'end', finish: 'end', enddate: 'end', finishdate: 'end', due: 'end', duedate: 'end', to: 'end',
  progress: 'progress', percentcomplete: 'progress', '%complete': 'progress', complete: 'progress', done: 'progress',
  type: 'type', kind: 'type',
  parent: 'parent', parentid: 'parent',
  dependencies: 'dependencies', predecessors: 'dependencies', dependson: 'dependencies', depends: 'dependencies',
  color: 'color',
  baselinestart: 'baselineStart', baselineend: 'baselineEnd', baselinefinish: 'baselineEnd',
}

// Dates as tools write them: ISO, or day/month/year (the separator decides nothing, so `dayFirst` does)
function csvDate(v: string, dayFirst: boolean): string | undefined {
  const s = v.trim()
  if (!s) return undefined
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(s)
  if (iso) return iso[2] ? `${iso[1]}T${iso[2]}` : iso[1]
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s)
  if (m) {
    const [a, b] = dayFirst ? [m[2]!, m[1]!] : [m[1]!, m[2]!]
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!
    const date = `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
    return m[4] ? `${date}T${m[4].padStart(2, '0')}:${m[5]}` : date
  }
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? undefined : formatDate(ms, !/\d:\d/.test(s))
}

/**
 * Reads tasks from CSV with a header row: the columns `toGanttCsv` writes, or what other tools call them (Task Name,
 * Start Date, Finish, % Complete, Predecessors…; case and spaces don't matter). Rows without an id get one; without
 * an end, a milestone. `dayFirst` reads `03/04/2026` as the 3rd of April (default true).
 */
export function parseGanttCsv(text: string, options: GanttCsvOptions & { dayFirst?: boolean } = {}): GanttTask[] {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const sep = options.separator ?? ([',', ';', '\t'].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0]![0])
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''), sep)
  const header = rows.shift()
  if (!header) return []
  const cols = header.map((h) => CSV_ALIASES[h.toLowerCase().replace(/[\s_-]/g, '')])
  if (!cols.includes('name') || !cols.includes('start')) throw new SyntaxError('The CSV needs a name and a start column')
  const dayFirst = options.dayFirst ?? true
  const tasks: GanttTask[] = []
  rows.forEach((r, i) => {
    const get = (k: (typeof CSV_COLUMNS)[number]) => {
      const at = cols.indexOf(k)
      return at < 0 ? '' : (r[at] ?? '').trim()
    }
    const start = csvDate(get('start'), dayFirst)
    if (!start) return
    const t: GanttTask = { id: get('id') || `t${i + 1}`, name: get('name'), start }
    const end = csvDate(get('end'), dayFirst)
    if (end) t.end = end
    const progress = parseFloat(get('progress').replace('%', ''))
    if (Number.isFinite(progress)) t.progress = progress > 0 && progress <= 1 && get('progress').includes('.') && !get('progress').includes('%') ? progress * 100 : progress
    const type = get('type').toLowerCase()
    if (type === 'task' || type === 'milestone' || type === 'summary') t.type = type
    else if (!end) t.type = 'milestone'
    if (get('parent')) t.parentId = get('parent')
    if (get('dependencies')) t.dependencies = depsFromText(get('dependencies'))
    const color = get('color')
    if (['primary', 'secondary', 'tertiary', 'error', 'success', 'neutral'].includes(color)) t.color = color as GanttTask['color']
    const bs = csvDate(get('baselineStart'), dayFirst)
    const be = csvDate(get('baselineEnd'), dayFirst)
    if (bs) t.baselineStart = bs
    if (be) t.baselineEnd = be
    tasks.push(t)
  })
  return tasks
}

// ── JSON ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Tasks as JSON, `{ format: 'm3ui-gantt', version: 1, tasks }`, everything included (`data` too) */
export function toGanttJson(tasks: readonly GanttTask[], options: { space?: number } = {}): string {
  return JSON.stringify({ format: 'm3ui-gantt', version: 1, tasks }, null, options.space ?? 2)
}

/**
 * Reads tasks from JSON: what `toGanttJson` writes, a bare array of tasks, or `{ tasks: [...] }`. Each needs a name
 * and a start; ids are filled in when missing. Throws a SyntaxError on anything else.
 */
export function parseGanttJson(text: string): GanttTask[] {
  const v = JSON.parse(text) as unknown
  const list = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { tasks?: unknown }).tasks) ? (v as { tasks: unknown[] }).tasks : null
  if (!list) throw new SyntaxError('Expected an array of tasks or { tasks: [...] }')
  return list.map((raw, i) => {
    if (!raw || typeof raw !== 'object') throw new SyntaxError(`Task ${i + 1} isn't an object`)
    const t = raw as Partial<GanttTask>
    if (typeof t.start !== 'string' || Number.isNaN(parseDate(t.start))) throw new SyntaxError(`Task ${i + 1} has no valid start`)
    return { ...t, id: t.id === undefined || t.id === null ? `t${i + 1}` : String(t.id), name: String(t.name ?? ''), start: t.start } as GanttTask
  })
}

// ── Microsoft Project XML (MSPDI) ─────────────────────────────────────────────────────────────────────────

interface XmlNode { name: string; children: XmlNode[]; text: string }

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

// Elements and their text; attributes, comments and declarations are skipped (MSPDI keeps its data in elements)
function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: '#root', children: [], text: '' }
  const stack = [root]
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/?([\w:.-]+)[^>]*?(\/?)>|[^<]+/g
  for (let m: RegExpExecArray | null; (m = re.exec(src)); ) {
    const tok = m[0]
    const top = stack.at(-1)!
    if (tok.startsWith('<![CDATA[')) top.text += decodeXml(tok)
    else if (tok.startsWith('<!') || tok.startsWith('<?')) continue
    else if (tok.startsWith('</')) {
      const name = m[1]!.replace(/^.*:/, '')
      while (stack.length > 1 && stack.pop()!.name !== name) { /* unclosed elements close with their parent */ }
    } else if (tok.startsWith('<')) {
      const node: XmlNode = { name: m[1]!.replace(/^.*:/, ''), children: [], text: '' }
      top.children.push(node)
      if (!m[2]) stack.push(node)
    } else top.text += decodeXml(tok)
  }
  return root
}
const child = (n: XmlNode | undefined, name: string) => n?.children.find((c) => c.name === name)
const textOf = (n: XmlNode | undefined, name: string) => child(n, name)?.text.trim() ?? ''

// MSPDI dependency types: 0 FF, 1 FS, 2 SF, 3 SS
const LINK_TYPES: GanttDependency['type'][] = ['FF', 'FS', 'SF', 'SS']
// Lags are in tenths of a minute; LagFormat 7 is days (of 8 working hours), 5 elapsed days and so on
const TENTHS_PER_DAY = 8 * 60 * 10

export interface GanttXmlOptions {
  /** The project's name */
  name?: string
  /** Working hours a date-only task's days run, for Project's datetimes (default 8 to 17) */
  dayStart?: number
  dayEnd?: number
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function xmlTime(ms: number) {
  return `${formatDate(ms, false).slice(0, 16)}:00`
}
// "PT40H0M0S"
function xmlDuration(ms: number) {
  const minutes = Math.round(ms / 60_000)
  return `PT${Math.floor(minutes / 60)}H${minutes % 60}M0S`
}

/**
 * Tasks as a Microsoft Project XML file (MSPDI): outline levels for summaries, start and finish (a date-only
 * task's days from `dayStart` to `dayEnd`), duration, percent complete, milestones, predecessors with their type
 * and lag (in days), and the baseline. Project, ProjectLibre and GanttProject open it.
 */
export function toMsProjectXml(tasks: readonly GanttTask[], options: GanttXmlOptions = {}): string {
  const ds = options.dayStart ?? 8
  const de = options.dayEnd ?? 17
  const ids = new Set(tasks.map((t) => t.id))
  const sums = summaryIds(tasks)
  const kids = new Map<string | undefined, GanttTask[]>()
  for (const t of tasks) {
    const p = t.parentId && ids.has(t.parentId) ? t.parentId : undefined
    ;(kids.get(p) ?? kids.set(p, []).get(p)!).push(t)
  }
  // Project lists tasks in outline order: each summary followed by its tasks
  const ordered: { t: GanttTask; level: number }[] = []
  const walk = (p: string | undefined, level: number) => {
    for (const t of kids.get(p) ?? []) {
      ordered.push({ t, level })
      if (level < 100) walk(t.id, level + 1)
    }
  }
  walk(undefined, 1)
  const uid = new Map(ordered.map((o, i) => [o.t.id, i + 1]))
  const times = (t: GanttTask, start?: string, end?: string) => {
    const s = taskSpan({ start: start ?? t.start, end: end ?? t.end, type: t.type })
    if (!s.dateOnly) return { start: s.start, finish: s.end, work: s.end - s.start }
    const finishDay = s.end > s.start ? addDays(s.end, -1) : s.start
    const days = Math.max(0, Math.round((startOfDay(s.end) - startOfDay(s.start)) / DAY))
    return { start: s.start + ds * 3_600_000, finish: (s.end > s.start ? finishDay + de * 3_600_000 : s.start + ds * 3_600_000), work: days * (de - ds) * 3_600_000 }
  }
  const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '<Project xmlns="http://schemas.microsoft.com/project">']
  if (options.name) out.push(`  <Name>${xmlEscape(options.name)}</Name>`, `  <Title>${xmlEscape(options.name)}</Title>`)
  out.push('  <ScheduleFromStart>1</ScheduleFromStart>', `  <DefaultStartTime>${String(ds).padStart(2, '0')}:00:00</DefaultStartTime>`, `  <DefaultFinishTime>${String(de).padStart(2, '0')}:00:00</DefaultFinishTime>`, '  <Tasks>')
  ordered.forEach(({ t, level }, i) => {
    const tm = times(t)
    const milestone = t.type === 'milestone' || !t.end
    const lines = [
      `<UID>${i + 1}</UID>`, `<ID>${i + 1}</ID>`, `<Name>${xmlEscape(t.name)}</Name>`,
      `<OutlineLevel>${level}</OutlineLevel>`,
      `<Start>${xmlTime(tm.start)}</Start>`, `<Finish>${xmlTime(tm.finish)}</Finish>`,
      `<Duration>${xmlDuration(milestone ? 0 : tm.work)}</Duration>`, '<DurationFormat>7</DurationFormat>',
      `<PercentComplete>${Math.round(t.progress ?? 0)}</PercentComplete>`,
      `<Milestone>${milestone ? 1 : 0}</Milestone>`, `<Summary>${sums.has(t.id) ? 1 : 0}</Summary>`,
    ]
    if (t.baselineStart) {
      const b = times(t, t.baselineStart, t.baselineEnd ?? (t.end ? t.baselineStart : undefined))
      lines.push(`<Baseline><Number>0</Number><Start>${xmlTime(b.start)}</Start><Finish>${xmlTime(b.finish)}</Finish><Duration>${xmlDuration(b.work)}</Duration></Baseline>`)
    }
    for (const raw of t.dependencies ?? []) {
      const d = normalizeDependency(raw)
      if (!uid.has(d.id)) continue
      lines.push(`<PredecessorLink><PredecessorUID>${uid.get(d.id)}</PredecessorUID><Type>${LINK_TYPES.indexOf(d.type)}</Type><LinkLag>${Math.round(d.lag * TENTHS_PER_DAY)}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`)
    }
    out.push('    <Task>', ...lines.map((l) => `      ${l}`), '    </Task>')
  })
  out.push('  </Tasks>', '</Project>')
  return out.join('\n') + '\n'
}

/**
 * Reads a Microsoft Project XML file (MSPDI, as Project, ProjectLibre or GanttProject save it): the outline
 * (summaries from outline levels), names, start and finish, percent complete, milestones, predecessors (type and lag
 * in days) and the first baseline. With `dates: 'auto'` (default) a project whose tasks all start and finish at the
 * day's working hours comes in as whole days; `'datetime'` keeps the times. The project's name comes back too.
 */
export function parseMsProjectXml(text: string, options: { dates?: 'auto' | 'date' | 'datetime' } = {}): { name?: string; tasks: GanttTask[] } {
  const doc = parseXml(text)
  const project = child(doc, 'Project')
  if (!project) throw new SyntaxError('Not a Microsoft Project XML file (no <Project>)')
  const items = child(project, 'Tasks')?.children.filter((c) => c.name === 'Task') ?? []
  const raw = items
    .map((n) => ({
      uid: textOf(n, 'UID'),
      name: textOf(n, 'Name'),
      level: Number(textOf(n, 'OutlineLevel') || 1),
      start: textOf(n, 'Start'),
      finish: textOf(n, 'Finish'),
      progress: Number(textOf(n, 'PercentComplete') || 0),
      milestone: textOf(n, 'Milestone') === '1',
      summary: textOf(n, 'Summary') === '1',
      nullTask: textOf(n, 'IsNull') === '1',
      baseline: n.children.find((c) => c.name === 'Baseline' && (textOf(c, 'Number') || '0') === '0'),
      links: n.children.filter((c) => c.name === 'PredecessorLink'),
    }))
    // Project's task 0 is the project's own summary
    .filter((t) => t.uid && t.start && !t.nullTask && !(t.uid === '0' && t.level <= 0))
  const midnights = raw.every((t) => /T(0?0:00|0?8:00|0?9:00)/.test(t.start) && (t.milestone || /T(0?0:00|1[6-8]:00|23:59)/.test(t.finish)))
  const dateOnly = options.dates === 'date' || (options.dates !== 'datetime' && midnights)
  const toDate = (s: string) => {
    const ms = parseDate(s.slice(0, 19))
    return formatDate(ms, dateOnly)
  }
  // A finish at midnight belongs to the day before
  const toEnd = (s: string) => {
    if (!dateOnly) return toDate(s)
    const ms = parseDate(s.slice(0, 19))
    return formatDate(startOfDay(ms) === ms ? addDays(ms, -1) : ms, true)
  }
  const parents: string[] = []
  const tasks: GanttTask[] = raw.map((r) => {
    parents.length = Math.max(0, r.level - 1)
    const t: GanttTask = { id: r.uid, name: r.name, start: toDate(r.start) }
    if (r.milestone) t.type = 'milestone'
    else t.end = isDateOnly(t.start) ? toEnd(r.finish) : toDate(r.finish)
    if (t.end && parseDate(t.end) < parseDate(t.start)) t.end = t.start
    if (r.progress) t.progress = r.progress
    const parent = parents[r.level - 2]
    if (parent) t.parentId = parent
    parents[r.level - 1] = r.uid
    if (r.summary) t.type = 'summary'
    if (r.baseline && textOf(r.baseline, 'Start')) {
      t.baselineStart = toDate(textOf(r.baseline, 'Start'))
      if (!r.milestone && textOf(r.baseline, 'Finish')) t.baselineEnd = isDateOnly(t.baselineStart) ? toEnd(textOf(r.baseline, 'Finish')) : toDate(textOf(r.baseline, 'Finish'))
    }
    const deps: (string | GanttDependency)[] = []
    for (const l of r.links) {
      const id = textOf(l, 'PredecessorUID')
      if (!id) continue
      const type = LINK_TYPES[Number(textOf(l, 'Type') || 1)] ?? 'FS'
      const lag = Math.round((Number(textOf(l, 'LinkLag') || 0) / TENTHS_PER_DAY) * 100) / 100
      deps.push(type === 'FS' && !lag ? id : { id, type, ...(lag ? { lag } : {}) })
    }
    if (deps.length) t.dependencies = deps
    return t
  })
  const name = textOf(project, 'Title') || textOf(project, 'Name') || undefined
  return { ...(name ? { name } : {}), tasks }
}
