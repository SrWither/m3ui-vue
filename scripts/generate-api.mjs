#!/usr/bin/env node
/*
 * Generates a compact API reference for AI coding agents (and humans in a hurry):
 *   dist/API.md    every component's props, events, slots, exposed methods and types, plus
 *                  composables, the plugin, locale keys, theme tokens and entry points.
 *   dist/api.json  the same data, for the docs site to build llms.txt and per-component pages.
 *
 * Types, defaults, events and slots are read from the source with vue-component-meta (what
 * Volar uses), so they can't drift from the code. Descriptions come from JSDoc: a `/** … *\/`
 * as the first thing in a component's <script setup> describes the component, and the usual
 * JSDoc above each prop, emit or exposed member describes that member.
 *
 * Run: node scripts/generate-api.mjs  (part of `pnpm build`)
 */
import { createChecker } from 'vue-component-meta'
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const PKG = pkg.name
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

// ─── Entry points ─────────────────────────────────────────────────────────────

/** Entry file → import specifier. Subpath entries come first so their components point there. */
const entries = [
  ['src/chart.ts', `${PKG}/chart`],
  ['src/code-editor.ts', `${PKG}/code-editor`],
  ['src/markdown.ts', `${PKG}/markdown`],
  ['src/rich-text-editor.ts', `${PKG}/rich-text-editor`],
  ['src/terminal.ts', `${PKG}/terminal`],
  ['src/qrcode.ts', `${PKG}/qrcode`],
  ['src/barcode.ts', `${PKG}/barcode`],
  ['src/index.ts', PKG],
]

const components = new Map() // name → { file, from }
const typeExports = new Map() // type name → { file, from }
const valueExports = [] // { name, file, from } for non-component values (composables, data, plugin)

for (const [entry, from] of entries) {
  if (!fs.existsSync(path.join(root, entry))) continue
  const src = read(entry)
  const dir = path.dirname(entry)
  // `export { default as MShape, shapeNames } from …`: the default is the component, the rest are values.
  for (const m of src.matchAll(/^export\s*\{([^}]*\bdefault as \w+[^}]*)\}\s*from\s*'([^']+)'/gm)) {
    for (const part of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const def = part.match(/^default as (\w+)$/)
      if (def) { if (!components.has(def[1])) components.set(def[1], { file: path.join(dir, m[2]), from }) }
      else if (!valueExports.some((v) => v.name === part)) valueExports.push({ name: part, file: resolveSource(dir, m[2]), from })
    }
  }
  for (const m of src.matchAll(/^export\s+type\s*\{([^}]+)\}\s*from\s*'([^']+)'/gm)) {
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!typeExports.has(name)) typeExports.set(name, { file: resolveSource(dir, m[2]), from })
    }
  }
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}\s*from\s*'([^']+)'/gm)) {
    if (/default as/.test(m[1])) continue
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!valueExports.some((v) => v.name === name)) valueExports.push({ name, file: resolveSource(dir, m[2]), from })
    }
  }
}

function resolveSource(dir, spec) {
  const base = path.join(dir, spec)
  for (const f of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile()) return f
  }
  return base
}

// ─── Source helpers ───────────────────────────────────────────────────────────

const oneLine = (s) => (s ?? '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * A description as one line of Markdown: HTML-looking tags outside backticks (`<a>`, `<MMenuDivider gap />`)
 * get backticks, or a Markdown renderer would treat them as real HTML.
 */
const mdText = (s) => oneLine(s).split(/(`[^`]*`)/).map((part) => (part.startsWith('`') ? part : part.replace(/<\/?[A-Za-z][^<>`]*>/g, (tag) => `\`${tag}\``))).join('')

/** The TypeScript inside a .vue file's <script> blocks, or a .ts file as is. */
function scriptOf(file) {
  const text = read(file)
  if (!file.endsWith('.vue')) return text
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
}

function sourceFile(file) {
  return ts.createSourceFile(file, scriptOf(file), ts.ScriptTarget.Latest, true)
}

/** Source text of an exported interface or type alias, with its JSDoc, indented as written. */
function typeSource(file, name) {
  const sf = sourceFile(file)
  for (const st of sf.statements) {
    if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name.text === name) {
      return dedent(st.getFullText(sf).replace(/^\s*\n/, '')).trim()
    }
  }
  return null
}

function declaredTypes(file) {
  return sourceFile(file).statements
    .filter((st) => ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st))
    .map((st) => st.name.text)
}

