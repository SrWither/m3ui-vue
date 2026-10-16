// Writes dist/THIRD_PARTY_LICENSES.md: the license of every package whose code is bundled into dist/ (imported
// from src/ and not in vite.config.ts's `external`), as their licenses (MIT, BSD, Apache-2.0) require when
// redistributing. Fails the build if a bundled package has no license file, so a new one can't slip in unnoticed.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name

// Bare imports in the shipped sources (tests excluded)
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name === '__tests__') continue
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|vue)$/.test(name)) out.push(path)
  }
  return out
}
const imported = new Set()
for (const file of walk(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8')
  for (const [, spec] of text.matchAll(/(?:from\s+|import\(\s*)'([^'./][^']*)'/g)) {
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
    if (pkg !== own) imported.add(pkg)
  }
}

// vite.config.ts's external list (strings and regexes)
const config = readFileSync(join(root, 'vite.config.ts'), 'utf8')
const externalSrc = config.match(/external:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
const externals = Function(`return [${externalSrc}]`)()
const isExternal = (pkg) => pkg === 'vue' || externals.some((e) => (e instanceof RegExp ? e.test(pkg) : e === pkg))

const bundled = [...imported].filter((pkg) => !isExternal(pkg)).sort()

const sections = bundled.map((pkg) => {
  const dir = join(root, 'node_modules', pkg)
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f))
  if (!licenseFile) throw new Error(`third-party-licenses: ${pkg} is bundled but has no LICENSE file`)
  const text = readFileSync(join(dir, licenseFile), 'utf8').trim()
  const repo = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url
  return `## ${meta.name} ${meta.version}\n\nLicense: ${meta.license ?? 'see below'}${repo ? `  \nSource: ${repo.replace(/^git\+/, '')}` : ''}\n\n\`\`\`\n${text}\n\`\`\``
})

// Not packages, but also redistributed: generated data and ported source (texts in scripts/licenses/)
const licenseText = (name) => readFileSync(join(root, 'scripts', 'licenses', name), 'utf8').trim()
const other = [
  `## Unicode emoji data and CLDR annotations

The emoji list (\`src/data/emojis.ts\`, from Unicode's emoji-test.txt) and emoji names in several languages
(\`src/data/emoji-names/\`, from the Unicode CLDR annotations) used by MEmojiSelector are generated from Unicode
data files by \`scripts/generate-emoji-data.mjs\`.

\`\`\`
${licenseText('unicode-license-v3.txt')}
\`\`\``,
  `## Android Open Source Project (androidx Compose Material 3, Material Components for Android)

Copyright The Android Open Source Project. Licensed under the Apache License, Version 2.0 (text below).

\`src/composables/_carouselStrategy.ts\` (MCarousel's keyline engine) is a TypeScript translation, modified for
this library, of androidx \`compose/material3/carousel\` (Arrangement.kt, KeylineList.kt, Keylines.kt,
Strategy.kt, KeylineSnapPosition.kt) and of Material Components for Android's FullScreenCarouselStrategy. Other
components follow the behavior and design token values (sizes, colors, motion specs) of Compose Material 3.

\`\`\`
${licenseText('apache-2.0.txt')}
\`\`\``,
]

const out = `# Third-party licenses

${own} bundles code from the following packages into \`dist/\`, and includes data and source derived from the
projects after them. Their licenses follow.

${[...sections, ...other].join('\n\n')}
`
if (!existsSync(join(root, 'dist'))) throw new Error('third-party-licenses: run vite build first')
writeFileSync(join(root, 'dist', 'THIRD_PARTY_LICENSES.md'), out)
console.log(`Third-party licenses: ${bundled.join(', ')}, Unicode data, AOSP → dist/THIRD_PARTY_LICENSES.md`)
