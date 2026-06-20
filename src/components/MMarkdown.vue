<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    source: string
    breaks?: boolean
    linkify?: boolean
  }>(),
  { breaks: true, linkify: true },
)

const md = ref<any>(null)

function parseCodeInfo(info: string) {
  const parts = info.trim().split(/\s+/)
  let lang = ''
  let copy = false
  const lines: number[] = []

  for (const part of parts) {
    if (part === 'copy') {
      copy = true
    } else if (/^\{[\d,\s-]+\}$/.test(part)) {
      for (const seg of part.slice(1, -1).split(',')) {
        const range = seg.trim().split('-')
        if (range.length === 2) {
          const a = parseInt(range[0]!), b = parseInt(range[1]!)
          for (let i = a; i <= b; i++) lines.push(i)
        } else {
          lines.push(parseInt(range[0]!))
        }
      }
    } else if (!lang) {
      lang = part
    }
  }

  return { lang, copy, lines }
}

onMounted(async () => {
  const { default: MarkdownIt } = await import('markdown-it')

  let hljs: any = null
  try {
    const mod = await import('highlight.js/lib/common')
    hljs = mod.default
  } catch {}

  const instance = new MarkdownIt({
    html: false,
    breaks: props.breaks,
    linkify: props.linkify,
    typographer: true,
  })

  const esc = instance.utils.escapeHtml

  instance.renderer.rules.fence = (tokens: any, idx: number) => {
    const token = tokens[idx]
    const { lang, copy, lines } = parseCodeInfo(token.info)
    const raw = token.content

    let highlighted: string
    if (hljs && lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value
    } else {
      highlighted = esc(raw)
    }

    if (lines.length > 0) {
      const codeLines = highlighted.split('\n')
      if (codeLines.length && codeLines[codeLines.length - 1] === '') codeLines.pop()
      highlighted = codeLines.map((line, i) => {
        const cls = lines.includes(i + 1) ? ' m3-line-hl' : ''
        return `<span class="m3-code-line${cls}">${line}\n</span>`
      }).join('')
    }

    const copyBtn = copy
      ? '<button class="m3-code-copy" type="button" title="Copy"><span class="material-symbols-outlined" style="font-size:18px">content_copy</span></button>'
      : ''

    return `<div class="m3-code-block">${copyBtn}<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${highlighted}</code></pre></div>\n`
  }

  instance.renderer.rules.link_open = (tokens: any, idx: number, options: any, _env: any, self: any) => {
    const token = tokens[idx]
    if (token) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
    return self.renderToken(tokens, idx, options)
  }

  md.value = instance
})

const rendered = computed(() => md.value ? md.value.render(props.source) : '')

function onContainerClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.m3-code-copy') as HTMLElement | null
  if (!btn) return
  const code = btn.closest('.m3-code-block')?.querySelector('code')
  if (!code) return
  navigator.clipboard.writeText(code.textContent || '')
  const icon = btn.querySelector('span')
  if (icon) {
    icon.textContent = 'check'
    setTimeout(() => { icon.textContent = 'content_copy' }, 1500)
  }
}
</script>

<template>
  <div class="m3-markdown text-body-large text-on-surface" v-html="rendered" @click="onContainerClick" />
</template>

<style scoped>
.m3-markdown :deep(h1) { font-size: var(--text-headline-large); line-height: var(--text-headline-large--line-height); font-weight: 600; margin: 1em 0 0.5em; color: var(--color-on-surface); }
.m3-markdown :deep(h2) { font-size: var(--text-headline-medium); line-height: var(--text-headline-medium--line-height); font-weight: 600; margin: 1em 0 0.5em; color: var(--color-on-surface); }
.m3-markdown :deep(h3) { font-size: var(--text-headline-small); line-height: var(--text-headline-small--line-height); font-weight: 600; margin: 0.75em 0 0.25em; color: var(--color-on-surface); }
.m3-markdown :deep(h4) { font-size: var(--text-title-large); line-height: var(--text-title-large--line-height); font-weight: 600; margin: 0.75em 0 0.25em; color: var(--color-on-surface); }

.m3-markdown :deep(p) { margin: 0.5em 0; }

.m3-markdown :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.m3-markdown :deep(a:hover) { opacity: 0.8; }

.m3-markdown :deep(strong) { font-weight: 600; color: var(--color-on-surface); }
.m3-markdown :deep(em) { font-style: italic; }

