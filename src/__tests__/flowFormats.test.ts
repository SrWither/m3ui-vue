import { describe, it, expect } from 'vitest'
import { parseDot, parseMermaid, toDot, toMermaid } from '../composables/flowFormats'

const pairs = (g: { edges: { source: string; target: string }[] }) => g.edges.map((e) => `${e.source}>${e.target}`)

describe('parseDot', () => {
  it('reads nodes, chains, defaults, attributes and comments', () => {
    const g = parseDot(`
      // a pipeline
      digraph build {
        rankdir=LR; /* left to right */
        node [shape=box];
        edge [color=gray];
        fetch [label="Fetch\\nsources"];
        fetch -> compile -> test [label="ok", style=dashed, penwidth=2];
        test -> deploy [dir=none, color="#ff0000:blue"];
        "odd id" -> deploy
      }`)
    expect(g.name).toBe('build')
    expect(g.rankdir).toBe('LR')
    expect(g.direction).toBe('horizontal')
    expect(g.nodes.map((n) => n.id)).toEqual(['fetch', 'compile', 'test', 'deploy', 'odd id'])
    expect(g.nodes[0]!.data.label).toBe('Fetch\nsources')
    expect(g.nodes[1]!.data.label).toBe('compile')
    expect(g.nodes[1]!.data.attrs.shape).toBe('box')
    expect(pairs(g)).toEqual(['fetch>compile', 'compile>test', 'test>deploy', 'odd id>deploy'])
    expect(g.edges[0]).toMatchObject({ label: 'ok', dashed: true, width: 4, color: 'gray' })
    expect(g.edges[2]).toMatchObject({ markerEnd: 'none', color: '#ff0000' })
    // Laid out left to right
    const x = (id: string) => g.nodes.find((n) => n.id === id)!.position.x
    expect(x('fetch')).toBeLessThan(x('compile'))
    expect(x('compile')).toBeLessThan(x('test'))
  })

  it('undirected graphs, strict, subgraph operands, ports and HTML labels', () => {
    const g = parseDot(`strict graph { a -- b; a -- b; b -- a; a:n -- { c d }; e [label=<<b>Bold</b><br/>line>] }`)
    expect(g.directed).toBe(false)
    expect(pairs(g)).toEqual(['a>b', 'a>c', 'a>d'])
    expect(g.edges.every((e) => e.markerEnd === 'none')).toBe(true)
    expect(g.edges[1]!.data.attrs.tailport).toBe('n')
    expect(g.nodes.find((n) => n.id === 'e')!.data.label).toBe('Bold\nline')
  })

  it('clusters become groups laid out from the inside out; circles and hidden nodes', () => {
    const g = parseDot(`digraph {
      subgraph cluster_a { label="Team A"; x; subgraph cluster_inner { y [shape=doublecircle] } }
      x -> y -> z
      ghost [style=invis]
    }`)
    const byId = new Map(g.nodes.map((n) => [n.id, n]))
    expect(byId.get('cluster_a')).toMatchObject({ type: 'group', data: { label: 'Team A' } })
    expect(byId.get('cluster_inner')!.parentId).toBe('cluster_a')
    expect(byId.get('x')!.parentId).toBe('cluster_a')
    expect(byId.get('y')).toMatchObject({ type: 'circle', parentId: 'cluster_inner', data: { ring: 'primary' } })
    expect(byId.get('z')!.parentId).toBeUndefined()
    expect(byId.get('ghost')!.hidden).toBe(true)
    // Parents come before their children; children sit inside the group's padding and header
    const order = g.nodes.map((n) => n.id)
    expect(order.indexOf('cluster_a')).toBeLessThan(order.indexOf('x'))
    expect(byId.get('x')!.position.x).toBeGreaterThanOrEqual(24)
    expect(byId.get('x')!.position.y).toBeGreaterThanOrEqual(36)
  })

  it('keeps pos when every node has one', () => {
    const g = parseDot('digraph { a [pos="0,0"]; b [pos="150,-75"] }')
    const [a, b] = g.nodes
    expect(b!.position.x - a!.position.x).toBe(200)
    expect(b!.position.y - a!.position.y).toBe(100)
  })

  it('layout: false leaves the nodes at 0,0', () => {
    const g = parseDot('digraph { a -> b }', { layout: false, edgeType: 'smoothstep', nodeType: 'step' })
    expect(g.nodes.every((n) => n.position.x === 0 && n.position.y === 0)).toBe(true)
    expect(g.nodes[0]!.type).toBe('step')
    expect(g.edges[0]!.type).toBe('smoothstep')
  })

  it('throws with the line and column', () => {
    expect(() => parseDot('digraph {\n  a -> ;\n}')).toThrow(/line 2, column 8/)
    expect(() => parseDot('flowchart LR')).toThrow(SyntaxError)
  })
})

