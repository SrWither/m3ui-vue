import { computed, hasInjectionContext, inject, onMounted, ref, type InjectionKey, type Ref } from 'vue'
import { isHydrating } from './_hydration'
import type { Theme } from './useTheme'
import type { ContrastLevel } from './useColorPalette'

/** The user's theme choices as a server knows them (from cookies), for server-side rendering. */
export interface M3InitialState {
  theme?: Theme
  palette?: string
  contrast?: ContrastLevel
}

// Internal: `createM3UI({ initialState })`, resolved against the plugin's defaults
export const M3_INITIAL_STATE_KEY: InjectionKey<Required<M3InitialState>> = Symbol('m3-initial-state')

export function initialState(): Required<M3InitialState> | null {
  return hasInjectionContext() ? inject(M3_INITIAL_STATE_KEY, null) : null
}

/**
 * What a composable reports for a stored choice. On the server: the initial state (the module-level refs are shared
 * by every request and hold nothing there). On the client while hydrating: the initial state too, so the first
 * render matches the server's HTML, then the live value once mounted. Otherwise the live ref itself.
 */
export function ssrValue<T>(live: Ref<T>, initial: T | undefined): Ref<T> {
  if (initial === undefined) return live
  if (typeof window === 'undefined') return ref(initial) as Ref<T>
  if (!isHydrating()) return live
  const mounted = ref(false)
  onMounted(() => { mounted.value = true })
  return computed({
    get: () => (mounted.value ? live.value : initial),
    set: (value) => { live.value = value },
  }) as Ref<T>
}

// ── Cookies ─────────────────────────────────────────────────────────────────────────────────────
// `createM3UI({ cookies: true })`: the choices are also kept in cookies, which a server can read.

let cookiesEnabled = false

export function enableCookies() {
  cookiesEnabled = true
}

export function writeCookie(key: string, value: string | null) {
  if (!cookiesEnabled || typeof document === 'undefined') return
  document.cookie = value == null
    ? `${key}=; Max-Age=0; Path=/; SameSite=Lax`
    : `${key}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`
}