function dedent(s) {
  const lines = s.split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

/**
 * The JSDoc block that opens a component's <script setup> (or, for a template-only one, an HTML comment
 * at the top of the file): its description, plus `@slot name text`
 * and `@event name text` tags (vue-component-meta reads neither template slots' nor emits' JSDoc).
 */
function componentHeader(file) {
  // Template-only components carry it in an HTML comment at the top instead (no script block to add).
  const m = read(file).match(/^(?:[\s\S]*?<script setup[^>]*>|\s*<!--)\s*\/\*\*([\s\S]*?)\*\//)
  const header = { description: '', slots: {}, events: {} }
  if (!m) return header
  const body = m[1].replace(/^[ \t]*\* ?/gm, '')
  const [desc, ...tags] = body.split(/^(?=@\w+)/m)
  header.description = mdText(desc)
  for (const t of tags) {
    const tag = t.match(/^@(slot|event)\s+(\S+)\s+([\s\S]*)$/)
    if (tag) header[`${tag[1]}s`][tag[2]] = mdText(tag[3])
  }
  return header
}

// ─── Components ──────────────────────────────────────────────────────────────

const checker = createChecker(path.join(root, 'tsconfig.build.json'), {
  forceUseTs: true,
  printer: { newLine: ts.NewLineKind.LineFeed },
})

const stripUndefined = (t) => t.replace(/\s*\|\s*undefined\b/g, '').trim()

// TypeScript's JSDoc parser reads any `@word` as a tag, even mid-sentence ("fires @debounced",
// "auto-true when href, to, @click…"), and cuts the description there. Put those back.
const JSDOC_TAGS = new Set(['default', 'defaultValue', 'deprecated', 'internal', 'see', 'example', 'param', 'returns', 'since'])
function fullDescription(m) {
  let text = m.description ?? ''
  for (const t of m.tags ?? []) {
    if (JSDOC_TAGS.has(t.name)) continue
    const rest = t.text ?? ''
    text += `${text ? ' ' : ''}@${t.name}${rest && !/^[,.;:()]/.test(rest) ? ' ' : ''}${rest}`
  }
  return text
}

function componentApi(name, { file, from }) {
  const meta = checker.getComponentMeta(path.join(root, file))
  const header = componentHeader(file)
  const props = meta.props
    .filter((p) => !p.global && !p.tags.some((t) => t.name === 'internal'))
    .map((p) => ({
      name: p.name,
      type: stripUndefined(p.type),
      required: p.required,
      default: p.default == null || p.default === 'undefined' ? null : p.default,
      description: mdText(fullDescription(p)),
    }))
  const models = new Set(meta.events.filter((e) => e.name.startsWith('update:')).map((e) => e.name.slice(7)))
  const events = meta.events.map((e) => ({
    name: e.name,
    args: e.type.replace(/^\[|\]$/g, ''),
    description: mdText(fullDescription(e)) || header.events[e.name] || '',
  }))
  const slots = meta.slots.map((s) => ({
    name: s.name,
    bindings: s.type === '{}' || s.type === 'any' ? null : s.type,
    description: mdText(fullDescription(s)) || header.slots[s.name] || '',
  }))
  const exposed = meta.exposed
    .filter((x) => !x.name.startsWith('$') && !props.some((p) => p.name === x.name))
    .map((x) => ({ name: x.name, type: x.type, description: mdText(fullDescription(x)) }))
  // Exported types, plus any type declared in the file that its API mentions (e.g. a local
  // `type ChartType = …` used by a prop), so the reader knows the allowed values.
  const apiText = JSON.stringify([props, events, slots, exposed])
  const typeNames = new Set([...typeExports].filter(([, t]) => t.file === file).map(([n]) => n))
  for (const n of declaredTypes(file)) if (new RegExp(`\\b${n}\\b`).test(apiText)) typeNames.add(n)
  const types = [...typeNames].map((typeName) => ({ name: typeName, source: typeSource(file, typeName) }))
  return {
    name,
    import: from,
    description: header.description,
    props: props.map((p) => ({ ...p, model: models.has(p.name) })),
    events,
    slots,
    exposed,
    types,
  }
}

const componentList = [...components]
  .filter(([name]) => !name.startsWith('_'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, info]) => componentApi(name, info))

// ─── Composables, plugin, data ───────────────────────────────────────────────

// Values a .vue file re-exports from a package (MShape's `shapeNames` from shape-morph) go through a
// virtual .ts file holding just those re-exports, so the checker can type them.
const virtualFile = path.join(root, 'src/__vue-reexports.ts')
const virtualSource = [...new Set(valueExports.filter((v) => v.file.endsWith('.vue')).map((v) => v.file))]
  .flatMap((f) => [...scriptOf(f).matchAll(/^export\s*\{[^}]+\}\s*from\s*'[^'.][^']*'/gm)].map((m) => m[0]))
  .join('\n')