describe('parseMermaid', () => {
  it('reads shapes, chains, & and every kind of link', () => {
    const g = parseMermaid(`
      %% a comment
      flowchart LR
        A[Start] --> B{Is it?}
        B -->|Yes| C((Done))
        B -- No --> D([Retry]) -.-> A
        C & D ==> E[("Log store")]
        E --- F
        F ~~~ G
        G <--> H:::warn
        H --again--> I
        I --x J
        classDef warn fill:#f96
        style A fill:#f9f`)
    expect(g.rankdir).toBe('LR')
    const byId = new Map(g.nodes.map((n) => [n.id, n]))
    expect(byId.get('A')!.data).toMatchObject({ label: 'Start', shape: 'rect' })
    expect(byId.get('B')!.data.shape).toBe('diamond')
    expect(byId.get('C')!.type).toBe('circle')
    expect(byId.get('D')!.data.shape).toBe('stadium')
    expect(byId.get('E')!.data).toMatchObject({ label: 'Log store', shape: 'cylinder' })
    expect(byId.get('H')!.data.label).toBe('H')
    expect(pairs(g)).toEqual(['A>B', 'B>C', 'B>D', 'D>A', 'C>E', 'D>E', 'E>F', 'F>G', 'G>H', 'H>I', 'I>J'])
    const e = g.edges
    expect(e[1]!.label).toBe('Yes')
    expect(e[2]!.label).toBe('No')
    expect(e[3]!.dashed).toBe(true)
    expect(e[4]!.width).toBe(4)
    expect(e[6]!.markerEnd).toBe('none')
    expect(e[7]!.hidden).toBe(true)
    expect(e[8]!.markerStart).toBe('arrow-closed')
    expect(e[9]!.label).toBe('again')
    expect(e[10]!.markerEnd).toBe('arrow')
  })

  it('subgraphs become groups; graph TD on one line', () => {
    const g = parseMermaid('graph TD; a-->b; subgraph s1 [Backend]; b; c-->d; end')
    expect(g.rankdir).toBe('TB')
    const byId = new Map(g.nodes.map((n) => [n.id, n]))
    expect(byId.get('s1')).toMatchObject({ type: 'group', data: { label: 'Backend' } })
    // b was used before the subgraph: naming it there moves it in, as in Mermaid
    expect(byId.get('b')!.parentId).toBe('s1')
    expect(byId.get('c')!.parentId).toBe('s1')
    expect(byId.get('a')!.parentId).toBeUndefined()
    expect(pairs(g)).toEqual(['a>b', 'c>d'])
  })

  it('the @{ } node syntax and quoted labels with brackets', () => {
    const g = parseMermaid('flowchart TB\n  a@{ shape: circle, label: "Hub" } --> b["Has [brackets]"]')
    expect(g.nodes[0]).toMatchObject({ type: 'circle', data: { label: 'Hub' } })
    expect(g.nodes[1]!.data.label).toBe('Has [brackets]')
  })

  it('throws on a missing end', () => {
    expect(() => parseMermaid('flowchart LR\nsubgraph x\na-->b')).toThrow(/no "end"/)
  })
})

describe('toDot / toMermaid', () => {
  const nodes = [
    { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: { label: 'Group' } },
    { id: 'a', position: { x: 10, y: 40 }, parentId: 'g', data: { label: 'Say "hi"' } },
    { id: 'b', type: 'circle', position: { x: 300, y: 0 }, data: { label: 'b', ring: 'primary' } },
    { id: 'end', position: { x: 600, y: 0 }, data: { label: 'Finish' } },
  ]
  const edges = [
    { id: 'e1', source: 'a', target: 'b', label: 'go', dashed: true, color: 'red', width: 4 },
    { id: 'e2', source: 'b', target: 'end', markerEnd: 'none' as const, color: 'primary' },
  ]

  it('writes DOT that reads back the same', () => {
    const text = toDot(nodes, edges, { name: 'demo', direction: 'horizontal' })
    expect(text).toContain('rankdir=LR;')
    expect(text).toContain('subgraph cluster_g {')
    expect(text).toContain('a [label="Say \\"hi\\""];')
    expect(text).toContain('a -> b [label=go, color=red, penwidth=2, style=dashed];')
    expect(text).not.toContain('primary')
    const back = parseDot(text)
    expect(back.nodes.find((n) => n.id === 'a')).toMatchObject({ parentId: 'cluster_g', data: { label: 'Say "hi"' } })
    expect(back.nodes.find((n) => n.id === 'b')).toMatchObject({ type: 'circle', data: { ring: 'primary' } })
    expect(back.edges[0]).toMatchObject({ label: 'go', dashed: true, color: 'red', width: 4 })
    expect(back.edges[1]!.markerEnd).toBe('none')
    // And again: unchanged
    expect(toDot(back.nodes, back.edges, { name: 'demo', direction: 'horizontal' })).toBe(text)
  })

  it('writes Mermaid that reads back the same', () => {
    const text = toMermaid(nodes, edges, { direction: 'LR' })
    expect(text.split('\n')[0]).toBe('flowchart LR')
    // "end" can't be a Mermaid id
    expect(text).not.toMatch(/^\s*end\[/m)
    const back = parseMermaid(text)
    const a = back.nodes.find((n) => n.data?.label === 'Say "hi"')!
    expect(a.parentId).toBe('g')
    expect(back.nodes.find((n) => n.id === 'b')).toMatchObject({ type: 'circle', data: { ring: 'primary' } })
    expect(back.nodes.find((n) => n.data?.label === 'Finish')).toBeTruthy()
    expect(back.edges[0]).toMatchObject({ label: 'go', dashed: true })
    expect(back.edges[1]!.markerEnd).toBe('none')
  })
})
