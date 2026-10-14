import { getCurrentInstance } from 'vue'

/** A navigation destination: a vue-router location, or a plain URL without vue-router. */
export type ItemLink = string | Record<string, unknown>

/*
 * Internal (not exported from index.ts): lets navigation items with a `to` render as real links
 * (middle-click, open in new tab, `aria-current` from vue-router) instead of buttons. With
 * vue-router installed it's a RouterLink; without it a string `to` becomes a plain `<a href>`
 * rather than an unresolved `<RouterLink>` tag. Items without `to` (or disabled ones) stay buttons.
 */
export function useItemLink() {
  const hasRouter = !!getCurrentInstance()?.appContext.components.RouterLink
  return (item: { to?: ItemLink; disabled?: boolean }) => {
    if (!item.to || item.disabled) return { tag: 'button', attrs: { type: 'button', disabled: item.disabled || undefined } }
    if (hasRouter) return { tag: 'RouterLink', attrs: { to: item.to } }
    return { tag: 'a', attrs: { href: typeof item.to === 'string' ? item.to : undefined } }
  }
}