const compilerOptions = { target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true }
const host = ts.createCompilerHost(compilerOptions)
const getSourceFile = host.getSourceFile.bind(host)
host.getSourceFile = (f, ...rest) => (path.resolve(f) === virtualFile ? ts.createSourceFile(f, virtualSource, ts.ScriptTarget.Latest, true) : getSourceFile(f, ...rest))
const fileExists = host.fileExists.bind(host)
host.fileExists = (f) => path.resolve(f) === virtualFile || fileExists(f)
const program = ts.createProgram(
  [...new Set(valueExports.map((v) => path.join(root, v.file)).filter((f) => f.endsWith('.ts'))), virtualFile],
  compilerOptions,
  host,
)
const tc = program.getTypeChecker()
const flags = ts.TypeFormatFlags.NoTruncation

const wrappers = { ref: 'Ref', shallowRef: 'ShallowRef', computed: 'ComputedRef', readonly: 'Readonly' }
/** Ref<X, X> → Ref<X>; drops the `| undefined` TypeScript adds to optional members. */
const tidy = (t) => t.replace(/\b(Ref|ShallowRef)<([^<>]+), \2>/g, '$1<$2>').replace(/\?: ([^;,)]+?) \| undefined/g, '?: $1')

/** A returned member's type as declared (`ref<Toast[]>()` → `Ref<Toast[]>`) rather than fully expanded. */
function memberType(sym) {
  const d = sym.valueDeclaration
  let target = d
  if (d && ts.isShorthandPropertyAssignment(d)) target = tc.getShorthandAssignmentValueSymbol(d)?.valueDeclaration
  else if (d && ts.isPropertyAssignment(d) && ts.isIdentifier(d.initializer)) target = tc.getSymbolAtLocation(d.initializer)?.valueDeclaration
  const init = target && ts.isVariableDeclaration(target) ? target.initializer : null
  if (init && ts.isCallExpression(init) && init.typeArguments?.length) {
    const w = wrappers[init.expression.getText()]
    if (w) return `${w}<${init.typeArguments[0].getText()}>`
  }
  if (target && ts.isFunctionDeclaration(target)) return `(${target.parameters.map((x) => x.getText()).join(', ')}) => ${tidy(tc.signatureToString(tc.getSignatureFromDeclaration(target), undefined, flags)).replace(/^.*\): /, '')}`
  return tidy(tc.typeToString(tc.getTypeOfSymbol(sym), undefined, flags))
}

function signatureOf(name, sig) {
  const decl = sig.getDeclaration()
  const params = decl?.parameters
    ? decl.parameters.map((x) => x.getText().replace(/\s+/g, ' ')).join(', ')
    : tc.signatureToString(sig, undefined, flags).replace(/^\((.*)\):.*$/, '$1')
  const ret = sig.getReturnType()
  if (ret.symbol?.name === '__object') {
    const members = ret.getProperties().map((m) => `  ${m.name}: ${memberType(m)}`)
    return `${name}(${params}): {\n${members.join('\n')}\n}`
  }
  return `${name}(${params}): ${tidy(tc.typeToString(ret, undefined, flags))}`
}

