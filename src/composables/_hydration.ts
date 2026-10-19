import { getCurrentInstance, inject, type InjectionKey } from 'vue'

// Internal: `createM3UI({ isHydrating })`. A server-rendered app's first client render has to match the server's
// HTML, so what the server can't know (the window's size) starts from the server's value until the app is mounted.
export const M3_HYDRATING_KEY: InjectionKey<() => boolean> = Symbol('m3-hydrating')

/** Whether the calling component is being hydrated from server-rendered HTML (false outside a component's setup). */
export function isHydrating(): boolean {
  return getCurrentInstance() ? inject(M3_HYDRATING_KEY, null)?.() ?? false : false
}