.m3-markdown :deep(ul) { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
.m3-markdown :deep(ol) { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
.m3-markdown :deep(li) { margin: 0.25em 0; }
.m3-markdown :deep(li::marker) { color: var(--color-on-surface-variant); }

.m3-markdown :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding: 0.5em 1em;
  margin: 0.75em 0;
  background: var(--color-surface-container);
  border-radius: 0 8px 8px 0;
  color: var(--color-on-surface-variant);
}

.m3-markdown :deep(code) {
  background: var(--color-surface-container-highest);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-family: 'Roboto Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.875em;
  color: var(--color-primary);
}

.m3-markdown :deep(pre) {
  background: var(--color-surface-container-highest);
  padding: 1em;
  border-radius: 12px;
  overflow-x: auto;
  margin: 0.75em 0;
  border: 1px solid var(--color-outline-variant);
}
.m3-markdown :deep(pre code) {
  background: none;
  padding: 0;
  color: var(--color-on-surface);
  font-size: 0.8125rem;
  line-height: 1.6;
}

/* Syntax highlighting — matches MCodeEditor M3 palette */
.m3-markdown :deep(.hljs-keyword),
.m3-markdown :deep(.hljs-selector-tag),
.m3-markdown :deep(.hljs-built_in),
.m3-markdown :deep(.hljs-tag .hljs-keyword) { color: var(--color-primary); }

.m3-markdown :deep(.hljs-string),
.m3-markdown :deep(.hljs-regexp),
.m3-markdown :deep(.hljs-template-variable) { color: var(--color-tertiary); }

.m3-markdown :deep(.hljs-number),
.m3-markdown :deep(.hljs-literal) { color: var(--color-error); }

.m3-markdown :deep(.hljs-title.function_),
.m3-markdown :deep(.hljs-title.function_>.hljs-keyword) { color: var(--color-secondary); font-weight: 500; }

.m3-markdown :deep(.hljs-type),
.m3-markdown :deep(.hljs-title.class_) { color: var(--color-primary); font-style: italic; }

.m3-markdown :deep(.hljs-comment),
.m3-markdown :deep(.hljs-quote) { color: var(--color-outline); font-style: italic; }

.m3-markdown :deep(.hljs-attr),
.m3-markdown :deep(.hljs-attribute) { color: var(--color-tertiary); }

.m3-markdown :deep(.hljs-tag) { color: var(--color-on-surface-variant); }
.m3-markdown :deep(.hljs-name) { color: var(--color-primary); }

.m3-markdown :deep(.hljs-punctuation),
.m3-markdown :deep(.hljs-operator) { color: var(--color-on-surface-variant); }

.m3-markdown :deep(.hljs-meta),
.m3-markdown :deep(.hljs-meta .hljs-keyword) { color: var(--color-on-surface-variant); }

.m3-markdown :deep(.hljs-variable),
.m3-markdown :deep(.hljs-property) { color: var(--color-on-surface); }

.m3-markdown :deep(.hljs-symbol),
.m3-markdown :deep(.hljs-params) { color: var(--color-on-surface); }

/* Code block wrapper */
.m3-markdown :deep(.m3-code-block) { position: relative; }

/* Copy button */
.m3-markdown :deep(.m3-code-copy) {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}
.m3-markdown :deep(.m3-code-block:hover .m3-code-copy) { opacity: 1; }
.m3-markdown :deep(.m3-code-copy:hover) { background: var(--color-surface-container-high); color: var(--color-on-surface); }

/* Line highlighting */
.m3-markdown :deep(.m3-code-line) { display: block; }
.m3-markdown :deep(.m3-line-hl) {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  margin: 0 -1em;
  padding: 0 1em;
  border-left: 2px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  padding-left: calc(1em - 2px);
}

.m3-markdown :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-outline-variant);
  margin: 1.5em 0;
}

.m3-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
}
.m3-markdown :deep(th) {
  background: var(--color-surface-container);
  font-weight: 600;
  text-align: left;
  padding: 0.5em 0.75em;
  border-bottom: 2px solid var(--color-outline-variant);
  font-size: var(--text-label-large);
  color: var(--color-on-surface);
}
.m3-markdown :deep(td) {
  padding: 0.5em 0.75em;
  border-bottom: 1px solid var(--color-outline-variant);
}

.m3-markdown :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 0.5em 0;
}
</style>