function valueApi({ name, file, from }) {
  const sf = program.getSourceFile(file.endsWith('.vue') ? virtualFile : path.join(root, file))
  if (!sf) return { name, import: from, signature: '', description: '' }
  const sym = tc.getSymbolsInScope(sf, ts.SymbolFlags.Value).find((s) => s.name === name)
    ?? tc.getExportsOfModule(tc.getSymbolAtLocation(sf)).find((s) => s.name === name)
  if (!sym) return { name, import: from, signature: '', description: '' }
  const decl = sym.valueDeclaration ?? sym.declarations?.[0]
  const type = tc.getTypeOfSymbolAtLocation(sym, decl ?? sf)
  const calls = type.getCallSignatures()
  const signature = calls.length
    ? calls.map((c) => signatureOf(name, c)).join('\n')
    : `${name}: ${tidy(tc.typeToString(type, undefined, flags))}`
  return { name, import: from, signature, description: mdText(ts.displayPartsToString(sym.getDocumentationComment(tc))) }
}

const values = valueExports.map(valueApi)

/** Types exported next to composables/plugin/data (not components). */
const looseTypes = [...typeExports]
  .filter(([, t]) => !t.file.endsWith('.vue'))
  .map(([name, t]) => ({ name, import: t.from, source: typeSource(t.file, name) }))

// ─── Theme tokens, palettes, locale keys ─────────────────────────────────────

