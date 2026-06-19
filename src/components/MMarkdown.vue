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

onMounted(async () => {
  const { default: MarkdownIt } = await import('markdown-it')

  const instance = new MarkdownIt({
    html: false,
    breaks: props.breaks,
    linkify: props.linkify,
    typographer: true,
  })

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
</script>

<template>
  <div class="m3-markdown text-body-large text-on-surface" v-html="rendered" />
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
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
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
