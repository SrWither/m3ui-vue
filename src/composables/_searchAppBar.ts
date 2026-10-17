// Internal (not exported from index.ts): what MAppBarWithSearch hands the MSearchBar inside it
import type { InjectionKey, Ref } from 'vue'

export interface SearchAppBarContext {
  /** Content is scrolled under the app bar: the search bar takes its scrolled container color */
  scrolled: Ref<boolean>
}

export const searchAppBarKey: InjectionKey<SearchAppBarContext> = Symbol('m-search-app-bar')