const themeCss = read('src/styles/theme.css')
const themeBlock = themeCss.slice(themeCss.indexOf('@theme'), themeCss.indexOf('}', themeCss.indexOf('@theme')))
const tokens = (prefix) => [...new Set([...themeBlock.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:`, 'g'))].map((m) => m[1]))]
const colorTokens = tokens('color')
const textTokens = tokens('text').filter((t) => !t.includes('--'))
const radiusTokens = tokens('radius')
const shadowTokens = tokens('shadow')
const easeTokens = tokens('ease')
const durationTokens = tokens('duration')
// Utilities theme.css adds on top of the tokens' own (`@utility scrollbar-none { … }`)
const utilities = [...themeCss.matchAll(/^@utility\s+([\w-]+)/gm)].map((m) => m[1])

const palettes = [...read('src/composables/useColorPalette.ts').matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1])

const localeSf = sourceFile('src/composables/useLocale.ts')
let localeKeys = []
for (const st of localeSf.statements) {
  if (ts.isInterfaceDeclaration(st) && st.name.text === 'M3Locale') localeKeys = st.members.map((m) => m.name.getText(localeSf))
}
const localeExports = [...read('src/locales/index.ts').matchAll(/export \{ (\w+) \}/g)].map((m) => m[1])

const api = {
  name: PKG,
  version: pkg.version,
  entries: entries.filter(([e]) => fs.existsSync(path.join(root, e))).map(([, from]) => from),
  components: componentList,
  values,
  types: looseTypes,
  theme: { colors: colorTokens, text: textTokens, radius: radiusTokens, shadow: shadowTokens, ease: easeTokens, duration: durationTokens, utilities, palettes },
  locale: { keys: localeKeys, presets: localeExports },
}

// ─── Markdown ────────────────────────────────────────────────────────────────

const code = (s) => '`' + s.replace(/`/g, "'") + '`'

function propLine(p) {
  let s = `- ${code(`${p.name}${p.required ? '' : '?'}: ${p.type}${p.default != null ? ` = ${p.default}` : ''}`)}`
  if (p.model) s += ' (v-model' + (p.name === 'modelValue' ? '' : `:${p.name}`) + ')'
  if (p.description) s += ` — ${p.description}`
  return s
}

function componentMd(c) {
  const out = [`### ${c.name}`, '']
  if (c.import !== PKG) out.push(`Import from ${code(c.import)}.`, '')
  if (c.description) out.push(c.description, '')
  if (c.props.length) out.push('Props:', ...c.props.map(propLine), '')
  if (c.events.length) out.push('Events:', ...c.events.map((e) => `- ${code(`${e.name}(${e.args})`)}${e.description ? ` — ${e.description}` : ''}`), '')
  if (c.slots.length) out.push('Slots:', ...c.slots.map((s) => `- ${code(`#${s.name}${s.bindings ? ` ${oneLine(s.bindings)}` : ''}`)}${s.description ? ` — ${s.description}` : ''}`), '')
  if (c.exposed.length) out.push('Exposed (template ref):', ...c.exposed.map((x) => `- ${code(`${x.name}: ${oneLine(x.type)}`)}${x.description ? ` — ${x.description}` : ''}`), '')
  for (const t of c.types) if (t.source) out.push('```ts', t.source, '```', '')
  return out.join('\n')
}

const md = `# ${PKG} ${pkg.version} — API reference

Material Design 3 components for Vue 3 + Tailwind CSS v4. Generated from the source by
\`scripts/generate-api.mjs\`; full docs with live demos at https://m3ui.dev.

## Setup

\`\`\`css
/* main stylesheet, in this order */
@import 'tailwindcss';
@import '${PKG}/theme';
@import '${PKG}/palettes';
@import '${PKG}/palettes-contrast'; /* optional: medium and high contrast */
@import '${PKG}/styles';
\`\`\`

\`\`\`ts
// optional: default palette and translated built-in strings
import { createM3UI } from '${PKG}'
import { esLocale } from '${PKG}/locales'
app.use(createM3UI({ palette: 'blue', locale: esLocale }))
\`\`\`

- Icons use the Material Symbols Outlined font (load it yourself, e.g. from Google Fonts); \`icon\` props take a
  Material Symbols name such as \`'home'\`.
- Import components by name: \`import { MButton, MDialog } from '${PKG}'\`. Components with heavy optional peer
  dependencies live in their own entry points (noted on each one): ${api.entries.filter((e) => e !== PKG).map(code).join(', ')}.
- Dark mode is the \`dark\` class on \`<html>\` (\`useTheme()\` manages it); palettes are \`data-palette="<id>"\` on \`<html>\`
  (\`useColorPalette()\`, or a scheme generated from any color with \`setSeed()\` / \`createM3UI({ seed })\`); contrast levels
  are \`data-contrast="medium|high"\` (\`setContrast()\` / \`createM3UI({ contrast })\`, needs the \`palettes-contrast\` import).
- \`createM3UI()\` also registers the \`v-ripple\` directive globally (or import \`vRipple\`).
- Style your own markup with the M3 tokens as Tailwind utilities: \`bg-surface-container\`, \`text-on-surface-variant\`,
  \`text-title-medium\`, \`rounded-lg\`, \`shadow-elevation-2\`.
- Two-way props are \`v-model\` (\`modelValue\`) or \`v-model:<name>\`, marked "(v-model)" below.

## Components

${componentList.map(componentMd).join('\n')}
## Composables and functions

${values.map((v) => `### ${v.name}\n\n${v.import !== PKG ? `Import from ${code(v.import)}.\n\n` : ''}${v.description ? `${v.description}\n\n` : ''}\`\`\`ts\n${v.signature}\n\`\`\`\n`).join('\n')}
## Types

${looseTypes.filter((t) => t.source).map((t) => '```ts\n' + t.source + '\n```').join('\n\n')}

## Locale

\`M3Locale\` keys (pass a partial object to \`createM3UI({ locale })\`; presets from \`${PKG}/locales\`:
${localeExports.map(code).join(', ')}):

${localeKeys.join(', ')}

## Theme tokens

- Colors (\`bg-*\`, \`text-*\`, \`border-*\`…): ${colorTokens.join(', ')}
- Type scale (\`text-*\`): ${textTokens.join(', ')}
- Radius (\`rounded-*\`): ${radiusTokens.join(', ')}
- Shadows (\`shadow-*\`): ${shadowTokens.join(', ')}
- Easing (\`ease-*\`, CSS \`--ease-*\`): ${easeTokens.join(', ')}
- Durations (CSS \`--duration-*\`, e.g. \`duration-(--duration-medium-2)\`): ${durationTokens.join(', ')}
- Utilities: ${utilities.map(code).join(', ')}
- Palettes (\`useColorPalette().set(id)\` / \`createM3UI({ palette })\`): ${palettes.join(', ')}
`

fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
fs.writeFileSync(path.join(root, 'dist/API.md'), md)
fs.writeFileSync(path.join(root, 'dist/api.json'), JSON.stringify(api))
console.log(`API reference: ${componentList.length} components, ${values.length} functions, ${(md.length / 1024).toFixed(0)} KB → dist/API.md, dist/api.json`)
